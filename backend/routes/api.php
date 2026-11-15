<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BankSoalController;
use App\Http\Controllers\AksesDiblokirController;
use App\Http\Controllers\TemplateSoalController;
use App\Http\Controllers\UjianOnlineController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LaporanController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\MataKuliahController;
use App\Http\Controllers\NotifikasiController;
use App\Http\Controllers\PengingatController;
use App\Http\Controllers\PrinterController;
use App\Http\Controllers\RevisiController;
use App\Http\Controllers\ServerStatusController;
use App\Http\Controllers\SesiUjianController;
use App\Http\Controllers\PesertaSesiUjianController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — SIKASA FEB (Sistem Informasi Keamanan Soal Akademik)
|--------------------------------------------------------------------------
| Autentikasi: Laravel Sanctum (Bearer Token). Setiap peran dibatasi dengan
| middleware 'role:...' (CheckRole).
*/

// --- Publik: login ---
Route::post('/login', [AuthController::class, 'login']);
// Token QR berfungsi sebagai akses terbatas ke PDF selama waktu ujian.
Route::get('/ujian-online/akses/{token}', [UjianOnlineController::class, 'aksesViaQr'])->middleware('throttle:30,1')->name('ujian.akses');
Route::post('/ujian-online/akses/{token}/otp', [UjianOnlineController::class, 'requestOtp'])->middleware('throttle:10,1');
Route::post('/ujian-online/akses/{token}/verifikasi', [UjianOnlineController::class, 'verifyOtp'])->middleware('throttle:10,1');
Route::post('/ujian-online/akses/{token}/heartbeat', [UjianOnlineController::class, 'heartbeat'])->middleware('throttle:12,1');
Route::post('/ujian-online/akses/{token}/pelanggaran', [UjianOnlineController::class, 'recordViolation'])->middleware('throttle:10,1');
Route::post('/ujian-online/akses/{token}/pdf', [UjianOnlineController::class, 'pdfViaQr'])->middleware('throttle:30,1');

