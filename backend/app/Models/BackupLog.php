<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackupLog extends Model
{
    protected $table = 'backup_logs';

    protected $fillable = [
        'status',
        'path',
        'ukuran_bytes',
        'detail',
    ];

    protected $casts = [
        'ukuran_bytes' => 'integer',
    ];
}
