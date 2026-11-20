# SIAGA — Sistem Akademik Garda Aman

SIAGA mengamankan file soal ujian dan mendistribusikannya melalui QR Code. Mahasiswa membaca PDF dari browser dan menulis jawaban pada lembar kertas. Sistem ini **bukan CBT**: tidak ada pengerjaan soal atau penilaian online.

## Stack

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS v4
- Backend: Laravel 10, PHP 8.1+
- Database: MySQL/MariaDB
- Autentikasi staf: Laravel Sanctum
- PDF: AES-256 melalui Laravel Crypt, disimpan di private storage
- Viewer mahasiswa: PDF.js

## Identitas aplikasi dan login

Nama aplikasi adalah **SIAGA — Sistem Akademik Garda Aman**. Logo untuk sidebar dan halaman login, serta favicon untuk browser dan perangkat mobile, berada di `public/Logo/`. Identitas aplikasi juga digunakan pada halaman akses mahasiswa, judul tab, dan dokumen yang dihasilkan sistem.

Pada halaman login, staf memilih peran yang sesuai dengan akunnya. Backend memeriksa kecocokan peran bersama email dan kata sandi; akun dengan kredensial benar tetapi peran yang dipilih tidak sesuai tetap ditolak. Pilihan **Admin** di antarmuka dipetakan ke role backend `admin_it`. Mahasiswa mengakses soal melalui QR dan OTP, bukan melalui login staf.

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
# Atur koneksi MySQL/MariaDB, APP_URL, SMTP, dan SIAGA_FRONTEND_URL di .env
# Jika memakai fitur backup, isi EBRANKAS_BACKUP_PASSWORD dengan rahasia acak minimal 32 karakter.
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

## Audit keamanan dan tindak lanjut

Pemeriksaan source-only terakhir: 19 November 2026. Perubahan di bawah merupakan perbaikan pada kode yang ditinjau. Audit tidak mengakses deployment, database, `.env` aktif, log, atau storage produksi; hasilnya bukan sertifikasi keamanan. Tidak ada test, build, atau endpoint produksi yang dijalankan.

### Temuan dan perbaikan

