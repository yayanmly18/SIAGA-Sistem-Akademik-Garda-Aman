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
            @mkdir($dir, 0700, true);
        }
        @chmod($dir, 0700);

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
        $zip = null;

        try {
            $password = (string) config('ebrankas.backup_password', '');
            if (strlen($password) < 32) {
                throw new RuntimeException('EBRANKAS_BACKUP_PASSWORD wajib diatur dengan rahasia minimal 32 karakter.');
            }

            if (! @mkdir($kerja, 0700, true)) {
                throw new RuntimeException('Tidak dapat membuat direktori kerja sementara.');
            }

            $dumpSql = $kerja.DIRECTORY_SEPARATOR.'database.sql';
            $this->dumper->dumpKeFile($dumpSql);

            $zip = new ZipArchive();
            if ($zip->open($pathZip, ZipArchive::CREATE) !== true) {
                throw new RuntimeException('Tidak dapat membuat arsip ZIP: '.$pathZip);
            }
            if (! $zip->setPassword($password)) {
                throw new RuntimeException('Ekstensi ZIP tidak dapat mengatur kata sandi backup.');
            }

            if (! $zip->addFile($dumpSql, 'database.sql') || ! $zip->setEncryptionName('database.sql', ZipArchive::EM_AES_256)) {
                throw new RuntimeException('Tidak dapat mengenkripsi dump database dengan AES-256.');
            }

            $diskSoal = storage_path('app'.DIRECTORY_SEPARATOR.'soal');
            $jumlahSoal = $this->arsipkanDirektori($zip, $diskSoal, 'soal/');

            if (! $zip->close()) {
                throw new RuntimeException('Gagal menutup arsip ZIP.');
            }
            $zip = null;

            @chmod($pathZip, 0600);
            $ukuran = filesize($pathZip) ?: null;
            $dihapus = self::rapikan((int) config('ebrankas.backup_retensi', 14));

            return $this->catat('sukses', $nama, $ukuran, 'Dump database + '.$jumlahSoal.' berkas soal terenkripsi'.($dihapus ? '; merapikan '.count($dihapus).' cadangan lama' : ''));
        } catch (\Throwable $e) {
            if ($zip instanceof ZipArchive) {
                @$zip->close();
            }
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
            $namaDalamZip = $awalanZip.str_replace(DIRECTORY_SEPARATOR, '/', $relatif);
            if (! $zip->addFile($file->getPathname(), $namaDalamZip)
                || ! $zip->setEncryptionName($namaDalamZip, ZipArchive::EM_AES_256)) {
                throw new RuntimeException('Tidak dapat mengenkripsi berkas soal untuk backup.');
            }
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
