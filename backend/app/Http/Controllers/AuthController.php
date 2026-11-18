<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Login — terima email + password, kembalikan token Sanctum + profil.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            ActivityLogger::log('login_gagal', ['email' => $data['email']], null);

            throw ValidationException::withMessages([
                'email' => ['Email atau kata sandi tidak sesuai.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Akun Anda tidak aktif. Hubungi Admin IT.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken('ebrankas-api')->plainTextToken;

        ActivityLogger::log('login', ['role' => $user->role], null, $user);

        return response()->json([
            'message' => 'Login berhasil.',
            'token' => $token,
            'user' => $this->profile($user),
        ]);
    }

    /**
     * Logout — cabut token saat ini.
     */
    public function logout(Request $request): JsonResponse
    {
        ActivityLogger::log('logout', [], null, $request->user());

        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logout berhasil.']);
    }

    /**
     * Profil pengguna yang sedang login.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->profile($request->user())]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['required', 'string', 'max:150'],
            'current_password' => ['nullable', 'string'],
            'new_password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'photo' => ['nullable', 'image', 'max:3072'],
            'signature' => ['nullable', 'image', 'mimes:png,jpg,jpeg', 'max:2048'],
        ]);
        $user = $request->user();
        if (! empty($data['new_password'])) {
            if (empty($data['current_password']) || ! Hash::check($data['current_password'], $user->password)) {
                throw ValidationException::withMessages(['current_password' => ['Kata sandi saat ini tidak sesuai.']]);
            }
            $user->password = $data['new_password'];
        }
        $user->nama = trim($data['nama']);
        $oldSignature = null;
        if ($request->hasFile('photo')) {
            $oldPhoto = $user->profile_photo_path;
            $user->profile_photo_path = $request->file('photo')->store('profile-photos', 'public');
            if ($oldPhoto) Storage::disk('public')->delete($oldPhoto);
        }
        if ($request->hasFile('signature')) {
            if ($user->role !== 'kaprodi') {
                throw ValidationException::withMessages(['signature' => ['Tanda tangan hanya dapat diatur oleh Kaprodi.']]);
            }
            $oldSignature = $user->signature_path;
            $user->signature_path = $request->file('signature')->store('signatures', 'local');
        }
        $user->save();
        if ($oldSignature) Storage::disk('local')->delete($oldSignature);
        ActivityLogger::log('profil_diperbarui', ['nama' => $user->nama], null, $user);
        return response()->json(['user' => $this->profile($user)]);
    }

    private function profile(User $user): array
    {
        return [
            'id' => $user->id,
            'nidn' => $user->nidn,
            'nama' => $user->nama,
            'email' => $user->email,
            'role' => $user->role,
            'is_active' => $user->is_active,
            'photo_url' => $user->profile_photo_path ? url(Storage::url($user->profile_photo_path)) : null,
            'has_signature' => (bool) $user->signature_path,
        ];
    }
}