| Severity saat ditemukan | Temuan dan bukti | Perbaikan |
| --- | --- | --- |
| High | Kaprodi dapat membuat atau mengubah pengguna menjadi `admin_it` melalui manajemen pengguna. Route memberi akses Kaprodi, sedangkan controller menerima semua role (`backend/routes/api.php:133–139`, `backend/app/Http/Controllers/UserController.php`). | Controller kini menolak Kaprodi membuat, mempromosikan, atau mengelola akun Admin IT. Admin IT tetap dapat mengelola akun sesuai route. |
| Medium | Dosen dapat mengirim `mk_id` yang tidak ditugaskan kepadanya saat mengunggah soal (`backend/app/Http/Controllers/BankSoalController.php`). | Relasi penugasan mata kuliah diverifikasi sebelum file ditulis. |
| Medium | OTP dapat terkunci permanen setelah lima percobaan gagal karena permintaan kode baru tidak mereset penghitung (`backend/app/Http/Controllers/UjianOnlineController.php`). | Permintaan OTP yang valid menerbitkan kode baru dan mereset penghitung; rate limit permintaan tetap berlaku. |
| Medium | Respons OTP membedakan NIM yang tidak terdaftar/terkunci dari data yang valid, sehingga roster dapat dienumerasi (`backend/app/Http/Controllers/UjianOnlineController.php`). | Respons permintaan OTP dibuat generik; respons verifikasi menyamakan NIM tidak dikenal, terkunci, dan kode tidak valid/kedaluwarsa. |
| Medium | Permintaan OTP baru sebelumnya menghapus token peserta yang sudah terverifikasi, sehingga pemegang QR dan NIM dapat memutus akses peserta aktif sebelum OTP baru diverifikasi (`backend/app/Http/Controllers/UjianOnlineController.php`). | Token aktif dipertahankan saat meminta OTP; rotasi token hanya berlangsung pada verifikasi yang berhasil. |
| Medium | Kredensial demo diisi otomatis pada halaman login dan seeder berisi akun/PIN awal tetap (`src/App.tsx`, `backend/database/seeders/DatabaseSeeder.php`). | Form login kini kosong. Seeder demo menolak berjalan di luar environment `local` atau `testing`; kredensial contoh masih ada di seeder untuk pengembangan lokal. |
| Medium | Token Sanctum tidak memiliki masa kedaluwarsa dan tidak dicabut saat kata sandi diubah atau akun dinonaktifkan (`backend/config/sanctum.php`, `backend/app/Http/Controllers`). | Masa berlaku default disetel 720 menit melalui `SANCTUM_EXPIRATION`; token dicabut saat reset password, perubahan password sendiri (kecuali token aktif), atau penonaktifan akun. Tetapkan nilai environment yang sesuai deployment. |
| Medium | Endpoint login sebelumnya tidak memiliki pembatasan percobaan dan respons berbeda untuk akun nonaktif, sehingga memungkinkan brute force serta enumerasi status akun (`backend/routes/api.php`, `backend/app/Http/Controllers/AuthController.php`). | Login dibatasi lima permintaan per menit per alamat IP, respons kredensial salah/nonaktif disamakan, dan role yang dipilih pada halaman login wajib cocok dengan role akun di backend. |
| Medium | Bearer token staf sebelumnya tersimpan di `localStorage`, sehingga tetap tersedia setelah browser ditutup dan dapat diambil oleh JavaScript yang berjalan pada origin aplikasi (`src/db.ts`). | Penyimpanan dipindahkan ke `sessionStorage`, yang dibersihkan saat sesi tab ditutup. XSS tetap dapat membaca token selama tab aktif dan masih perlu dimitigasi di frontend. |
| Low (jalur cetak belum terhubung) | Nilai nama/alamat printer dimasukkan ke perintah shell tanpa escaping argumen di `backend/app/Services/PrintService.php`; jika dispatch dipanggil, metadata printer yang dikendalikan Admin IT dapat mengubah interpretasi perintah OS. | Placeholder printer dan file kini di-expand Symfony Process sebagai argumen aman, proses dibatasi timeout konfigurasi, dan contoh konfigurasi diperbarui. Controller cetak belum terdaftar pada route API/web, jadi jalur ini masih harus ditinjau sebelum diaktifkan. |
| Medium (controller cetak belum terhubung) | `CetakController` belum mengunci role di dalam method dan percobaan PIN enam digit belum dibatasi (`backend/app/Http/Controllers/CetakController.php`). Jika route terhubung tanpa middleware yang tepat, role lain dapat mencoba PIN tanpa batas. | Method antrian/cetak kini hanya menerima Panitia; percobaan PIN salah dibatasi lima kali per 15 menit per IP dan akun Panitia. Route cetak tetap belum tersedia, sehingga validasi integrasi route masih diperlukan. |
| Medium | Backup database sebelumnya disimpan sebagai ZIP tanpa enkripsi arsip (`backend/app/Services/BackupService.php`). Jika file cadangan terbaca pihak lain, dump berisi data akun dan informasi operasional dapat diekspos. | Setiap entry ZIP kini diwajibkan terenkripsi AES-256; pembuatan backup gagal tertutup jika `EBRANKAS_BACKUP_PASSWORD` belum disetel minimal 32 karakter. Direktori kerja dibatasi dan file hasil diberi izin terbatas pada sistem yang mendukung `chmod`. |

Tidak ada temuan Critical yang terkonfirmasi pada pemeriksaan source ini. Severity menunjukkan kondisi sebelum perbaikan; status perbaikan belum diverifikasi lewat test/runtime.

### Risiko yang masih perlu ditindaklanjuti

