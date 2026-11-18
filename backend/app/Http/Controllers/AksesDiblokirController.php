<?php

namespace App\Http\Controllers;

use App\Models\LogPelanggaranUjian;
use App\Models\PesertaSesiUjian;
use App\Services\ActivityLogger;
use App\Services\NotifikasiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AksesDiblokirController extends Controller
{
    public function terkunci(): JsonResponse
    {
        $rows = PesertaSesiUjian::with(['sesi.soal.mataKuliah', 'pemintaBuka'])
            ->whereNotNull('access_locked_at')
            ->orderByDesc('access_locked_at')
            ->get()
            ->map(fn (PesertaSesiUjian $peserta) => $this->transform($peserta));
        return response()->json(['data' => $rows]);
    }

    public function ajukanBuka(Request $request, int $pesertaId): JsonResponse
    {
        $data = $request->validate(['catatan' => ['required', 'string', 'min:5', 'max:500']]);
        $peserta = PesertaSesiUjian::with('sesi')->findOrFail($pesertaId);
        if (! $peserta->access_locked_at) return response()->json(['message' => 'Akses mahasiswa ini tidak sedang dikunci.'], 422);
        if ($peserta->unlock_requested_at) return response()->json(['message' => 'Permintaan bantuan Admin IT untuk mahasiswa ini sudah dikirim.'], 422);
        if (! $peserta->sesi || ! $peserta->sesi->bisaDiakses()) return response()->json(['message' => 'Sesi sudah tidak aktif; akses tidak dapat dibuka kembali.'], 422);

        $peserta->update([
            'unlock_requested_at' => now(),
            'unlock_requested_by' => $request->user()->id,
            'unlock_request_note' => trim($data['catatan']),
        ]);
        LogPelanggaranUjian::create([
            'peserta_sesi_ujian_id' => $peserta->id,
            'sesi_ujian_id' => $peserta->sesi_ujian_id,
            'jenis' => 'panitia_minta_buka',
            'pelanggaran_ke' => $peserta->pelanggaran_count,
            'catatan' => trim($data['catatan']),
            'terjadi_pada' => now(),
            'ip_address' => $request->ip(),
        ]);

        NotifikasiService::keRoles(
            ['admin_it'],
            'Permintaan buka akses ujian',
            "Panitia meminta pemeriksaan akses {$peserta->nama} (NIM {$peserta->nim}). Alasan: ".trim($data['catatan']),
            'peringatan',
            'Pengawasan Ujian',
        );

        return response()->json(['message' => 'Permintaan bantuan sudah dikirim kepada Admin IT.']);
    }

    public function permintaanAdmin(): JsonResponse
    {
        $rows = PesertaSesiUjian::with(['sesi.soal.mataKuliah', 'pemintaBuka'])
            ->whereNotNull('access_locked_at')
            ->whereNotNull('unlock_requested_at')
            ->orderBy('unlock_requested_at')
            ->get()
            ->map(fn (PesertaSesiUjian $peserta) => $this->transform($peserta));
        return response()->json(['data' => $rows]);
    }

    public function bukaAkses(Request $request, int $pesertaId): JsonResponse
    {
        $data = $request->validate(['catatan' => ['required', 'string', 'min:5', 'max:500']]);
        $result = DB::transaction(function () use ($request, $pesertaId, $data) {
            $peserta = PesertaSesiUjian::with('sesi')->lockForUpdate()->findOrFail($pesertaId);
            if (! $peserta->access_locked_at || ! $peserta->unlock_requested_at) {
                return ['error' => 'Tidak ada permintaan buka akses yang menunggu untuk mahasiswa ini.'];
            }
            if (! $peserta->sesi || ! $peserta->sesi->bisaDiakses()) {
                return ['error' => 'Sesi sudah tidak aktif; akses tidak dapat dibuka kembali.'];
            }

            $requestNote = $peserta->unlock_request_note;
            $requesterId = $peserta->unlock_requested_by;
            $peserta->update([
                'pelanggaran_count' => 0,
                'access_locked_at' => null,
                'unlock_requested_at' => null,
                'unlock_requested_by' => null,
                'unlock_processed_at' => now(),
                'unlock_processed_by' => $request->user()->id,
                'unlock_request_note' => null,
                'verified_token_hash' => null,
                'verified_token_expires_at' => null,
                'verified_at' => null,
            ]);
            LogPelanggaranUjian::create([
                'peserta_sesi_ujian_id' => $peserta->id,
                'sesi_ujian_id' => $peserta->sesi_ujian_id,
                'jenis' => 'admin_it_membuka_akses',
                'pelanggaran_ke' => 0,
                'catatan' => mb_substr('Permintaan: '.($requestNote ?? '-').' | Tindakan Admin IT: '.trim($data['catatan']), 0, 500),
                'terjadi_pada' => now(),
                'ip_address' => $request->ip(),
            ]);
            return ['peserta' => $peserta, 'requester_id' => $requesterId];
        });

        if (isset($result['error'])) return response()->json(['message' => $result['error']], 422);

        $peserta = $result['peserta'];
        if ($result['requester_id']) {
            NotifikasiService::keUser(
                $result['requester_id'],
                'Akses ujian dibuka kembali',
                "Admin IT telah membuka akses {$peserta->nama} (NIM {$peserta->nim}). Mahasiswa perlu verifikasi OTP kembali.",
                'info',
                'Log Akses Ujian',
            );
        }
        return response()->json(['message' => 'Akses dibuka. Mahasiswa harus verifikasi OTP kembali.']);
    }

    public function hapusPermintaanLama(Request $request, int $pesertaId): JsonResponse
    {
        $peserta = PesertaSesiUjian::with('sesi')->findOrFail($pesertaId);
        if (! $peserta->unlock_requested_at) {
            return response()->json(['message' => 'Permintaan ini sudah tidak ada.'], 422);
        }
        $statusSesi = $peserta->sesi?->statusEfektif();
        if (! in_array($statusSesi, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'Permintaan hanya dapat dibersihkan setelah sesi ujian berakhir atau dibatalkan.'], 422);
        }

        $peserta->update([
            'unlock_requested_at' => null,
            'unlock_requested_by' => null,
            'unlock_request_note' => null,
        ]);
        ActivityLogger::log('permintaan_buka_akses_dibersihkan', [
            'peserta_sesi_ujian_id' => $peserta->id,
            'nama' => $peserta->nama,
            'nim' => $peserta->nim,
        ], null, $request->user());

        return response()->json(['message' => 'Permintaan lama dibersihkan. Data peserta dan log audit tetap tersimpan.']);
    }

    private function transform(PesertaSesiUjian $peserta): array
    {
        return [
            'id' => $peserta->id,
            'nama' => $peserta->nama,
            'nim' => $peserta->nim,
            'nama_ujian' => $peserta->sesi?->nama_ujian,
            'mata_kuliah' => $peserta->sesi?->soal?->mataKuliah?->nama_mk,
            'kelas' => $peserta->sesi?->soal?->mataKuliah?->kelas,
            'sesi_ujian_id' => $peserta->sesi_ujian_id,
            'pelanggaran_count' => $peserta->pelanggaran_count,
            'access_locked_at' => $peserta->access_locked_at?->format('Y-m-d H:i:s'),
            'unlock_requested_at' => $peserta->unlock_requested_at?->format('Y-m-d H:i:s'),
            'unlock_request_note' => $peserta->unlock_request_note,
            'peminta' => $peserta->pemintaBuka?->nama,
            'sesi_aktif' => (bool) $peserta->sesi?->bisaDiakses(),
            'sesi_selesai' => in_array($peserta->sesi?->statusEfektif(), ['completed', 'cancelled'], true),
        ];
    }
}
