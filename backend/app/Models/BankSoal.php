<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankSoal extends Model
{
    use HasFactory;

    protected $table = 'bank_soal';

    protected $fillable = [
        'user_id',
        'mk_id',
        'jenis',
        'judul',
        'file_path',
        'original_filename',
        'file_hash',
        'status',
        'jumlah_mahasiswa',
        'jadwal_ujian',
        'waktu_mulai_ujian',
        'waktu_selesai_ujian',
        'durasi_menit',
        'qr_token',
        'qr_code_path',
        'template_soal_id',
        'catatan_persetujuan',
        'approved_by',
        'approval_name',
        'approval_signature_path',
        'signature_page',
        'signature_x',
        'signature_y',
        'signature_width',
        'signature_height',
        'signature_name_y',
        'approved_at',
        'dikunci_pada',
        'arsip_pada',
    ];

    protected $casts = [
        'jadwal_ujian' => 'datetime',
        'waktu_mulai_ujian' => 'datetime',
        'waktu_selesai_ujian' => 'datetime',
        'dikunci_pada' => 'datetime',
        'approved_at' => 'datetime',
        'arsip_pada' => 'datetime',
        'jumlah_mahasiswa' => 'integer',
        'durasi_menit' => 'integer',
        'signature_page' => 'integer',
        'signature_x' => 'float',
        'signature_y' => 'float',
        'signature_width' => 'float',
        'signature_height' => 'float',
        'signature_name_y' => 'float',
    ];

    public function dosen(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function mataKuliah(): BelongsTo
    {
        return $this->belongsTo(MataKuliah::class, 'mk_id');
    }

    public function revisi(): HasMany
    {
        return $this->hasMany(RevisiSoal::class, 'bank_soal_id');
    }

    public function logCetak(): HasMany
    {
        return $this->hasMany(LogCetak::class, 'bank_soal_id');
    }

    public function templateSoal(): BelongsTo
    {
        return $this->belongsTo(TemplateSoal::class, 'template_soal_id');
    }

    public function sesiUjian(): HasMany
    {
        return $this->hasMany(SesiUjian::class, 'bank_soal_id');
    }

    public function isTerbukaUntukUjian(): bool
    {
        if (! in_array($this->status, ['siap_ujian', 'dibuka'], true)
            || $this->waktu_mulai_ujian === null
            || now()->lt($this->waktu_mulai_ujian)) {
            return false;
        }

        $batasAkhir = $this->waktu_selesai_ujian
            ?? $this->jadwal_ujian?->copy()->addMinutes($this->durasi_menit ?? 120);

        return $batasAkhir === null || now()->lte($batasAkhir);
    }

    public function isUjianSelesai(): bool
    {
        if ($this->status === 'selesai' || $this->status === 'arsip') {
            return true;
        }

        return $this->sesiUjian()->where(function ($query) {
            $query->whereIn('status', ['completed', 'selesai'])
                ->orWhere(function ($scheduled) {
                    $scheduled->whereIn('status', ['draft', 'scheduled', 'active', 'suspended'])
                        ->where('waktu_selesai', '<=', now());
                });
        })->exists();
    }

    public function generateQrToken(): string
    {
        $token = bin(random_bytes(16));
        $this->update(['qr_token' => $token]);
        return $token;
    }
}
