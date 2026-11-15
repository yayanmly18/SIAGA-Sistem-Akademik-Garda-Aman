<?php

namespace App\Http\Controllers;

use App\Models\BackupLog;
use App\Models\Printer;
use App\Services\BackupService;
use App\Services\SystemMetrics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * Status infrastruktur untuk halaman Admin IT → Status Server.
 *
 * Semua angka diukur langsung saat request: CPU & RAM dari OS, disk dari
 * PHP, MySQL via perintah ringan SELECT 1, printer via PrinterController
 * (DB + deteksi Windows), backup dari tabel backup_logs. Bila sesuatu tak
 * terukur, nilainya null dan UI menampilkan "—" (jujur, bukan angka palsu).
 */
class ServerStatusController extends Controller
{
    /**
     * Ringkasan metrik + layanan + backup terakhir untuk halaman admin.
     */
    public function status(Request $request): JsonResponse
    {
        $mulai = microtime(true);

        $cpu = SystemMetrics::cpuPersen();

        $mem = SystemMetrics::memori();
        $memoriPersen = ($mem['total'] && $mem['tersedia'] !== null)
            ? (int) round(($mem['total'] - $mem['tersedia']) / $mem['total'] * 100)
            : null;

        $jalurSoal = storage_path('app'.DIRECTORY_SEPARATOR.'soal');
        $disk = SystemMetrics::disk(storage_path());

        $layanan = [
            $this->cekAplikasi($request, $mulai),
            $this->cekDatabase(),
            $this->cekStorage($jalurSoal, $disk),
            $this->cekPrinterGateway(),
        ];

        return response()->json([
            'cpu' => [
                'persen' => $cpu,
            ],
            'memori' => [
                'total' => $mem['total'],
                'tersedia' => $mem['tersedia'],
                'persen' => $memoriPersen,
            ],
            'disk' => $disk,
            'layanan' => $layanan,
            'backup' => $this->ringkasanBackup(),
            'waktu_server' => now()->toIso8601String(),
        ]);
    }

    /**
     * Jalankan backup sekarang (tombol "Jalankan Backup" di Status Server).
     * Eksekusi sinkron via command yang sama dengan scheduler jam 02:00.
     */
    public function jalankanBackup(): JsonResponse
    {
        Artisan::call('backup:run');
        $baris = BackupLog::latest()->first();

        return response()->json([
            'message' => $baris && $baris->status === 'sukses'
                ? 'Backup selesai dan tercatat.'
                : 'Backup gagal — lihat detail pada kartu Backup.',
            'backup' => $this->ringkasanBackup(),
        ], 201);
    }

    /** Application Server: bukti backend menjawab + waktu responsnya. */
    private function cekAplikasi(Request $request, float $mulai): array
    {
        $ms = max(1, (int) round((microtime(true) - $mulai) * 1000));

        return [
            'nama' => 'Application Server',
            'alamat' => (string) $request->getSchemeAndHttpHost(),
            'status' => 'aktif',
            'detail' => $ms.' ms',
        ];
    }

    /** Database MySQL: perintah ringan SELECT 1 diukur waktunya. */
    private function cekDatabase(): array
    {
        try {
            $mulai = microtime(true);
            DB::select('SELECT 1 AS ok');
            $ms = max(1, (int) round((microtime(true) - $mulai) * 1000));
            $nama = DB::connection()->getDatabaseName();

            return [
                'nama' => 'Database MySQL',
                'alamat' => config('database.connections.mysql.host').':'.config('database.connections.mysql.port').' / '.$nama,
                'status' => 'aktif',
                'detail' => $ms.' ms',
            ];
        } catch (\Throwable $e) {
            return [
                'nama' => 'Database MySQL',
                'alamat' => (string) config('database.connections.mysql.host'),
                'status' => 'tertutup',
                'detail' => 'Tidak dapat terhubung',
            ];
        }
    }

    /** Encrypted Storage: folder soal terenkripsi + persen disk terpakai. */
    private function cekStorage(string $jalurSoal, array $disk): array
    {
        $ada = is_dir($jalurSoal);
        if (! $ada) {
            @mkdir($jalurSoal, 0775, true);
            $ada = is_dir($jalurSoal);
        }

        return [
            'nama' => 'Encrypted Storage',
            'alamat' => '/storage/app/soal',
            'status' => ($ada && is_writable($jalurSoal)) ? 'aktif' : 'tertutup',
            'detail' => $disk['persen'].'% terpakai',
        ];
    }

    /**
     * Printer Gateway: ringkasan dari PrinterController::status() yang sudah
     * nyata (DB + deteksi Windows) — dipakai ulang lewat pemanggilan internal
     * agar tidak menduplikasi logika wmic.
     */
    private function cekPrinterGateway(): array
    {
        try {
            $data = (new PrinterController)->status()->getData(true);
            $daftar = $data['data'] ?? [];
            $jumlahOnline = count(array_filter($daftar, static fn ($p) => ! empty($p['online'])));
            $jumlah = count($daftar);

            if ($jumlah === 0) {
                return [
                    'nama' => 'Printer Gateway',
                    'alamat' => 'belum ada printer terdaftar',
                    'status' => 'periksa',
                    'detail' => 'Daftarkan printer di Kelola Printer',
                ];
            }

            return [
                'nama' => 'Printer Gateway',
                'alamat' => $jumlahOnline.' dari '.$jumlah.' printer online',
                'status' => $jumlahOnline > 0 ? 'aktif' : 'tertutup',
                'detail' => $jumlahOnline > 0 ? 'Siap menerima' : 'Semua printer offline',
            ];
        } catch (\Throwable $e) {
            return [
                'nama' => 'Printer Gateway',
                'alamat' => 'pemeriksaan gagal',
                'status' => 'periksa',
                'detail' => 'Tidak dapat memeriksa printer',
            ];
        }
    }

    /** Ringkasan backup terakhir dari tabel backup_logs. */
    private function ringkasanBackup(): array
    {
        $jadwal = (string) config('ebrankas.backup_jadwal', '02:00');
        $terakhir = BackupLog::latest()->first();

        if (! $terakhir) {
            return [
                'status' => 'belum',
                'waktu' => null,
                'ukuran' => null,
                'jadwal' => $jadwal,
            ];
        }

        $ukuranBerkas = null;
        if ($terakhir->path) {
            $penuh = BackupService::direktori().DIRECTORY_SEPARATOR.$terakhir->path;
            if (is_file($penuh)) {
                $ukuranBerkas = filesize($penuh) ?: null;
            }
        }

        return [
            'status' => $terakhir->status,
            'waktu' => $terakhir->created_at?->toIso8601String(),
            'ukuran' => $ukuranBerkas ?? $terakhir->ukuran_bytes,
            'jadwal' => $jadwal,
        ];
    }
}
