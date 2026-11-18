<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_soal', function (Blueprint $table) {
            $table->unsignedSmallInteger('signature_page')->nullable();
            $table->double('signature_x')->nullable();
            $table->double('signature_y')->nullable();
            $table->double('signature_width')->nullable();
            $table->double('signature_height')->nullable();
            $table->double('signature_name_y')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('bank_soal', function (Blueprint $table) {
            $table->dropColumn([
                'signature_page',
                'signature_x',
                'signature_y',
                'signature_width',
                'signature_height',
                'signature_name_y',
            ]);
        });
    }
};
