<?php

return [
    'frontend_url' => env('SIKASA_FRONTEND_URL', 'http://localhost:8443'),
    /*
    |--------------------------------------------------------------------------
    | Konfigurasi Percetakan E-Brankas
    |--------------------------------------------------------------------------
    |
    | Job cetak ditulis sebagai PDF ber-watermark ke folder spool di server,
    | lalu (opsional) dikirim ke printer jaringan lewat perintah OS. File TIDAK
    | PERNAH dikirim ke perangkat petugas/TU — hanya dicetak di sisi server.
    |
    | print_command: perintah shell untuk mengirim PDF ke printer.
    |   Placeholder {file} diganti path PDF spool, {printer} nama/alamat printer.
    |   Contoh:
    |     Windows SumatraPDF : 'SumatraPDF.exe -print-to "{printer}" "{file}"'
    |     Windows PDFtoPrinter: 'PDFtoPrinter.exe "{file}" "{printer}"'
    |     Windows PowerShell (tanpa tools tambahan, pakai PDF reader default):
    |       'powershell -NoProfile -Command "Start-Process -FilePath \'{file}\' -Verb PrintTo \'{printer}\'"'
    |     Linux   : 'lp -d {printer} "{file}"'
    |   Kosongkan (null) untuk mode "spool saja" (PDF disimpan, tanpa kirim OS).
    |
    */
    'spool_path' => env('EBRANKAS_SPOOL_PATH', storage_path('app/spool')),

    'print_command' => env('EBRANKAS_PRINT_COMMAND', null),

    // Batas waktu (detik) menjalankan perintah printer.
    'command_timeout' => (int) env('EBRANKAS_PRINT_TIMEOUT', 60),

    /*
    |--------------------------------------------------------------------------
    | Cadangan Otomatis (Backup)
    |--------------------------------------------------------------------------
    |
    | Dijadwalkan harian jam backup_jadwal via Console Kernel
    | ($schedule->command('backup:run')). Berkas ZIP disimpan di backup_path
    | (default: folder `backup/` di root proyek) dengan retensi backup_retensi
    | berkas terbaru; riwayat sukses/gagal dicatat di tabel `backup_logs`
    | dan ditampilkan di halaman Admin IT → Status Server.
    |
    */
    'backup_jadwal' => env('EBRANKAS_BACKUP_JADWAL', '02:00'),

    'backup_path' => env('EBRANKAS_BACKUP_PATH', null),

    'backup_retensi' => (int) env('EBRANKAS_BACKUP_RETENSI', 14),
];
