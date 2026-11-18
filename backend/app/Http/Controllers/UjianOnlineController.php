<?php

namespace App\Http\Controllers;

use App\Models\LogAksesUjian;
use App\Models\PesertaSesiUjian;
use App\Models\SesiUjian;
use App\Services\FileProtectionService;
use App\Services\QrTokenService;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Services\NotifikasiService;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class UjianOnlineController extends Controller
{
    public function __construct(
        private readonly FileProtectionService $files,
        private readonly QrTokenService $tokens,
        private readonly RateLimiter $limiter,
    ) {}

    public function aksesViaQr(string $token): JsonResponse
    {
        $sesi = $this->tokens->findValid($token)?->load(['soal.mataKuliah', 'soal.dosen']);
        if (! $sesi) {
            return response()->json(['message' => 'QR tidak valid, dicabut, atau kedaluwarsa.'], 404);
        }
        $status = $sesi->statusEfektif();
        $message = match (true) {
            $status === 'suspended' => 'Sesi ujian ditangguhkan oleh Panitia.',
            in_array($status, ['cancelled', 'completed'], true) => 'Sesi ujian sudah ditutup.',
            $status !== 'active' => 'Sesi ujian belum diaktifkan oleh Panitia.',
            $sesi->soal?->status !== 'siap_ujian' => 'Soal belum disetujui untuk sesi ujian.',
            now()->lt($sesi->waktu_mulai) => 'Akses verifikasi tersedia mulai '.$sesi->waktu_mulai->format('d-m-Y H:i').'.',
            default => null,
        };
        return response()->json(['data' => [
            'nama_ujian' => $sesi->nama_ujian ?: $sesi->soal?->judul,
            'nama_mk' => $sesi->soal?->mataKuliah?->nama_mk,
            'kode_mk' => $sesi->soal?->mataKuliah?->kode_mk,
            'dosen' => $sesi->soal?->dosen?->nama,
            'kelas' => $sesi->soal?->mataKuliah?->kelas,
            'semester' => $sesi->soal?->mataKuliah?->semester,
            'tahun_ajaran' => $sesi->soal?->mataKuliah?->tahun_ajaran,
            'program_studi' => $sesi->program_studi,
            'waktu_mulai' => $sesi->waktu_mulai->toIso8601String(),
            'waktu_selesai' => $sesi->waktu_selesai->toIso8601String(),
            'status' => $status,
            'pesan_status' => $message,
        ]])->header('Cache-Control', 'no-store, private');
    }

    public function requestOtp(Request $request, string $token): JsonResponse
    {
        $data = $request->validate(['nim' => ['required', 'string', 'max:40']]);
        $sesi = $this->tokens->findValid($token);
        if (! $sesi || ! $sesi->bisaDiakses()) {
            return response()->json(['message' => 'Sesi tidak tersedia untuk verifikasi saat ini.'], 403);
        }

        $nim = mb_strtoupper(trim($data['nim']));
        $rateKey = 'exam-otp:'.hash_hmac('sha256', $sesi->id.'|'.$nim, (string) config('app.key'));
        if ($this->limiter->tooManyAttempts($rateKey, 3)) {
            return response()->json(['message' => 'Batas permintaan kode tercapai. Coba kembali beberapa menit lagi.'], 429);
        }
        $this->limiter->hit($rateKey, 300);

        $peserta = PesertaSesiUjian::where('sesi_ujian_id', $sesi->id)->where('nim', $nim)->first();
        if (! $peserta) {
            return response()->json(['message' => 'NIM tidak terdaftar pada sesi ini. Masukkan NIM yang terdaftar di roster atau hubungi Panitia.'], 422);
        }
        if ($peserta->access_locked_at) {
            return response()->json(['message' => 'Akses soal dikunci setelah tiga kali meninggalkan halaman. Hubungi Panitia untuk meminta pemeriksaan.'], 423);
        }
        if ($peserta->otp_attempts < 5) {
            $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $peserta->update([
                'otp_hash' => hash_hmac('sha256', $otp, (string) config('app.key')),
                'otp_expires_at' => now()->addMinutes(5),
                'otp_attempts' => 0,
                'verified_token_hash' => null,
                'verified_token_expires_at' => null,
                'verified_at' => null,
            ]);
            try {
                Mail::raw("Kode verifikasi SIKASA Anda: {$otp}. Kode berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun.", function ($message) use ($peserta) {
                    $message->to($peserta->email)->subject('Kode verifikasi akses soal SIKASA');
                });
            } catch (\Throwable) {
                $peserta->update(['otp_hash' => null, 'otp_expires_at' => null]);
                Log::error('Gagal mengirim kode verifikasi akses ujian.', ['sesi_ujian_id' => $sesi->id]);
            }
        }

        return response()->json(['message' => 'Kode verifikasi dikirim ke email kampus yang terdaftar pada roster sesi.'], 202);
    }

    public function verifyOtp(Request $request, string $token): JsonResponse
    {
        $data = $request->validate([
            'nim' => ['required', 'string', 'max:40'],
            'kode' => ['required', 'string', 'size:6', 'regex:/^[0-9]{6}$/'],
        ]);
        $sesi = $this->tokens->findValid($token);
        if (! $sesi || ! $sesi->bisaDiakses()) {
            return response()->json(['message' => 'Sesi tidak tersedia untuk verifikasi saat ini.'], 403);
        }

        $nim = mb_strtoupper(trim($data['nim']));
        $verifyKey = 'exam-verify:'.hash_hmac('sha256', $sesi->id.'|'.$nim, (string) config('app.key'));
        if ($this->limiter->tooManyAttempts($verifyKey, 5)) {
            return response()->json(['message' => 'Batas verifikasi tercapai. Minta kode baru atau coba kembali beberapa menit lagi.'], 429);
        }
        $this->limiter->hit($verifyKey, 300);
        $peserta = PesertaSesiUjian::where('sesi_ujian_id', $sesi->id)->where('nim', $nim)->first();
        if ($peserta?->access_locked_at) {
            return response()->json(['message' => 'Akses soal dikunci setelah tiga kali meninggalkan halaman. Hubungi Panitia untuk meminta pemeriksaan.'], 423);
        }
        if (! $peserta || ! $peserta->otp_hash || ! $peserta->otp_expires_at || $peserta->otp_expires_at->lessThanOrEqualTo(now()) || $peserta->otp_attempts >= 5) {
            return response()->json(['message' => 'Kode tidak valid atau kedaluwarsa. Minta kode baru dan coba kembali.'], 422);
        }
        $providedHash = hash_hmac('sha256', $data['kode'], (string) config('app.key'));
        if (! hash_equals($peserta->otp_hash, $providedHash)) {
            $peserta->increment('otp_attempts');
            return response()->json(['message' => 'Kode tidak valid atau kedaluwarsa. Minta kode baru dan coba kembali.'], 422);
        }
        $this->limiter->clear($verifyKey);

        $accessToken = bin2hex(random_bytes(32));
        $expiresAt = min(now()->addMinutes(15)->timestamp, $sesi->waktu_selesai->timestamp);
        $peserta->update([
            'otp_hash' => null,
            'otp_expires_at' => null,
            'verified_token_hash' => hash('sha256', $accessToken),
            'verified_token_expires_at' => now()->setTimestamp($expiresAt),
            'verified_at' => now(),
        ]);
        return response()->json([
            'message' => 'Identitas berhasil diverifikasi.',
            'access_token' => $accessToken,
            'expires_at' => now()->setTimestamp($expiresAt)->toIso8601String(),
            'nama' => $peserta->nama,
            'nim' => $peserta->nim,
        ])->header('Cache-Control', 'no-store, private');
    }

    public function heartbeat(Request $request, string $token): JsonResponse
    {
        $sesi = $this->tokens->findValid($token);
        $peserta = $sesi ? $this->verifiedParticipant($request, $sesi) : null;
        if (! $sesi || ! $peserta) return response()->json(['message' => 'Verifikasi mahasiswa kedaluwarsa.'], 401);
        if ($peserta->access_locked_at) return response()->json(['locked' => true, 'violations' => $peserta->pelanggaran_count], 423);
        if (! $sesi->bisaDiakses()) return response()->json(['message' => 'Sesi ujian sudah tidak aktif.'], 403);

        $expiresAt = min(now()->addMinutes(15)->timestamp, $sesi->waktu_selesai->timestamp);
        $peserta->update(['verified_token_expires_at' => now()->setTimestamp($expiresAt)]);
        return response()->json(['locked' => false, 'violations' => $peserta->pelanggaran_count, 'expires_at' => now()->setTimestamp($expiresAt)->toIso8601String()])->header('Cache-Control', 'no-store, private');
    }

    public function recordViolation(Request $request, string $token): JsonResponse
    {
        $data = $request->validate(['jenis' => ['required', 'in:tab_hidden']]);
        $sesi = $this->tokens->findValid($token);
        $peserta = $sesi ? $this->verifiedParticipant($request, $sesi) : null;
        if (! $sesi || ! $peserta) return response()->json(['message' => 'Verifikasi mahasiswa kedaluwarsa.'], 401);
        if (! $sesi->bisaDiakses()) return response()->json(['message' => 'Sesi ujian sudah tidak aktif.'], 403);

        $state = DB::transaction(function () use ($peserta, $sesi, $data, $request) {
            $locked = PesertaSesiUjian::whereKey($peserta->id)->lockForUpdate()->firstOrFail();
            if ($locked->access_locked_at) return ['count' => $locked->pelanggaran_count, 'locked' => true, 'new_lock' => false];

            $count = min(3, $locked->pelanggaran_count + 1);
            $isLocked = $count >= 3;
            $locked->update([
                'pelanggaran_count' => $count,
                'access_locked_at' => $isLocked ? now() : null,
                'verified_token_hash' => $isLocked ? null : $locked->verified_token_hash,
                'verified_token_expires_at' => $isLocked ? null : $locked->verified_token_expires_at,
            ]);
            $locked->pelanggaran()->create([
                'sesi_ujian_id' => $sesi->id,
                'jenis' => $data['jenis'],
                'pelanggaran_ke' => $count,
                'terjadi_pada' => now(),
                'ip_address' => $request->ip(),
            ]);
            return ['count' => $count, 'locked' => $isLocked, 'new_lock' => $isLocked];
        });

        if ($state['new_lock']) {
            $sesi->load('soal.mataKuliah');
            NotifikasiService::keRoles(
                ['panitia'],
                'Akses mahasiswa dikunci',
                "{$peserta->nama} (NIM {$peserta->nim}) dikunci setelah tiga kali meninggalkan halaman soal {$sesi->soal?->mataKuliah?->nama_mk}. Periksa mahasiswa jika meminta bantuan.",
                'peringatan',
                'Log Akses Ujian',
            );
        }

        $message = $state['locked']
            ? 'Akses soal dikunci setelah tiga kali meninggalkan halaman. Hubungi Panitia untuk meminta pemeriksaan.'
            : 'Peringatan '.$state['count'].' dari 3: tetap berada di halaman soal selama ujian.';
        return response()->json(['message' => $message, 'violations' => $state['count'], 'locked' => $state['locked']], $state['locked'] ? 423 : 200)->header('Cache-Control', 'no-store, private');
    }

    public function pdfViaQr(Request $request, string $token): JsonResponse|SymfonyResponse
    {
        $sesi = $this->tokens->findValid($token)?->load('soal');
        if (! $sesi) return response()->json(['message' => 'QR tidak valid, dicabut, atau kedaluwarsa.'], 404);
        $bearer = $request->bearerToken();
        if (! $bearer || ! preg_match('/^[a-f0-9]{64}$/', $bearer)) {
            return response()->json(['message' => 'Verifikasi mahasiswa diperlukan.'], 401);
        }
        $peserta = PesertaSesiUjian::where('sesi_ujian_id', $sesi->id)
            ->where('verified_token_hash', hash('sha256', $bearer))
            ->where('verified_token_expires_at', '>', now())
            ->first();
        if (! $peserta) return response()->json(['message' => 'Verifikasi kedaluwarsa. Silakan verifikasi kembali.'], 401);
        if ($peserta->access_locked_at) return response()->json(['message' => 'Akses soal dikunci setelah tiga kali meninggalkan halaman. Hubungi Panitia.'], 423);

        $diizinkan = $sesi->bisaDiakses() && $sesi->soal?->status === 'siap_ujian' && (bool) $sesi->soal?->file_path;
        if (! $diizinkan) return response()->json(['message' => 'Sesi tidak aktif atau waktu akses sudah berakhir.'], 403);
        try {
            $pdf = $this->files->readDecrypted($sesi->soal->file_path);
        } catch (\Throwable) {
            $pdf = null;
        }
        if ($pdf === null) return response()->json(['message' => 'File soal tidak ditemukan atau tidak dapat dibuka.'], 404);

        $now = now();
        $log = LogAksesUjian::firstOrNew(['sesi_ujian_id' => $sesi->id, 'nim' => $peserta->nim]);
        if (! $log->exists) {
            $log->akses_pertama_pada = $now;
            $log->jumlah_akses = 0;
        }
        $log->nama = $peserta->nama;
        $log->akses_terakhir_pada = $now;
        $log->jumlah_akses++;
        $log->status_akses = 'berhasil';
        $log->ip_terakhir = $request->ip();
        $log->save();
        $accessExpiry = min($now->copy()->addMinutes(15)->timestamp, $sesi->waktu_selesai->timestamp);
        $peserta->update(['verified_token_expires_at' => $now->copy()->setTimestamp($accessExpiry)]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="soal-ujian-'.$sesi->id.'.pdf"',
            'Cache-Control' => 'no-store, private, max-age=0',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Length' => (string) strlen($pdf),
        ]);
    }

    private function verifiedParticipant(Request $request, SesiUjian $sesi): ?PesertaSesiUjian
    {
        $bearer = $request->bearerToken();
        if (! $bearer || ! preg_match('/^[a-f0-9]{64}$/', $bearer)) return null;
        return PesertaSesiUjian::where('sesi_ujian_id', $sesi->id)
            ->where('verified_token_hash', hash('sha256', $bearer))
            ->where('verified_token_expires_at', '>', now())
            ->first();
    }
}
