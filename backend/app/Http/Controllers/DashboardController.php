<?php

namespace App\Http\Controllers;

use App\Models\BankSoal;
use App\Models\LogAktivitas;
use App\Models\SesiUjian;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Statistik ringkasan, disesuaikan dengan peran pengguna.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return match ($user->role) {
            'dosen' => $this->dosenStats($user->id),
            'kaprodi' => $this->kaprodiStats(),
            'panitia' => $this->panitiaStats(),
            default => $this->adminStats(),
        };
    }

    private function dosenStats(int $userId): JsonResponse
    {
        $soal = BankSoal::where('user_id', $userId)->get();

        return response()->json([
            'role' => 'dosen',
            'cards' => [
                ['label' => 'Total Soal Saya', 'value' => $soal->count()],
                ['label' => 'Menunggu Persetujuan', 'value' => $soal->where('status', 'terkunci')->count()],
                ['label' => 'Terkunci', 'value' => $soal->where('status', 'terkunci')->count()],
                ['label' => 'Diarsip', 'value' => $soal->where('status', 'arsip')->count()],
            ],
            'aktivitas' => LogAktivitas::where('user_id', $userId)
                ->orderByDesc('waktu')->limit(10)->get()
                ->map(fn (LogAktivitas $l) => [
                    'aksi' => $l->aksi,
                    'waktu' => optional($l->waktu)->format('d M Y H:i'),
                ]),
        ]);
    }

    private function kaprodiStats(): JsonResponse
    {
        $totalMk = DB::table('mata_kuliah')->count();
        $sudahUpload = DB::table('bank_soal')->distinct('mk_id')->count('mk_id');
        $revisiMenunggu = DB::table('revisi_soal')->where('status', 'menunggu')->count();

        return response()->json([
            'role' => 'kaprodi',
            'cards' => [
                ['label' => 'Mata Kuliah', 'value' => $totalMk],
                ['label' => 'Sudah Upload', 'value' => $sudahUpload],
                ['label' => 'Belum Upload', 'value' => max(0, $totalMk - $sudahUpload)],
                ['label' => 'Revisi Menunggu', 'value' => $revisiMenunggu],
            ],
        ]);
    }

    private function panitiaStats(): JsonResponse
    {
        $siapUjian = BankSoal::where('status', 'siap_ujian')->whereNotNull('file_path')->count();
        $totalUjian = SesiUjian::count();
        $sesiAktif = SesiUjian::where('status', 'active')->where('waktu_selesai', '>', now())->count();

        return response()->json([
            'role' => 'panitia',
            'cards' => [
                ['label' => 'Siap Ujian Online', 'value' => $siapUjian],
                ['label' => 'Total Ujian', 'value' => $totalUjian],
                ['label' => 'Sesi Aktif', 'value' => $sesiAktif],
            ],
        ]);
    }

    private function adminStats(): JsonResponse
    {
        return response()->json([
            'role' => 'admin_it',
            'cards' => [
                ['label' => 'Total Pengguna', 'value' => DB::table('users')->count()],
                ['label' => 'Pengguna Aktif', 'value' => DB::table('users')->where('is_active', true)->count()],
                ['label' => 'Aktivitas 24 Jam', 'value' => LogAktivitas::where('waktu', '>=', now()->subDay())->count()],
                ['label' => 'Akses Isi Soal', 'value' => 'Terlarang'],
            ],
        ]);
    }
}
