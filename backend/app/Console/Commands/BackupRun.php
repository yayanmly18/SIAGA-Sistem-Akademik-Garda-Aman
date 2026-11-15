<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

/**
 * Command cadangan E-Brankas: dump database + arsip soal terenkripsi.
 * Dijadwalkan jam 02:00 (Kernel) & bisa dipicu manual dari halaman admin.
 */
class BackupRun extends Command
{
    protected $signature = 'backup:run';

    protected $description = 'Buat cadangan database + berkas soal terenkripsi (dicatat di backup_logs).';

    public function handle(BackupService $backup): int
    {
        $this->info('Menjalankan backup E-Brankas...');

        $hasil = $backup->jalankan();

        if ($hasil->status === 'sukses') {
            $this->info('Backup sukses: '.$hasil->path.' ('.$hasil->detail.')');

            return self::SUCCESS;
        }

        $this->error('Backup gagal: '.$hasil->detail);

        return self::FAILURE;
    }
}
