# SIKASA — Sistem Informasi Keamanan Soal Akademik

SIKASA mengamankan file soal ujian dan mendistribusikannya melalui QR Code. Mahasiswa membaca PDF dari browser dan menulis jawaban pada lembar kertas. Sistem ini **bukan CBT**: tidak ada pengerjaan soal atau penilaian online.

## Stack

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS v4
- Backend: Laravel 10, PHP 8.1+
- Database: MySQL/MariaDB
- Autentikasi staf: Laravel Sanctum
- PDF: AES-256 melalui Laravel Crypt, disimpan di private storage
- Viewer mahasiswa: PDF.js

## Alur ujian

1. Dosen upload PDF; backend mengenkripsi file dan menyimpannya secara privat.
2. Kaprodi memeriksa dan menyetujui/menolak soal.
3. Panitia membuat sesi dari soal yang disetujui, mengatur jadwal, lalu mengimpor roster CSV.
4. Panitia mengaktifkan sesi dan menampilkan QR yang berisi token acak, bukan lokasi PDF.
5. Mahasiswa scan QR, memasukkan NIM dari roster, lalu menerima OTP pada email peserta. Setelah verifikasi, PDF.js menampilkan soal dan watermark.
6. Saat viewer terbuka, perpindahan halaman ke tab/background lain dicatat. Dua kejadian pertama memberi peringatan; kejadian ketiga mengunci kredensial akses.
7. Mahasiswa yang terkunci meminta pemeriksaan Panitia. Panitia mengirim permintaan pembukaan dengan catatan; Admin IT memprosesnya dari menu **Pengawasan Ujian**. Setelah dibuka, mahasiswa wajib verifikasi OTP kembali.
8. Mahasiswa menulis jawaban di kertas; Panitia mengumpulkannya manual. Akses ditutup ketika waktu selesai atau sesi ditutup/dibatalkan.

### Roster dan identitas

Impor peserta sebelum mengaktifkan sesi menggunakan CSV dengan header `nim,nama,email`. Gunakan daftar peserta dan email yang berasal dari sumber resmi kampus. OTP membuktikan kendali atas email di roster; ini bukan integrasi SSO dan tidak dengan sendirinya memastikan identitas formal mahasiswa. SMTP Laravel harus dikonfigurasi agar OTP terkirim.

## Keamanan dan batasan

- PDF terenkripsi saat tersimpan dan hanya didekripsi di backend setelah token, roster, OTP, status persetujuan, dan jadwal diverifikasi.
- Token QR di database disimpan sebagai hash dan ciphertext Laravel; QR dapat dirotasi atau dicabut.
- Viewer PDF.js tidak menampilkan tombol unduh/cetak dan menambahkan watermark. Browser tetap menerima byte PDF untuk merendernya, sehingga screenshot, fotografi layar, atau teknik browser lain tidak dapat sepenuhnya dicegah.
- Deteksi perpindahan tab memakai sinyal visibility browser sebagai pengurang risiko; halaman web tidak dapat mencegah semua cara berpindah tab, split screen, atau memakai perangkat lain.
- Pengiriman viewer berupa satu blob dengan batas upload PDF 10 MB dan tanpa HTTP Range.
- `APP_KEY` harus dijaga dan dicadangkan; kunci yang hilang/berubah tanpa re-enkripsi dapat membuat file, token QR, dan email tersimpan tidak terbaca.

## Pengembangan lokal

### Backend

```powershell
cd backend
Copy-Item .env.example .env
composer install
php artisan key:generate
# Atur koneksi MySQL/MariaDB, APP_URL, SMTP, dan SIKASA_FRONTEND_URL di .env
php artisan migrate --seed
php artisan serve
```

### Frontend

```powershell
pnpm install
pnpm dev
```

Atur `API_BASE` di `src/db.ts` ke alamat backend. Untuk akses HP di jaringan ujian, gunakan alamat IP/hostname LAN yang dapat dijangkau, bukan `localhost`, pada URL frontend/API. Tambahkan origin frontend pada `CORS_ALLOWED_ORIGINS` backend. Gunakan HTTPS pada deployment ujian.

Laravel Scheduler harus dijalankan setiap menit agar status sesi kedaluwarsa diperbarui di database. Endpoint tetap menolak PDF tepat setelah waktu selesai meskipun scheduler terlambat.

Perintah pemeriksaan:

```powershell
pnpm typecheck
pnpm test
pnpm build
cd backend
php artisan test
php artisan migrate:status
```

## Peran

- **Dosen:** upload dan kelola soal.
- **Kaprodi:** tinjau, setujui/tolak soal.
- **Panitia/TU:** sesi ujian, roster, QR, status, dan log akses.
- **Admin IT:** akun dan infrastruktur.

Laporan audit arsitektur, database, keamanan, dan status implementasi tersedia dalam `SYSTEM_AUDIT.md`, `EXISTING_ARCHITECTURE.md`, `DATABASE_ANALYSIS.md`, `SECURITY_ASSESSMENT.md`, dan `IMPLEMENTATION_PLAN.md`.
