<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('peserta_sesi_ujian')) {
            Schema::create('peserta_sesi_ujian', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sesi_ujian_id')->constrained('sesi_ujian')->cascadeOnDelete();
                $table->string('nim', 40);
                $table->string('nama', 150);
                $table->text('email');
                $table->char('otp_hash', 64)->nullable();
                $table->dateTime('otp_expires_at')->nullable();
                $table->unsignedTinyInteger('otp_attempts')->default(0);
                $table->string('verified_token_hash', 64)->nullable()->index();
                $table->dateTime('verified_token_expires_at')->nullable();
                $table->dateTime('verified_at')->nullable();
                $table->timestamps();
                $table->unique(['sesi_ujian_id', 'nim']);
                $table->index(['sesi_ujian_id', 'email']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('peserta_sesi_ujian');
    }
};
