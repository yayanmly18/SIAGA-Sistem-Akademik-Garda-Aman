<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sesi_ujian', function (Blueprint $table) {
            if (! Schema::hasColumn('sesi_ujian', 'token_hash')) $table->char('token_hash', 64)->nullable()->unique();
            if (! Schema::hasColumn('sesi_ujian', 'token_encrypted')) $table->text('token_encrypted')->nullable();
            if (! Schema::hasColumn('sesi_ujian', 'token_expires_at')) $table->dateTime('token_expires_at')->nullable();
            if (! Schema::hasColumn('sesi_ujian', 'token_revoked_at')) $table->dateTime('token_revoked_at')->nullable();
            if (! Schema::hasColumn('sesi_ujian', 'nama_ujian')) $table->string('nama_ujian', 200)->nullable();
            if (! Schema::hasColumn('sesi_ujian', 'program_studi')) $table->string('program_studi', 150)->nullable();
            if (! Schema::hasColumn('sesi_ujian', 'keterangan')) $table->text('keterangan')->nullable();
            if (! Schema::hasColumn('sesi_ujian', 'catatan_status')) $table->text('catatan_status')->nullable();
        });

        if (Schema::hasColumn('sesi_ujian', 'token')) {
            foreach (DB::table('sesi_ujian')->whereNotNull('token')->get() as $row) {
                $rawToken = (string) $row->token;
                if ($rawToken === '') continue;
                DB::table('sesi_ujian')->where('id', $row->id)->update([
                    'token_hash' => hash('sha256', $rawToken),
                    'token_encrypted' => Crypt::encryptString($rawToken),
                    'token_expires_at' => $row->waktu_selesai,
                ]);
            }
            try { Schema::table('sesi_ujian', fn (Blueprint $table) => $table->dropUnique('sesi_ujian_token_unique')); } catch (Throwable) {}
            Schema::table('sesi_ujian', fn (Blueprint $table) => $table->dropColumn('token'));
        }

        // Expand the legacy enum before writing the new lifecycle values.
        Schema::table('sesi_ujian', function (Blueprint $table) {
            $table->enum('status', ['aktif', 'nonaktif', 'selesai', 'draft', 'scheduled', 'completed', 'cancelled', 'suspended'])->default('draft')->change();
        });
        DB::table('sesi_ujian')->where('status', 'nonaktif')->update(['status' => 'draft']);
        DB::table('sesi_ujian')->where('status', 'selesai')->update(['status' => 'completed']);
        DB::table('sesi_ujian')->where('status', 'draft')->where('waktu_mulai', '>', now())->update(['status' => 'scheduled']);
        Schema::table('sesi_ujian', function (Blueprint $table) {
            $table->string('status', 20)->default('draft')->change();
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('sesi_ujian', 'token')) return;
        Schema::table('sesi_ujian', fn (Blueprint $table) => $table->char('token', 64)->nullable()->unique());
        foreach (DB::table('sesi_ujian')->whereNotNull('token_encrypted')->get() as $row) {
            try { $rawToken = Crypt::decryptString($row->token_encrypted); } catch (Throwable) { $rawToken = null; }
            if ($rawToken) DB::table('sesi_ujian')->where('id', $row->id)->update(['token' => $rawToken]);
        }
        DB::table('sesi_ujian')->whereIn('status', ['completed', 'cancelled', 'suspended'])->update(['status' => 'selesai']);
        DB::table('sesi_ujian')->whereIn('status', ['draft', 'scheduled'])->update(['status' => 'nonaktif']);
        Schema::table('sesi_ujian', function (Blueprint $table) {
            $table->enum('status', ['aktif', 'nonaktif', 'selesai'])->default('nonaktif')->change();
            $table->dropUnique('sesi_ujian_token_hash_unique');
            $table->dropColumn(['token_hash', 'token_encrypted', 'token_expires_at', 'token_revoked_at', 'nama_ujian', 'program_studi', 'keterangan', 'catatan_status']);
        });
    }
};
