<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TemplateSoal extends Model
{
    use HasFactory;

    protected $table = 'template_soal';

    protected $fillable = [
        'nama_template',
        'deskripsi',
        'file_path',
        'created_by',
    ];

    protected $casts = [
        'created_by' => 'integer',
    ];

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function bankSoal(): HasMany
    {
        return $this->hasMany(BankSoal::class, 'template_soal_id');
    }
}
