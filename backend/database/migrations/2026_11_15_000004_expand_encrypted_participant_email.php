<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('peserta_sesi_ujian', function (Blueprint $table) {
            $table->dropIndex('peserta_sesi_ujian_sesi_ujian_id_email_index');
        });
        Schema::table('peserta_sesi_ujian', function (Blueprint $table) {
            $table->text('email')->change();
        });
    }

    public function down(): void
    {
        Schema::table('peserta_sesi_ujian', function (Blueprint $table) {
            // Laravel-encrypted email can exceed the original plaintext varchar length.
            $table->string('email', 1024)->change();
        });
    }
};
