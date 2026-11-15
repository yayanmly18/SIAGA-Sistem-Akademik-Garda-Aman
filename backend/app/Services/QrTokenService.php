<?php

namespace App\Services;

use App\Models\SesiUjian;
use Illuminate\Support\Facades\Crypt;

class QrTokenService
{
    /** Issue an unpredictable bearer token; the database stores only its hash and ciphertext. */
    public function issue(SesiUjian $sesi): string
    {
        $token = bin2hex(random_bytes(32));
        $sesi->forceFill([
            'token_hash' => hash('sha256', $token),
            'token_encrypted' => Crypt::encryptString($token),
            'token_expires_at' => $sesi->waktu_selesai,
            'token_revoked_at' => null,
        ])->save();

        return $token;
    }

    public function current(SesiUjian $sesi): ?string
    {
        if ($sesi->token_revoked_at || ! $sesi->token_expires_at || $sesi->token_expires_at->lessThanOrEqualTo(now()) || ! $sesi->token_encrypted) {
            return null;
        }

        try {
            return Crypt::decryptString($sesi->token_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    public function revoke(SesiUjian $sesi): void
    {
        $sesi->forceFill([
            'token_revoked_at' => now(),
            'token_encrypted' => null,
        ])->save();
    }

    public function findValid(string $token): ?SesiUjian
    {
        if (! preg_match('/^[a-f0-9]{64}$/', $token)) return null;

        return SesiUjian::where('token_hash', hash('sha256', $token))
            ->whereNull('token_revoked_at')
            ->where('token_expires_at', '>', now())
            ->first();
    }
}
