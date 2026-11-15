<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogPelanggaranUjian extends Model
{
    protected $table = 'log_pelanggaran_ujian';

    protected $fillable = [
        'peserta_sesi_ujian_id', 'sesi_ujian_id', 'jenis', 'pelanggaran_ke', 'catatan', 'terjadi_pada', 'ip_address',
    ];

    protected $casts = [
        'pelanggaran_ke' => 'integer',
        'terjadi_pada' => 'datetime',
    ];

    public function peserta(): BelongsTo
    {
        return $this->belongsTo(PesertaSesiUjian::class, 'peserta_sesi_ujian_id');
    }

    public function sesi(): BelongsTo
    {
        return $this->belongsTo(SesiUjian::class, 'sesi_ujian_id');
    }
}