- Backup kini memakai enkripsi ZIP AES-256, tetapi `EBRANKAS_BACKUP_PASSWORD` harus dikonfigurasi dan dicadangkan terpisah secara aman; kehilangan rahasia ini membuat backup tidak dapat dipulihkan. Verifikasi dukungan AES-256 pada libzip, ACL direktori backup, akses salinan, serta retensi pada deployment.
- Arsip backup lama yang dibuat sebelum perubahan tetap tidak terenkripsi; identifikasi lalu amankan atau hapus sesuai kebijakan retensi setelah memastikan salinan pemulihan yang diperlukan.
- Frontend kini menyimpan bearer token di `sessionStorage` (`src/db.ts`), sehingga token tidak bertahan setelah sesi tab browser ditutup. Token masih dapat dicuri JavaScript saat tab aktif jika terjadi XSS; mitigasi XSS dan konfigurasi CSP perlu divalidasi pada frontend hosting.
- Endpoint permintaan OTP memiliki pembatasan per sesi/NIM dan per IP, tetapi pemegang QR masih dapat memicu pengiriman email ke peserta roster atau menghabiskan kuota permintaan peserta. Verifikasi batas provider, pemantauan, dan kontrol penyalahgunaan email sebelum produksi.
- Controller pencetakan serta pemanggilan `/cetak/{id}` belum terhubung ke route API/web. Controller kini membatasi role ke Panitia dan percobaan PIN, tetapi jalur itu belum tervalidasi sebagai kontrol aktif sampai route diintegrasikan. Sebelum route diaktifkan, verifikasi middleware autentikasi, audit akses, serta ACL dan penghapusan/retensi file spool; spool berisi PDF plaintext.
- Periksa `.env` produksi agar `APP_DEBUG=false`, kunci `APP_KEY` kuat dan rahasia, `SANCTUM_EXPIRATION` sesuai kebijakan, serta kredensial demo tidak pernah digunakan. `.env` aktif dan konfigurasi server tidak diperiksa.
- PDF ujian disimpan melalui Laravel `Crypt` pada disk privat, dengan validasi PDF dan batas 10 MB. Keamanan enkripsi tetap bergantung pada kerahasiaan/rotasi `APP_KEY` dan izin storage; hal itu perlu diverifikasi pada deployment.
- Tidak ditemukan bukti SQL injection atau sink XSS langsung pada jalur source yang ditinjau. API memakai bearer Sanctum dan middleware role; route web memakai perlindungan CSRF Laravel. Kesimpulan ini terbatas pada source yang diperiksa, bukan pengujian dinamis.

### Cakupan

Audit meninjau autentikasi dan otorisasi role, alur OTP/peserta, upload dan penyimpanan PDF, token Sanctum, perubahan profil/password, manajemen pengguna, query database, serta route API/web terkait. Tidak diperiksa: konfigurasi `.env` aktif, database dan akun aktual, backup hasil produksi, server/proxy/TLS, email provider, browser/runtime, log, dependency dengan scanner, atau endpoint deployment.

## Kesiapan production

**Status: belum siap untuk production.** Source telah diperkeras, tetapi release harus ditahan sampai blocker berikut selesai dan dibuktikan di staging:

1. Upgrade Laravel 10 ke versi yang masih menerima security fixes, lalu sesuaikan PHP dan dependency lock. Dukungan security Laravel 10 berakhir 4 Februari 2025 ([kebijakan dukungan resmi](https://laravel.com/docs/10.x/releases)).
2. Siapkan `.env` production di secret manager/server, bukan Git: `APP_DEBUG=false`, `APP_KEY` kuat dan stabil, `APP_URL` HTTPS, CORS hanya origin frontend resmi, SMTP kampus, database dengan akun least-privilege, serta `EBRANKAS_BACKUP_PASSWORD` acak minimal 32 karakter. Jangan mengganti `APP_KEY` setelah file soal dan token terenkripsi dibuat tanpa rencana migrasi kunci.
3. Verifikasi host mendukung ZipArchive AES-256, buat backup terenkripsi, lalu lakukan uji restore. Amankan/rotasi arsip lama yang belum terenkripsi. Pastikan ACL direktori backup, storage, dan log membatasi akses.
4. Jalankan `composer audit`, pemeriksaan dependency frontend, test, typecheck, dan production build pada staging; uji alur role, OTP/email, upload PDF, token Sanctum, serta expiry. Belum ada hasil untuk pemeriksaan ini pada audit source-only.
5. Jadwalkan `php artisan schedule:run` tiap menit; scheduler menangani penutupan sesi, backup harian, dan pembersihan token Sanctum kedaluwarsa. Gunakan cache bersama seperti Redis bila aplikasi berjalan pada lebih dari satu instance agar rate limit konsisten.
6. Fitur cetak belum siap diaktifkan: frontend memanggil `/cetak/{id}`, tetapi endpoint belum terdaftar pada route API/web. Putuskan untuk menonaktifkannya pada rilis awal atau implementasikan dan uji route dengan middleware Panitia, rate limit PIN, audit log, dan kebijakan spool.

Laravel merekomendasikan `APP_DEBUG=false` dan optimasi autoloader/config saat deployment ([panduan deployment resmi](https://laravel.com/docs/10.x/deployment)). Sanctum juga mendukung masa berlaku token dan pembersihan token kedaluwarsa ([dokumentasi Sanctum](https://laravel.com/docs/10.x/sanctum)).
