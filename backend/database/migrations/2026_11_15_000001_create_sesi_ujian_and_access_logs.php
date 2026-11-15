<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_soal', function (Blueprint $table) {
            $table->enum('status', ['terkunci', 'ditolak', 'siap_ujian', 'dibuka', 'selesai', 'arsip'])->default('terkunci')->change();
            if (! Schema::hasColumn('bank_soal', 'catatan_persetujuan')) {
                $table->text('catatan_persetujuan')->nullable();
            }
        });

        if (! Schema::hasTable('sesi_ujian')) Schema::create('sesi_ujian', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_soal_id')->unique()->constrained('bank_soal')->cascadeOnDelete();
            $table->char('token', 64)->unique();
            $table->dateTime('waktu_mulai');
            $table->dateTime('waktu_selesai');
            $table->enum('status', ['aktif', 'nonaktif', 'selesai'])->default('nonaktif');
            $table->foreignId('dibuat_oleh')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['status', 'waktu_mulai', 'waktu_selesai']);
        });

        if (! Schema::hasTable('log_akses_ujian')) Schema::create('log_akses_ujian', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sesi_ujian_id')->constrained('sesi_ujian')->cascadeOnDelete();
            $table->string('nim', 40);
            $table->string('nama', 150);
            $table->dateTime('akses_pertama_pada');
            $table->dateTime('akses_terakhir_pada');
            $table->unsignedInteger('jumlah_akses')->default(1);
            $table->enum('status_akses', ['berhasil', 'ditolak'])->default('berhasil');
            $table->string('ip_terakhir', 45)->nullable();
            $table->timestamps();
            $table->unique(['sesi_ujian_id', 'nim']);
            $table->index('akses_terakhir_pada');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('log_akses_ujian');
        Schema::dropIfExists('sesi_ujian');
        Schema::table('bank_soal', function (Blueprint $table) {
            $table->dropColumn('catatan_persetujuan');
            $table->enum('status', ['terkunci', 'siap_ujian', 'dibuka', 'selesai', 'arsip'])->default('terkunci')->change();
        });
    }
};