// --- Terautentikasi ---
Route::middleware('auth:sanctum')->group(function () {
    // Auth & profil
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Dashboard (semua peran, isi disesuaikan)
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Mata kuliah (referensi dropdown; CRUD oleh Kaprodi & Admin IT)
    Route::get('/mata-kuliah', [MataKuliahController::class, 'index']);
    Route::middleware('role:kaprodi,admin_it')->group(function () {
        Route::post('/mata-kuliah', [MataKuliahController::class, 'store']);
        Route::put('/mata-kuliah/{id}', [MataKuliahController::class, 'update']);
        Route::delete('/mata-kuliah/{id}', [MataKuliahController::class, 'destroy']);
    });

    // --- Template Soal (Admin IT upload, semua role lihat & unduh) ---
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/template-soal', [TemplateSoalController::class, 'index']);
        Route::get('/template-soal/{id}/download', [TemplateSoalController::class, 'download']);
    });
    Route::middleware('role:admin_it')->group(function () {
        Route::post('/template-soal', [TemplateSoalController::class, 'store']);
        Route::delete('/template-soal/{id}', [TemplateSoalController::class, 'destroy']);
    });

    // --- Dosen ---
    Route::middleware('role:dosen')->group(function () {
        Route::get('/soal-saya', [BankSoalController::class, 'index']);
        Route::post('/soal', [BankSoalController::class, 'store']);
        Route::post('/soal/{id}/revisi', [RevisiController::class, 'store']);
    });

    // --- Kaprodi ---
    Route::middleware('role:kaprodi')->group(function () {
        Route::get('/rekap', [BankSoalController::class, 'rekap']);
        Route::get('/soal/{id}/preview-persetujuan', [BankSoalController::class, 'previewUntukPersetujuan']);
        Route::patch('/soal/{id}/persetujuan', [BankSoalController::class, 'putuskanPersetujuan']);
        Route::get('/revisi', [RevisiController::class, 'index']);
        Route::patch('/revisi/{id}', [RevisiController::class, 'putuskan']);
        Route::get('/log/cetak', [LogController::class, 'cetak']);
        Route::post('/pengingat/kirim', [PengingatController::class, 'kirim']);
        Route::get('/laporan/berita-acara', [LaporanController::class, 'beritaAcara']);
    });

    // --- Sesi ujian, QR dan audit akses (khusus Panitia/TU) ---
    Route::middleware('role:panitia')->group(function () {
        Route::get('/soal-disetujui', [SesiUjianController::class, 'soalDisetujui']);
        Route::get('/sesi-ujian', [SesiUjianController::class, 'index']);
        Route::post('/sesi-ujian', [SesiUjianController::class, 'store']);
        Route::put('/sesi-ujian/{id}', [SesiUjianController::class, 'update']);
        Route::patch('/sesi-ujian/{id}/status', [SesiUjianController::class, 'setStatus']);
        Route::post('/sesi-ujian/{id}/rotasi-token', [SesiUjianController::class, 'rotateToken']);
        Route::post('/sesi-ujian/{id}/cabut-token', [SesiUjianController::class, 'revokeToken']);
        Route::patch('/sesi-ujian/{id}/perpanjang', [SesiUjianController::class, 'extend']);
        Route::post('/sesi-ujian/{id}/peserta', [PesertaSesiUjianController::class, 'import']);
        Route::delete('/sesi-ujian/{id}/peserta', [PesertaSesiUjianController::class, 'destroyAll']);
        Route::delete('/sesi-ujian/{id}', [SesiUjianController::class, 'destroy']);
        Route::get('/log-akses-ujian', [SesiUjianController::class, 'logs']);
        Route::get('/pelanggaran-ujian', [AksesDiblokirController::class, 'terkunci']);
        Route::post('/pelanggaran-ujian/{pesertaId}/minta-buka', [AksesDiblokirController::class, 'ajukanBuka']);
    });

    // --- Manajemen Printer (khusus Admin IT) ---
    Route::middleware('role:admin_it')->group(function () {
        Route::get('/permintaan-buka-akses', [AksesDiblokirController::class, 'permintaanAdmin']);
        Route::post('/permintaan-buka-akses/{pesertaId}/buka', [AksesDiblokirController::class, 'bukaAkses']);
        Route::get('/printers', [PrinterController::class, 'index']);
        Route::get('/printers/scan', [PrinterController::class, 'scan']);
        Route::post('/printers', [PrinterController::class, 'store']);
        Route::put('/printers/{id}', [PrinterController::class, 'update']);
        Route::patch('/printers/{id}/toggle', [PrinterController::class, 'toggle']);
        Route::delete('/printers/{id}', [PrinterController::class, 'destroy']);

        // --- Status Server: metrik nyata OS/DB/printer/backup ---
        Route::get('/server-status', [ServerStatusController::class, 'status']);
        Route::post('/server-status/backup', [ServerStatusController::class, 'jalankanBackup']);
    });

    // --- Log aktivitas (semua peran melihat miliknya sesuai controller) ---
    Route::get('/log/aktivitas', [LogController::class, 'aktivitas']);

    // --- Notifikasi (semua peran, milik sendiri) ---
    // Catatan: rute statis "baca-semua" harus sebelum rute {id} agar tidak
    // tertangkap sebagai parameter id.
    Route::get('/notifikasi', [NotifikasiController::class, 'index']);
    Route::patch('/notifikasi/baca-semua', [NotifikasiController::class, 'bacaSemua']);
    Route::patch('/notifikasi/{id}/baca', [NotifikasiController::class, 'baca']);

    // --- Manajemen User (Kaprodi & Admin IT) ---
    Route::middleware('role:kaprodi,admin_it')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::patch('/users/{id}/toggle', [UserController::class, 'toggle']);
        Route::post('/users/{id}/reset-password', [UserController::class, 'resetPassword']);
        Route::post('/users/{id}/reset-pin', [UserController::class, 'resetPin']);
    });
});

