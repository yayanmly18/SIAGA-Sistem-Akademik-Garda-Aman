<?php

namespace App\Http\Controllers;

use App\Models\BankSoal;
use App\Models\LogAksesUjian;
use App\Models\SesiUjian;
use App\Services\ActivityLogger;
use App\Services\QrTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SesiUjianController extends Controller
{
    public function __construct(private readonly QrTokenService $tokens) {}

    public function soalDisetujui(): JsonResponse
    {
        $soal = BankSoal::with(['mataKuliah', 'dosen'])
            ->where('status', 'siap_ujian')->whereNotNull('file_path')
            ->orderBy('jadwal_ujian')->get()
            ->map(fn (BankSoal $item) => [
                'id' => $item->id,
                'mk_id' => $item->mk_id,
                'nama_mk' => $item->mataKuliah?->nama_mk,
                'kode_mk' => $item->mataKuliah?->kode_mk,
                'kelas' => $item->mataKuliah?->kelas,
                'dosen' => $item->dosen?->nama,
                'judul' => $item->judul,
                'jenis' => $item->jenis,
            ]);
        return response()->json(['data' => $soal]);
    }

    public function index(): JsonResponse
    {
        $rows = SesiUjian::with(['soal.mataKuliah', 'soal.dosen'])
            ->withCount(['logAkses', 'peserta'])->orderByDesc('waktu_mulai')->get()
            ->map(fn (SesiUjian $sesi) => $this->transform($sesi));
        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bank_soal_id' => ['required', 'integer', 'exists:bank_soal,id'],
            'waktu_mulai' => ['bail', 'required', 'date', $this->notBeforeCurrentMinute()],
            'waktu_selesai' => ['required', 'date', 'after:waktu_mulai'],
            'nama_ujian' => ['nullable', 'string', 'max:200'],
            'program_studi' => ['nullable', 'string', 'max:150'],
            'keterangan' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', 'in:draft,scheduled'],
        ]);
        $soal = BankSoal::findOrFail($data['bank_soal_id']);
        if ($soal->status !== 'siap_ujian' || ! $soal->file_path) {
            return response()->json(['message' => 'Hanya soal yang disetujui dan memiliki PDF yang dapat dijadwalkan.'], 422);
        }
        if (SesiUjian::where('bank_soal_id', $soal->id)->exists()) {
            return response()->json(['message' => 'Soal ini sudah memiliki sesi ujian.'], 422);
        }

        $sesi = SesiUjian::create([
            'bank_soal_id' => $soal->id,
            'waktu_mulai' => $data['waktu_mulai'],
            'waktu_selesai' => $data['waktu_selesai'],
            'nama_ujian' => $data['nama_ujian'] ?? $soal->judul,
            'program_studi' => $data['program_studi'] ?? null,
            'keterangan' => $data['keterangan'] ?? null,
            'status' => $data['status'] ?? 'scheduled',
            'dibuat_oleh' => $request->user()->id,
        ]);
        $this->tokens->issue($sesi);
        ActivityLogger::log('sesi_ujian_dibuat', ['sesi_ujian_id' => $sesi->id], $soal->id, $request->user());
        return response()->json(['message' => 'Sesi ujian berhasil dibuat.', 'data' => $this->transform($sesi->load(['soal.mataKuliah', 'soal.dosen']))], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $sesi = SesiUjian::findOrFail($id);
        if (! in_array($sesi->status, ['draft', 'scheduled'], true) || $sesi->logAkses()->exists()) {
            return response()->json(['message' => 'Jadwal sesi tidak dapat diubah setelah ujian selesai atau diakses mahasiswa.'], 422);
        }
        $data = $request->validate([
            'waktu_mulai' => ['bail', 'required', 'date', $this->notBeforeCurrentMinute()],
            'waktu_selesai' => ['required', 'date', 'after:waktu_mulai'],
            'nama_ujian' => ['nullable', 'string', 'max:200'],
            'program_studi' => ['nullable', 'string', 'max:150'],
            'keterangan' => ['nullable', 'string', 'max:2000'],
        ]);
        $sesi->update($data);
        $sesi->update(['token_expires_at' => $sesi->waktu_selesai]);
        return response()->json(['message' => 'Jadwal sesi diperbarui.', 'data' => $this->transform($sesi->fresh(['soal.mataKuliah', 'soal.dosen']))]);
    }

    public function setStatus(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:scheduled,active,completed,cancelled,suspended'],
            'catatan' => ['nullable', 'string', 'max:1000'],
        ]);
        $sesi = SesiUjian::with('soal')->findOrFail($id);
        $allowedTransitions = [
            'draft' => ['scheduled', 'cancelled'],
            'scheduled' => ['active', 'cancelled', 'suspended'],
            'active' => ['suspended', 'completed'],
            'suspended' => ['active', 'cancelled', 'completed'],
            'completed' => [],
            'cancelled' => [],
        ];
        if (! in_array($data['status'], $allowedTransitions[$sesi->status] ?? [], true)) {
            return response()->json(['message' => 'Perubahan status sesi tidak diizinkan dari status saat ini.'], 422);
        }
        if ($data['status'] === 'active' && $sesi->soal?->status !== 'siap_ujian') {
            return response()->json(['message' => 'Sesi hanya dapat diaktifkan untuk soal yang disetujui.'], 422);
        }
        if ($data['status'] === 'active' && ! $sesi->peserta()->exists()) {
            return response()->json(['message' => 'Impor daftar peserta dengan NIM, nama, dan email kampus sebelum mengaktifkan sesi.'], 422);
        }
        if ($data['status'] === 'active' && (now()->lt($sesi->waktu_mulai) || now()->greaterThanOrEqualTo($sesi->waktu_selesai))) {
            return response()->json(['message' => 'Sesi hanya dapat diaktifkan dalam rentang waktu ujian.'], 422);
        }
        if ($data['status'] === 'active' && ! $this->tokens->current($sesi)) {
            return response()->json(['message' => 'QR sesi sudah dicabut atau kedaluwarsa. Rotasi token sebelum mengaktifkan sesi.'], 422);
        }
        if ($data['status'] === 'cancelled' && $sesi->logAkses()->exists()) {
            return response()->json(['message' => 'Sesi yang sudah memiliki aktivitas akses tidak dapat dibatalkan; tutup sesi sebagai selesai.'], 422);
        }
        if ($data['status'] === 'suspended' && trim((string) ($data['catatan'] ?? '')) === '') {
            return response()->json(['message' => 'Alasan penangguhan wajib diisi.'], 422);
        }
        if ($data['status'] === 'cancelled' && trim((string) ($data['catatan'] ?? '')) === '') {
            return response()->json(['message' => 'Alasan pembatalan wajib diisi.'], 422);
        }
        if ($data['status'] === 'scheduled' && now()->greaterThanOrEqualTo($sesi->waktu_selesai)) {
            return response()->json(['message' => 'Waktu selesai sesi sudah lewat. Ubah jadwal atau buat sesi baru.'], 422);
        }
        if (in_array($data['status'], ['cancelled', 'completed'], true)) {
            $this->tokens->revoke($sesi);
        }
        $sesi->update([
            'status' => $data['status'],
            'catatan_status' => $data['catatan'] ?? null,
        ]);
        ActivityLogger::log('status_sesi_ujian', ['sesi_ujian_id' => $sesi->id, 'status' => $data['status'], 'catatan' => $data['catatan'] ?? null], $sesi->bank_soal_id, $request->user());
        return response()->json(['message' => 'Status sesi diperbarui.', 'data' => $this->transform($sesi->fresh(['soal.mataKuliah', 'soal.dosen']))]);
    }

    public function rotateToken(Request $request, int $id): JsonResponse
    {
        $sesi = SesiUjian::findOrFail($id);
        if (in_array($sesi->status, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'Token sesi yang sudah selesai atau dibatalkan tidak dapat dirotasi.'], 422);
        }
        $this->tokens->issue($sesi);
        ActivityLogger::log('token_sesi_dirotasi', ['sesi_ujian_id' => $sesi->id], $sesi->bank_soal_id, $request->user());
        return response()->json(['message' => 'Token QR berhasil dirotasi.', 'data' => $this->transform($sesi->fresh(['soal.mataKuliah', 'soal.dosen']))]);
    }

    public function revokeToken(Request $request, int $id): JsonResponse
    {
        $sesi = SesiUjian::findOrFail($id);
        if (in_array($sesi->status, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'Sesi terminal tidak dapat mengubah token.'], 422);
        }
        $this->tokens->revoke($sesi);
        ActivityLogger::log('token_sesi_dicabut', ['sesi_ujian_id' => $sesi->id], $sesi->bank_soal_id, $request->user());
        return response()->json(['message' => 'Token QR dicabut. QR lama tidak lagi berlaku.']);
    }

    public function extend(Request $request, int $id): JsonResponse
    {
        $sesi = SesiUjian::findOrFail($id);
        if ($sesi->status !== 'active' || now()->greaterThanOrEqualTo($sesi->waktu_selesai)) {
            return response()->json(['message' => 'Hanya sesi yang sedang aktif dapat diperpanjang sebelum waktu berakhir.'], 422);
        }
        $data = $request->validate([
            'waktu_selesai' => ['required', 'date', 'after:'.$sesi->waktu_selesai->format('Y-m-d H:i:s')],
            'catatan' => ['required', 'string', 'max:1000'],
        ]);
        $sesi->update(['waktu_selesai' => $data['waktu_selesai'], 'token_expires_at' => $data['waktu_selesai'], 'catatan_status' => $data['catatan']]);
        ActivityLogger::log('sesi_ujian_diperpanjang', ['sesi_ujian_id' => $sesi->id, 'waktu_selesai_baru' => $data['waktu_selesai'], 'catatan' => $data['catatan']], $sesi->bank_soal_id, $request->user());
        return response()->json(['message' => 'Waktu sesi diperpanjang.', 'data' => $this->transform($sesi->fresh(['soal.mataKuliah', 'soal.dosen']))]);
    }

    public function destroy(int $id): JsonResponse
    {
        $sesi = SesiUjian::findOrFail($id);
        if (! in_array($sesi->status, ['draft', 'scheduled', 'cancelled'], true) || $sesi->logAkses()->exists()) return response()->json(['message' => 'Hanya sesi draft/terjadwal/batal tanpa log akses yang dapat dihapus.'], 422);
        $sesi->delete();
        return response()->json(['message' => 'Sesi ujian dihapus.']);
    }

    public function logs(): JsonResponse
    {
        $logs = LogAksesUjian::with(['sesi.soal.mataKuliah'])
            ->orderByDesc('akses_terakhir_pada')->get()
            ->map(fn (LogAksesUjian $log) => [
                'id' => $log->id,
                'nim' => $log->nim,
                'nama' => $log->nama,
                'mata_kuliah' => $log->sesi?->soal?->mataKuliah?->nama_mk,
                'sesi_ujian_id' => $log->sesi_ujian_id,
                'akses_pertama_pada' => $log->akses_pertama_pada?->format('Y-m-d H:i:s'),
                'akses_terakhir_pada' => $log->akses_terakhir_pada?->format('Y-m-d H:i:s'),
                'jumlah_akses' => $log->jumlah_akses,
                'status_akses' => $log->status_akses,
            ]);
        return response()->json(['data' => $logs]);
    }

    private function transform(SesiUjian $sesi): array
    {
        $soal = $sesi->soal;
        return [
            'id' => $sesi->id,
            'bank_soal_id' => $sesi->bank_soal_id,
            'nama_mk' => $soal?->mataKuliah?->nama_mk,
            'kode_mk' => $soal?->mataKuliah?->kode_mk,
            'dosen' => $soal?->dosen?->nama,
            'kelas' => $soal?->mataKuliah?->kelas,
            'judul' => $soal?->judul,
            'nama_ujian' => $sesi->nama_ujian ?: $soal?->judul,
            'program_studi' => $sesi->program_studi,
            'keterangan' => $sesi->keterangan,
            'catatan_status' => $sesi->catatan_status,
            'jenis' => $soal?->jenis,
            'waktu_mulai' => $sesi->waktu_mulai?->format('Y-m-d H:i'),
            'waktu_selesai' => $sesi->waktu_selesai?->format('Y-m-d H:i'),
            'status' => $sesi->statusEfektif(),
            'token' => $this->tokens->current($sesi),
            'qr_url' => ($token = $this->tokens->current($sesi))
                ? rtrim((string) config('ebrankas.frontend_url'), '/').'#/akses/'.$token
                : null,
            'jumlah_akses' => $sesi->log_akses_count ?? $sesi->logAkses()->count(),
            'jumlah_peserta' => $sesi->peserta_count ?? $sesi->peserta()->count(),
        ];
    }

    /**
     * datetime-local hanya mengirim presisi menit. Bandingkan dengan awal
     * menit sekarang agar pilihan "sekarang" tidak ditolak hanya karena detik
     * server sudah berjalan beberapa detik lebih dulu.
     */
    private function notBeforeCurrentMinute(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            try {
                $start = \Illuminate\Support\Carbon::parse($value, config('app.timezone'));
            } catch (\Throwable) {
                $fail('Waktu mulai tidak valid.');
                return;
            }

            if ($start->lt(now()->startOfMinute())) {
                $fail('Waktu mulai harus sekarang atau waktu mendatang.');
            }
        };
    }
}
