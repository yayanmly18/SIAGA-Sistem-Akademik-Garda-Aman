<?php

namespace App\Http\Controllers;

use App\Models\PesertaSesiUjian;
use App\Models\SesiUjian;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PesertaSesiUjianController extends Controller
{
    public function import(Request $request, int $id): JsonResponse
    {
        $sesi = SesiUjian::findOrFail($id);
        if (! in_array($sesi->status, ['draft', 'scheduled'], true) || $sesi->logAkses()->exists()) {
            return response()->json(['message' => 'Daftar peserta hanya dapat diubah sebelum ujian aktif dan sebelum ada akses.'], 422);
        }
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:5120']]);
        $stream = fopen($request->file('file')->getRealPath(), 'rb');
        if (! $stream) return response()->json(['message' => 'File roster tidak dapat dibaca.'], 422);

        $headers = fgetcsv($stream, 10000, ',');
        if (! is_array($headers)) {
            fclose($stream);
            return response()->json(['message' => 'CSV harus memiliki header nim,nama,email.'], 422);
        }
        $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $headers[0]);
        $headers = array_map(fn ($header) => strtolower(trim((string) $header)), $headers);
        $columns = array_flip($headers);
        foreach (['nim', 'nama', 'email'] as $required) {
            if (! array_key_exists($required, $columns)) {
                fclose($stream);
                return response()->json(['message' => 'CSV harus memiliki kolom nim, nama, dan email.'], 422);
            }
        }

        $rows = [];
        $seen = [];
        $line = 1;
        while (($values = fgetcsv($stream, 10000, ',')) !== false) {
            $line++;
            if ($values === [null] || $values === []) continue;
            if (count($rows) >= 5000) {
                fclose($stream);
                return response()->json(['message' => 'Maksimal 5.000 peserta per sesi.'], 422);
            }
            $nim = mb_strtoupper(trim((string) ($values[$columns['nim']] ?? '')));
            $nama = trim((string) ($values[$columns['nama']] ?? ''));
            $email = strtolower(trim((string) ($values[$columns['email']] ?? '')));
            if ($nim === '' || mb_strlen($nim) > 40 || $nama === '' || mb_strlen($nama) > 150 || ! filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 255) {
                fclose($stream);
                return response()->json(['message' => "Data NIM, nama, atau email tidak valid di baris {$line}."], 422);
            }
            $key = mb_strtolower($nim);
            if (isset($seen[$key])) {
                fclose($stream);
                return response()->json(['message' => "NIM duplikat ditemukan di baris {$line}."], 422);
            }
            $seen[$key] = true;
            $rows[] = ['nim' => $nim, 'nama' => $nama, 'email' => $email];
        }
        fclose($stream);
        if ($rows === []) return response()->json(['message' => 'CSV tidak berisi peserta.'], 422);

        DB::transaction(function () use ($sesi, $rows) {
            foreach ($rows as $row) {
                PesertaSesiUjian::updateOrCreate(
                    ['sesi_ujian_id' => $sesi->id, 'nim' => $row['nim']],
                    $row + [
                        'otp_hash' => null,
                        'otp_expires_at' => null,
                        'otp_attempts' => 0,
                        'verified_token_hash' => null,
                        'verified_token_expires_at' => null,
                        'verified_at' => null,
                    ],
                );
            }
        });
        ActivityLogger::log('roster_peserta_diimpor', ['sesi_ujian_id' => $sesi->id, 'jumlah_peserta' => count($rows)], $sesi->bank_soal_id, $request->user());
        return response()->json(['message' => 'Roster peserta diimpor.', 'jumlah_peserta' => count($rows)]);
    }

    public function destroyAll(Request $request, int $id): JsonResponse
    {
        $sesi = SesiUjian::findOrFail($id);
        if (! in_array($sesi->status, ['draft', 'scheduled'], true) || $sesi->logAkses()->exists()) {
            return response()->json(['message' => 'Daftar peserta tidak dapat dihapus setelah sesi aktif atau memiliki log akses.'], 422);
        }
        $count = $sesi->peserta()->count();
        $sesi->peserta()->delete();
        ActivityLogger::log('roster_peserta_dihapus', ['sesi_ujian_id' => $sesi->id, 'jumlah_peserta' => $count], $sesi->bank_soal_id, $request->user());
        return response()->json(['message' => 'Roster peserta dihapus.', 'jumlah_peserta' => $count]);
    }
}
