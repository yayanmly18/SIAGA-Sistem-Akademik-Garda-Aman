<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SesiUjian extends Model
{
    protected $table = 'sesi_ujian';

    protected $fillable = [
        'bank_soal_id', 'token_hash', 'token_encrypted', 'token_expires_at', 'token_revoked_at',
        'waktu_mulai', 'waktu_selesai', 'status', 'dibuat_oleh', 'nama_ujian', 'program_studi',
        'keterangan', 'catatan_status',
    ];

    protected $hidden = ['token_hash', 'token_encrypted'];

    protected $casts = [
        'waktu_mulai' => 'datetime',
        'waktu_selesai' => 'datetime',
        'token_expires_at' => 'datetime',
        'token_revoked_at' => 'datetime',
    ];

    public function soal(): BelongsTo
    {
        return $this->belongsTo(BankSoal::class, 'bank_soal_id');
    }

    public function logAkses(): HasMany
    {
        return $this->hasMany(LogAksesUjian::class, 'sesi_ujian_id');
    }

    public function peserta(): HasMany
    {
        return $this->hasMany(PesertaSesiUjian::class, 'sesi_ujian_id');
    }

    public function bisaDiakses(): bool
    {
        $now = now();
        return $this->status === 'active'
            && $this->soal?->status === 'siap_ujian'
            && $now->greaterThanOrEqualTo($this->waktu_mulai)
            && $now->lessThan($this->waktu_selesai);
    }

    public function statusEfektif(): string
    {
        if (in_array($this->status, ['draft', 'scheduled', 'active', 'suspended'], true)
            && now()->greaterThanOrEqualTo($this->waktu_selesai)) return 'completed';
        return $this->status;
    }
}
