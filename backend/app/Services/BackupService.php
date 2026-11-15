<?php

namespace App\Services;

use App\Models\BackupLog;
use RuntimeException;
use ZipArchive;

/**
 * Layanan cadangan (backup) E-Brankas: dump database + arsip file soal
 * terenkripsi menjadi satu berkas ZIP, dicatat di tabel `backup_logs`.
 *
 * Keluarannya bisa dipakai command terjadwal (backup:run), tombol
 * "Jalankan Backup" di halaman Status Server, maupun scheduler jam 02:00.
 */
class BackupService
{
    public function __construct(private readonly SqlDumper $dumper)
    {
    }

    /** Direktori penyimpanan cadangan (folder `backup/` di root proyek). */
    public static function direktori(): string
    {
        $dir = rtrim((string) config('ebrankas.backup_path', ''), "/\\");
        if ($dir === '') {
            $dir = dirname(base_path()).DIRECTORY_SEPARATOR.'backup';
        }

        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        return $dir;
    }

    /** Nama berkas baku: ebrankas-backup-YYYYMMDD-HHMMSS.zip */
    public static function namaBerkas(?int $waktu = null): string
    {
        return 'ebrankas-backup-'.date('Ymd-His', $waktu ?? time()).'.zip';
    }

    /** Hapus cadangan lama, sisakan N berkas terbaru. @return string[] yang dihapus */
    public static function rapikan(int $sisakan = 14): array
    {
        $dir = self::direktori();
        $berkas = glob($dir.DIRECTORY_SEPARATOR.'ebrankas-backup-*.zip') ?: [];
        rsort($berkas);
        $dihapus = [];
        foreach (array_slice($berkas, max(0, $sisakan)) as $lama) {
            if (@unlink($lama)) {
                $dihapus[] = basename($lama);
            }
        }

        return $dihapus;
    }

    /**
     * Jalankan backup penuh dan catat hasilnya. Selalu mengembalikan model
     * BackupLog (status sukses/gagal) — kegagalan tidak melempar agar bisa
     * dipanggil scheduler tanpa mengganggu job lain.
     */
    public function jalankan(): BackupLog
    {
        $dir = self::direktori();
        if (! is_dir($dir)) {
            return $this->catat('gagal', null, null, 'Direktori backup tidak dapat dibuat: '.$dir);
        }

        $nama = self::namaBerkas();
        $pathZip = $dir.DIRECTORY_SEPARATOR.$nama;
        $kerja = sys_get_temp_dir().DIRECTORY_SEPARATOR.'ebk-dump-'.uniqid();

        try {
            if (! @mkdir($kerja, 0775, true)) {
                throw new RuntimeException('Tidak dapat membuat direktori kerja sementara.');
            }

            $dumpSql = $kerja.DIRECTORY_SEPARATOR.'database.sql';
            $this->dumper->dumpKeFile($dumpSql);

            $zip = new ZipArchive();
            if ($zip->open($pathZip, ZipArchive::CREATE) !== true) {
                throw new RuntimeException('Tidak dapat membuat arsip ZIP: '.$pathZip);
            }

            $zip->addFile($dumpSql, 'database.sql');

            $diskSoal = storage_path('app'.DIRECTORY_SEPARATOR.'soal');
            $jumlahSoal = $this->arsipkanDirektori($zip, $diskSoal, 'soal/');

            if (! $zip->close()) {
                throw new RuntimeException('Gagal menutup arsip ZIP.');
            }

            $ukuran = filesize($pathZip) ?: null;
            $dihapus = self::rapikan((int) config('ebrankas.backup_retensi', 14));

            return $this->catat('sukses', $nama, $ukuran, 'Dump database + '.$jumlahSoal.' berkas soal terenkripsi'.($dihapus ? '; merapikan '.count($dihapus).' cadangan lama' : ''));
        } catch (\Throwable $e) {
            @unlink($pathZip);

            return $this->catat('gagal', $nama, null, 'Gagal: '.$e->getMessage());
        } finally {
            $this->hapusDirektori($kerja);
        }
    }

    private function catat(string $status, ?string $nama, ?int $ukuran, string $detail): BackupLog
    {
        return BackupLog::create([
            'status' => $status,
            'path' => $nama,
            'ukuran_bytes' => $ukuran,
            'detail' => $detail !== '' ? $detail : null,
        ]);
    }

    /** Masukkan seluruh isi direktori ke ZIP. @return int jumlah berkas */
    private function arsipkanDirektori(ZipArchive $zip, string $dir, string $awalanZip): int
    {
        if (! is_dir($dir)) {
            return 0;
        }

        $jumlah = 0;
        $iter = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iter as $file) {
            /** @var \SplFileInfo $file */
            if (! $file->isFile()) {
                continue;
            }
            $relatif = substr($file->getPathname(), strlen($dir) + 1);
            $zip->addFile($file->getPathname(), $awalanZip.str_replace(DIRECTORY_SEPARATOR, '/', $relatif));
            $jumlah++;
        }

        return $jumlah;
    }

    private function hapusDirektori(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        $iter = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iter as $file) {
            /** @var \SplFileInfo $file */
            $file->isDir() ? @rmdir($file->getPathname()) : @unlink($file->getPathname());
        }
        @rmdir($dir);
    }
}
