<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Penyalin (dump) database MySQL/MariaDB murni PHP.
 *
 * Dipilih daripada mysqldump agar backup tetap berjalan di server XAMPP
 * maupun hosting tanpa biner tambahan: cukup koneksi DB Laravel yang sudah
 * dikonfigurasi. Strategi:
 *  - baca struktur via SHOW CREATE TABLE (creat akurat, termasuk enum)
 *  - baca data via SELECT ber-chunk 500 baris agar hemat memori
 */
class SqlDumper
{
    /**
     * Tulis dump SQL lengkap ke file dan kembalikan path-nya.
     */
    public function dumpKeFile(string $pathFile): string
    {
        $pdo = DB::connection()->getPdo();
        $namaDb = DB::connection()->getDatabaseName();
        $tanggal = date('Y-m-d H:i:s');

        $handle = @fopen($pathFile, 'wb');
        if (! $handle) {
            throw new RuntimeException("Tidak dapat menulis file dump: {$pathFile}");
        }

        try {
            $tulis = function (string $teks) use ($handle): void {
                fwrite($handle, $teks);
            };

            $tulis("-- ============================================================\n");
            $tulis("-- E-Brankas Soal FEB — cadangan database `{$namaDb}`\n");
            $tulis("-- Dibuat: {$tanggal}\n");
            $tulis("-- ============================================================\n\n");
            $tulis("/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n");
            $tulis("/*!40101 SET NAMES utf8mb4 */;\n");
            $tulis("/*!40101 SET SQL_MODE='' */;\n\n");

            foreach ($this->daftarTabel($pdo) as $tabel) {
                $this->buangTabel($pdo, $tabel, $tulis);
            }

            $tulis("/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n");
        } finally {
            fclose($handle);
        }

        return $pathFile;
    }

    /** @return string[] */
    private function daftarTabel(\PDO $pdo): array
    {
        $baris = $pdo->query('SHOW FULL TABLES WHERE TABLE_TYPE = \'BASE TABLE\'')
            ->fetchAll(\PDO::FETCH_NUM);

        return array_map(static fn ($b) => (string) $b[0], $baris);
    }

    /** @param callable(string):void $tulis */
    private function buangTabel(\PDO $pdo, string $tabel, callable $tulis): void
    {
        $dikutip = '`'.str_replace('`', '``', $tabel).'`';

        $buat = $pdo->query('SHOW CREATE TABLE '.$dikutip)->fetch(\PDO::FETCH_ASSOC);
        $ddl = $buat['Create Table'] ?? null;
        if (! is_string($ddl)) {
            return;
        }

        $tulis("-- ------------------------------------------------------------\n");
        $tulis("-- Struktur tabel {$dikutip}\n");
        $tulis("-- ------------------------------------------------------------\n\n");
        $tulis("DROP TABLE IF EXISTS {$dikutip};\n\n");
        $tulis($ddl.";\n\n");

        $jumlah = (int) $pdo->query('SELECT COUNT(*) FROM '.$dikutip)->fetchColumn();
        if ($jumlah === 0) {
            return;
        }

        $tulis("-- Data tabel {$dikutip} ({$jumlah} baris)\n\n");

        $offset = 0;
        $ukuranChunk = 500;
        while ($offset < $jumlah) {
            $stmt = $pdo->query("SELECT * FROM {$dikutip} LIMIT {$ukuranChunk} OFFSET {$offset}");
            $baris = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            if (! $baris) {
                break;
            }
            $kolom = array_map(
                static fn ($k) => '`'.str_replace('`', '``', (string) $k).'`',
                array_keys($baris[0])
            );
            $tulis("INSERT INTO {$dikutip} (".implode(', ', $kolom).") VALUES\n");
            $nilaiBaris = [];
            foreach ($baris as $b) {
                $nilaiBaris[] = '('.implode(', ', array_map([$pdo, 'quote'], array_values($b))).')';
            }
            $tulis(implode(",\n", $nilaiBaris).";\n\n");
            $offset += count($baris);
        }
    }
}
