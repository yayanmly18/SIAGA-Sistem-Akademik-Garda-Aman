<?php

namespace Tests\Feature;

use App\Models\BankSoal;
use App\Models\LogAksesUjian;
use App\Models\MataKuliah;
use App\Models\PesertaSesiUjian;
use App\Models\SesiUjian;
use App\Models\User;
use App\Services\QrTokenService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ExamQrAccessTest extends TestCase
{
    use DatabaseTransactions;

    public function test_session_can_start_in_the_current_minute(): void
    {
        $clock = now()->startOfMinute()->addSeconds(30);
        \Illuminate\Support\Carbon::setTestNow($clock);
        try {
            $panitia = User::create([
                'nama' => 'Panitia Jadwal Test',
                'email' => Str::uuid().'@example.test',
                'password' => 'test-password',
                'role' => 'panitia',
                'is_active' => true,
            ]);
            $dosen = User::create([
                'nama' => 'Dosen Jadwal Test',
                'email' => Str::uuid().'@example.test',
                'password' => 'test-password',
                'role' => 'dosen',
                'is_active' => true,
            ]);
            $mk = MataKuliah::create([
                'kode_mk' => 'JADWAL-'.Str::upper(Str::random(8)),
                'nama_mk' => 'Mata Kuliah Jadwal',
                'kelas' => 'A',
                'semester' => 1,
                'tahun_ajaran' => '2026/2027',
            ]);
            $soal = BankSoal::create([
                'user_id' => $dosen->id,
                'mk_id' => $mk->id,
                'jenis' => 'UTS',
                'judul' => 'Soal jadwal test',
                'file_path' => 'soal/jadwal-test.pdf.enc',
                'original_filename' => 'soal.pdf',
                'file_hash' => hash('sha256', 'test'),
                'status' => 'siap_ujian',
                'jumlah_mahasiswa' => 1,
                'jadwal_ujian' => $clock->copy()->addHour(),
                'waktu_mulai_ujian' => $clock,
                'durasi_menit' => 60,
            ]);

            $this->actingAs($panitia, 'sanctum')->postJson('/api/sesi-ujian', [
                'bank_soal_id' => $soal->id,
                'waktu_mulai' => $clock->copy()->startOfMinute()->format('Y-m-d\\TH:i'),
                'waktu_selesai' => $clock->copy()->addHour()->format('Y-m-d\\TH:i'),
            ])->assertCreated();
        } finally {
            \Illuminate\Support\Carbon::setTestNow();
        }
    }

    public function test_three_tab_leaves_lock_student_and_revoke_viewer_credential(): void
    {
        [, $participant, $token] = $this->createActiveSession();
        $accessToken = bin2hex(random_bytes(32));
        $participant->update([
            'verified_token_hash' => hash('sha256', $accessToken),
            'verified_token_expires_at' => now()->addMinutes(15),
        ]);

        foreach ([1, 2] as $expected) {
            $this->postJson("/api/ujian-online/akses/{$token}/pelanggaran", ['jenis' => 'tab_hidden'], [
                'Authorization' => 'Bearer '.$accessToken,
            ])->assertOk()->assertJsonPath('violations', $expected)->assertJsonPath('locked', false);
        }
        $this->postJson("/api/ujian-online/akses/{$token}/pelanggaran", ['jenis' => 'tab_hidden'], [
            'Authorization' => 'Bearer '.$accessToken,
        ])->assertStatus(423)->assertJsonPath('violations', 3)->assertJsonPath('locked', true);

        $participant->refresh();
        $this->assertSame(3, $participant->pelanggaran_count);
        $this->assertNotNull($participant->access_locked_at);
        $this->assertNull($participant->verified_token_hash);
        $this->assertDatabaseCount('log_pelanggaran_ujian', 3);
        $this->postJson("/api/ujian-online/akses/{$token}/otp", ['nim' => $participant->nim])->assertStatus(423);
    }

    public function test_panitia_requests_admin_it_and_admin_unlocks_student(): void
    {
        [$sesi, $participant] = $this->createActiveSession();
        $participant->update(['pelanggaran_count' => 3, 'access_locked_at' => now()]);
        $panitia = User::create([
            'nama' => 'Panitia Pembuka Test',
            'email' => Str::uuid().'@example.test',
            'password' => 'test-password',
            'role' => 'panitia',
            'is_active' => true,
        ]);
        $admin = User::create([
            'nama' => 'Admin IT Pembuka Test',
            'email' => Str::uuid().'@example.test',
            'password' => 'test-password',
            'role' => 'admin_it',
            'is_active' => true,
        ]);

        $this->actingAs($panitia, 'sanctum')->postJson("/api/pelanggaran-ujian/{$participant->id}/minta-buka", [
            'catatan' => 'Mahasiswa sudah dikonfirmasi langsung.',
        ])->assertOk();
        $this->actingAs($admin, 'sanctum')->getJson('/api/permintaan-buka-akses')
            ->assertOk()->assertJsonPath('data.0.nim', $participant->nim);
        $this->actingAs($admin, 'sanctum')->postJson("/api/permintaan-buka-akses/{$participant->id}/buka", [
            'catatan' => 'Pembukaan disetujui setelah konfirmasi Panitia.',
        ])->assertOk();

        $participant->refresh();
        $this->assertNull($participant->access_locked_at);
        $this->assertSame(0, $participant->pelanggaran_count);
        $this->assertNull($participant->verified_token_hash);
        $this->assertDatabaseHas('log_pelanggaran_ujian', [
            'sesi_ujian_id' => $sesi->id,
            'jenis' => 'admin_it_membuka_akses',
        ]);
    }

    public function test_dosen_upload_stores_original_filename_and_encrypted_pdf(): void
    {
        Storage::fake('local');
        $dosen = User::create([
            'nama' => 'Dosen Upload Test',
            'email' => Str::uuid().'@example.test',
            'password' => 'test-password',
            'role' => 'dosen',
            'is_active' => true,
        ]);
        $mk = MataKuliah::create([
            'kode_mk' => 'UPLOAD-'.Str::upper(Str::random(8)),
            'nama_mk' => 'Mata Kuliah Upload',
            'kelas' => 'A',
            'semester' => 1,
            'tahun_ajaran' => '2026/2027',
        ]);
        $pdf = "%PDF-1.4\nSIKASA UPLOAD TEST\n%%EOF";
        $file = UploadedFile::fake()->createWithContent('soal-uts.pdf', $pdf);

        $response = $this->actingAs($dosen, 'sanctum')->post('/api/soal', [
            'mk_id' => $mk->id,
            'jenis' => 'UTS',
            'judul' => 'Soal Upload Test',
            'jumlah_mahasiswa' => 30,
            'jadwal_ujian' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'file' => $file,
        ]);

        $response->assertCreated();
        $soalId = $response->json('data.id');
        $soal = BankSoal::findOrFail($soalId);
        $this->assertSame('soal-uts.pdf', $soal->original_filename);
        $this->assertNotEmpty($soal->file_path);
        $this->assertSame($pdf, Crypt::decryptString(Storage::disk('local')->get($soal->file_path)));
        $this->assertSame(hash('sha256', $pdf), $soal->file_hash);
    }

    private function createActiveSession(): array
    {
        Storage::fake('local');
        $user = User::create([
            'nama' => 'Dosen Penguji',
            'email' => Str::uuid().'@example.test',
            'password' => 'test-password',
            'role' => 'dosen',
            'is_active' => true,
        ]);
        $mk = MataKuliah::create([
            'kode_mk' => 'TEST-'.Str::upper(Str::random(8)),
            'nama_mk' => 'Mata Kuliah Tes',
            'kelas' => 'A',
            'semester' => 1,
            'tahun_ajaran' => '2026/2027',
        ]);
        $path = 'soal/test/'.Str::random(16).'.pdf';
        $contents = "%PDF-1.4\nSIKASA TEST PDF\n%%EOF";
        Storage::disk('local')->put($path, Crypt::encryptString($contents));
        $soal = BankSoal::create([
            'user_id' => $user->id,
            'mk_id' => $mk->id,
            'jenis' => 'UTS',
            'judul' => 'Soal ujian test',
            'file_path' => $path,
            'original_filename' => 'exam.pdf',
            'file_hash' => hash('sha256', $contents),
            'status' => 'siap_ujian',
            'jumlah_mahasiswa' => 1,
            'jadwal_ujian' => now()->addMinutes(30),
            'waktu_mulai_ujian' => now(),
            'durasi_menit' => 60,
        ]);
        $sesi = SesiUjian::create([
            'bank_soal_id' => $soal->id,
            'waktu_mulai' => now()->subMinute(),
            'waktu_selesai' => now()->addHour(),
            'status' => 'active',
            'dibuat_oleh' => $user->id,
            'nama_ujian' => 'UTS Tes',
        ]);
        $token = app(QrTokenService::class)->issue($sesi);
        $participant = PesertaSesiUjian::create([
            'sesi_ujian_id' => $sesi->id,
            'nim' => '12345678',
            'nama' => 'Mahasiswa Tes',
            'email' => 'student@example.test',
            'otp_hash' => hash_hmac('sha256', '123456', (string) config('app.key')),
            'otp_expires_at' => now()->addMinutes(5),
            'otp_attempts' => 0,
        ]);

        return [$sesi, $participant, $token, $contents];
    }

    public function test_roster_otp_verification_grants_pdf_only_through_protected_endpoint(): void
    {
        [$sesi, $participant, $token, $contents] = $this->createActiveSession();

        $verify = $this->postJson("/api/ujian-online/akses/{$token}/verifikasi", [
            'nim' => '12345678',
            'kode' => '123456',
        ])->assertOk()->assertJsonPath('nama', 'Mahasiswa Tes');
        $accessToken = $verify->json('access_token');
        $this->assertIsString($accessToken);
        $this->assertSame(64, strlen($accessToken));

        $this->postJson("/api/ujian-online/akses/{$token}/pdf", [], [
            'Authorization' => 'Bearer '.$accessToken,
            'Accept' => 'application/pdf',
        ])->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Cache-Control', 'max-age=0, no-store, private')
            ->assertContent($contents);

        $this->assertDatabaseHas('log_akses_ujian', [
            'sesi_ujian_id' => $sesi->id,
            'nim' => $participant->nim,
            'status_akses' => 'berhasil',
        ]);
        $this->assertNotSame($token, $sesi->fresh()->token_hash);
        $this->assertNotSame($token, $sesi->fresh()->token_encrypted);
        $this->assertSame($token, Crypt::decryptString($sesi->fresh()->token_encrypted));
    }

    public function test_pdf_endpoint_rejects_missing_verification_and_revoked_qr_tokens(): void
    {
        [, , $token] = $this->createActiveSession();
        $this->postJson("/api/ujian-online/akses/{$token}/pdf")
            ->assertUnauthorized();

        $sesi = SesiUjian::where('token_hash', hash('sha256', $token))->firstOrFail();
        app(QrTokenService::class)->revoke($sesi);
        $this->getJson("/api/ujian-online/akses/{$token}")->assertNotFound();
    }

    public function test_expired_qr_token_cannot_read_session_metadata(): void
    {
        [, , $token] = $this->createActiveSession();
        $sesi = SesiUjian::where('token_hash', hash('sha256', $token))->firstOrFail();
        $sesi->update(['token_expires_at' => now()->subSecond()]);

        $this->getJson("/api/ujian-online/akses/{$token}")->assertNotFound();
    }

    public function test_panitia_imports_roster_and_only_then_can_activate_session(): void
    {
        [$sesi] = $this->createActiveSession();
        $sesi->update(['status' => 'scheduled']);
        $sesi->peserta()->delete();
        $panitia = User::create([
            'nama' => 'Panitia Tes',
            'email' => Str::uuid().'@example.test',
            'password' => 'test-password',
            'role' => 'panitia',
            'is_active' => true,
        ]);

        $this->actingAs($panitia, 'sanctum')->patchJson("/api/sesi-ujian/{$sesi->id}/status", ['status' => 'active'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Impor daftar peserta dengan NIM, nama, dan email kampus sebelum mengaktifkan sesi.');

        $file = UploadedFile::fake()->createWithContent('peserta.csv', "nim,nama,email\n87654321,Mahasiswa Baru,baru@kampus.example");
        $this->actingAs($panitia, 'sanctum')->post("/api/sesi-ujian/{$sesi->id}/peserta", ['file' => $file])
            ->assertOk()->assertJsonPath('jumlah_peserta', 1);

        $participant = PesertaSesiUjian::where('sesi_ujian_id', $sesi->id)->where('nim', '87654321')->firstOrFail();
        $this->assertSame('baru@kampus.example', $participant->email);
        $this->assertNotSame('baru@kampus.example', $participant->getRawOriginal('email'));

        $this->actingAs($panitia, 'sanctum')->patchJson("/api/sesi-ujian/{$sesi->id}/status", ['status' => 'active'])
            ->assertOk()->assertJsonPath('data.status', 'active');
    }
}
