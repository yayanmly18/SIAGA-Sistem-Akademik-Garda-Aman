<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('peserta_sesi_ujian', function (Blueprint $table) {
            $table->unsignedTinyInteger('pelanggaran_count')->default(0)->after('verified_at');
            $table->dateTime('access_locked_at')->nullable()->after('pelanggaran_count');
            $table->dateTime('unlock_requested_at')->nullable()->after('access_locked_at');
            $table->foreignId('unlock_requested_by')->nullable()->after('unlock_requested_at')->constrained('users')->nullOnDelete();
            $table->string('unlock_request_note', 500)->nullable()->after('unlock_requested_by');
            $table->dateTime('unlock_processed_at')->nullable()->after('unlock_request_note');
            $table->foreignId('unlock_processed_by')->nullable()->after('unlock_processed_at')->constrained('users')->nullOnDelete();
        });

        Schema::create('log_pelanggaran_ujian', function (Blueprint $table) {
            $table->id();
            $table->foreignId('peserta_sesi_ujian_id')->constrained('peserta_sesi_ujian')->cascadeOnDelete();
            $table->foreignId('sesi_ujian_id')->constrained('sesi_ujian')->cascadeOnDelete();
            $table->string('jenis', 40);
            $table->unsignedTinyInteger('pelanggaran_ke');
            $table->string('catatan', 500)->nullable();
            $table->dateTime('terjadi_pada');
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
            $table->index(['sesi_ujian_id', 'terjadi_pada']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('log_pelanggaran_ujian');
        Schema::table('peserta_sesi_ujian', function (Blueprint $table) {
            $table->dropForeign(['unlock_requested_by']);
            $table->dropForeign(['unlock_processed_by']);
            $table->dropColumn([
                'pelanggaran_count', 'access_locked_at', 'unlock_requested_at', 'unlock_requested_by',
                'unlock_request_note', 'unlock_processed_at', 'unlock_processed_by',
            ]);
        });
    }
};
