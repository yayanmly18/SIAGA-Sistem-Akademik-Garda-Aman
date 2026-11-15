<?php

namespace App\Http\Controllers;

use App\Models\BankSoal;
use App\Models\LogAktivitas;
use App\Models\LogCetak;
use Dompdf\Dompdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class LaporanController extends Controller
{
    /**
     * Berita Acara Ujian Online (PDF): rekap pengumpulan soal + riwayat ujian online.
     * Hanya untuk Kaprodi. Dikirim sebagai unduhan (bukan disimpan di klien).
     */
    public function beritaAcara(Request $request): Response
    {
        $rekap = DB::table('mata_kuliah')
            ->leftJoin('bank_soal', 'bank_soal.mk_id', '=', 'mata_kuliah.id')
            ->leftJoin('users', 'users.id', '=', 'bank_soal.user_id')
            ->select(
                'mata_kuliah.kode_mk',
                'mata_kuliah.nama_mk',
                'mata_kuliah.kelas',
                'users.nama as dosen',
                'bank_soal.status',
                'bank_soal.jenis',
                'bank_soal.jadwal_ujian',
                'bank_soal.durasi_menit',
            )
            ->orderBy('mata_kuliah.kode_mk')
            ->get();

        $logUjian = LogAktivitas::whereIn('aksi', ['akses_soal_qr', 'akses_soal_qr_ditolak', 'status_sesi_ujian', 'token_sesi_dirotasi'])
            ->with(['bankSoal.mataKuliah', 'user'])
            ->orderByDesc('waktu')
            ->limit(200)
            ->get();

        $totalMk = $rekap->count();
        $sudahUpload = $rekap->whereNotNull('status')->count();
        $belumUpload = $totalMk - $sudahUpload;
        $sudahUjian = $rekap->whereIn('status', ['dibuka', 'selesai', 'arsip'])->count();

        $html = view('laporan.berita_acara', [
            'rekap' => $rekap,
            'logUjian' => $logUjian,
            'totalMk' => $totalMk,
            'sudahUpload' => $sudahUpload,
            'belumUpload' => $belumUpload,
            'sudahUjian' => $sudahUjian,
            'penanggungJawab' => $request->user(),
            'dibuatPada' => now(),
        ])->render();

        $dompdf = new Dompdf(['isRemoteEnabled' => false]);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $filename = 'berita-acara-ujian-online-'.now()->format('Ymd-His').'.pdf';

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }
}
