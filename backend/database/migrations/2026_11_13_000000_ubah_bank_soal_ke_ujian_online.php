<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tabel template soal (placeholder untuk template yang akan dibuat nanti)
        if (! Schema::hasTable('template_soal')) {
            Schema::create('template_soal', function (Blueprint $table) {
                $table->id();
                $table->string('nama_template', 200);
                $table->text('deskripsi')->nullable();
                $table->string('file_path', 500)->nullable(); // file template (JSON/HTML/PDF)
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        // Modifikasi bank_soal: hilangkan ketergantungan printer/cetak fisik, tambahkan field ujian online
        DB::statement('ALTER TABLE bank_soal CHANGE waktu_mulai_cetak waktu_mulai_ujian DATETIME NULL');

        Schema::table('bank_soal', function (Blueprint $table) {
            // Ubah enum status untuk mendukung alur ujian online
            $table->enum('status', ['terkunci', 'siap_ujian', 'dibuka', 'selesai', 'arsip'])
                ->default('terkunci')
                ->change();

            // Rename waktu_mulai_cetak -> waktu_mulai_ujian (semantik baru)
            $table->dateTime('waktu_mulai_ujian')->nullable()->change();

            // Tambah waktu selesai ujian
            $table->dateTime('waktu_selesai_ujian')->nullable();

            // Durasi ujian dalam menit
            $table->unsignedInteger('durasi_menit')->default(120);

            // Token QR code untuk akses siswa (unique)
            $table->string('qr_token', 100)->unique()->nullable();

            // Path gambar QR code (disimpan di server)
            $table->string('qr_code_path', 500)->nullable();

            // Referensi ke template soal (akan digunakan saat template dibuat)
            $table->foreignId('template_soal_id')->nullable()->constrained('template_soal')->nullOnDelete();

            // File PDF tidak lagi wajib (soal online bisa dari template)
            $table->string('file_path', 500)->nullable()->change();

            // Index untuk pencarian cepat berdasarkan token QR
            $table->index('qr_token');
        });
    }

    public function down(): void
    {
        Schema::table('bank_soal', function (Blueprint $table) {
            $table->dropForeign(['template_soal_id']);
            $table->dropIndex(['qr_token']);
            $table->dropColumn([
                'waktu_mulai_ujian',
                'waktu_selesai_ujian',
                'durasi_menit',
                'qr_token',
                'qr_code_path',
                'template_soal_id',
            ]);
            $table->enum('status', ['terkunci', 'siap_cetak', 'arsip'])->default('terkunci')->change();
            $table->string('file_path', 500)->nullable(false)->change();
        });

        DB::statement('ALTER TABLE bank_soal CHANGE waktu_mulai_ujian waktu_mulai_cetak DATETIME NULL');

        Schema::dropIfExists('template_soal');
    }
};
