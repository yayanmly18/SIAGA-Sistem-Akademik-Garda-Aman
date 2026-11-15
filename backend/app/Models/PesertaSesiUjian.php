<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PesertaSesiUjian extends Model
{
    protected $table = 'peserta_sesi_ujian';

    protected $fillable = [
        'sesi_ujian_id', 'nim', 'nama', 'email', 'otp_hash', 'otp_expires_at', 'otp_attempts',
        'verified_token_hash', 'verified_token_expires_at', 'verified_at',
        'pelanggaran_count', 'access_locked_at', 'unlock_requested_at', 'unlock_requested_by',
        'unlock_request_note', 'unlock_processed_at', 'unlock_processed_by',
    ];

    protected $hidden = ['email', 'otp_hash', 'verified_token_hash'];

    protected $casts = [
        'email' => 'encrypted',
        'otp_expires_at' => 'datetime',
        'verified_token_expires_at' => 'datetime',
        'verified_at' => 'datetime',
        'access_locked_at' => 'datetime',
        'unlock_requested_at' => 'datetime',
        'unlock_processed_at' => 'datetime',
        'pelanggaran_count' => 'integer',
    ];

    public function sesi(): BelongsTo
    {
        return $this->belongsTo(SesiUjian::class, 'sesi_ujian_id');
    }

    public function pelanggaran(): HasMany
    {
        return $this->hasMany(LogPelanggaranUjian::class, 'peserta_sesi_ujian_id');
    }

    public function pemintaBuka(): BelongsTo
    {
        return $this->belongsTo(User::class, 'unlock_requested_by');
    }

    public function pemrosesBuka(): BelongsTo
    {
        return $this->belongsTo(User::class, 'unlock_processed_by');
    }
}
