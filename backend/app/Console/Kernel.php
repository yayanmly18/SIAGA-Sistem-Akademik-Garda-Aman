<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use App\Models\SesiUjian;
use App\Services\ActivityLogger;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Cadangan harian jam 02:00 (ditampilkan di Status Server Admin IT).
        // Windows: jalankan `php artisan schedule:run` tiap menit via Task
        // Scheduler; Linux: cukup satu entri cron untuk schedule:run.
        $schedule->command('backup:run')->dailyAt('02:00')->withoutOverlapping();
        // Bersihkan token Sanctum yang telah kedaluwarsa agar tabel token tidak terus membesar.
        $schedule->command('sanctum:prune-expired --hours=24')->daily();

        // Tutup sesi secara persisten; API juga menolak akses tepat setelah waktu selesai.
        $schedule->call(function () {
            SesiUjian::with('soal')
                ->whereIn('status', ['draft', 'scheduled', 'active', 'suspended'])
                ->where('waktu_selesai', '<=', now())
                ->get()
                ->each(function (SesiUjian $sesi) {
                    $sesi->update(['status' => 'completed', 'token_revoked_at' => now(), 'token_encrypted' => null]);
                    ActivityLogger::log('status_sesi_ujian', [
                        'sesi_ujian_id' => $sesi->id,
                        'status' => 'completed_automatically',
                    ], $sesi->bank_soal_id);
                });
        })->everyMinute()->name('auto-close-exam-sessions')->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
