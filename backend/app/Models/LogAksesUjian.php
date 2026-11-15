<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogAksesUjian extends Model
{
    protected $table = 'log_akses_ujian';

    protected $fillable = [
        'sesi_ujian_id', 'nim', 'nama', 'akses_pertama_pada',
        'akses_terakhir_pada', 'jumlah_akses', 'ip_terakhir', 'status_akses',
    ];

    protected $casts = [
        'akses_pertama_pada' => 'datetime',
        'akses_terakhir_pada' => 'datetime',
        'jumlah_akses' => 'integer',
    ];

    public function sesi(): BelongsTo
    {
        return $this->belongsTo(SesiUjian::class, 'sesi_ujian_id');
    }
}
