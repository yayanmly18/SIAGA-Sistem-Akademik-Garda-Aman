# SYSTEM_AUDIT.md — SIKASA

Audit and implementation snapshot: 2026-11-15. This describes the current workspace and its remaining deployment prerequisites.

## Ringkasan

SIKASA memakai SPA React 19/TypeScript/Vite dan API Laravel 10 dengan MySQL/MariaDB. Upload PDF soal dienkripsi memakai Laravel Crypt dengan cipher AES-256-CBC lalu disimpan pada disk privat Laravel. Kaprodi menyetujui soal sebelum Panitia dapat menjadwalkannya. Distribusi soal dilakukan melalui QR dan PDF.js; mahasiswa tetap mengerjakan jawaban di kertas.

Alur QR sekarang memakai token acak 256-bit. Database menyimpan SHA-256 token untuk pencarian dan salinan token terenkripsi dengan APP_KEY agar Panitia dapat menampilkan QR kembali. Token kedaluwarsa mengikuti waktu sesi dan dapat dirotasi atau dicabut. Sebelum PDF diberikan, mahasiswa harus tercantum pada roster sesi dan menyelesaikan OTP yang dikirim ke email roster. Identitas/email roster harus berasal dari data resmi kampus yang benar; OTP hanya membuktikan kendali atas alamat email tersebut.

## Temuan arsitektur

- `src/App.tsx`, `src/db.ts`: SPA internal, API client, navigasi role, serta manajemen sesi/QR/roster.
- `src/StudentAccess.tsx`: halaman hash route publik bagi mahasiswa dan viewer PDF.js responsif.
- `backend/routes/api.php`: API Sanctum ber-role untuk staf serta endpoint publik QR/OTP/PDF dengan throttle.
- `BankSoalController`, `SesiUjianController`, `PesertaSesiUjianController`, `UjianOnlineController`: upload/persetujuan, lifecycle sesi, roster, dan distribusi soal.
- `FileProtectionService`, `QrTokenService`: enkripsi file dan pengelolaan kredensial QR.
- `AksesDiblokirController`: alur penguncian tiga pelanggaran, permintaan Panitia, dan pembukaan akses oleh Admin IT.
- `app/Console/Kernel.php`: penutupan sesi kedaluwarsa tiap menit; endpoint juga menolak akses langsung setelah batas waktu.
- `SecurityHeaders` dan `config/cors.php`: header dasar keamanan dan daftar origin CORS yang dapat dikonfigurasi.

## Kondisi alur

1. Dosen mengunggah PDF; backend mengenkripsi byte dan menyimpan file privat.
2. Kaprodi meninjau soal lewat endpoint terproteksi dan menyetujui/menolak.
3. Panitia membuat sesi dari soal disetujui, mengisi jadwal/metadata, dan mengimpor roster CSV (`nim,nama,email`).
4. Panitia mengaktifkan sesi setelah roster tersedia; QR berisi token acak, bukan path PDF atau ID file.
5. Mahasiswa membuka QR, memasukkan NIM, meminta OTP ke email dalam roster, lalu menukar OTP untuk kredensial akses singkat.
6. PDF.js meminta PDF dari endpoint yang memvalidasi token QR, status/jadwal sesi, persetujuan soal, dan kredensial mahasiswa. Log akses mencatat identitas roster dan waktu.
7. Saat viewer menjadi tersembunyi, server mencatat pelanggaran. Tiga pelanggaran mengunci peserta dan mencabut kredensial; Panitia dapat meminta Admin IT membuka akses setelah konfirmasi. Mahasiswa yang dibuka harus verifikasi OTP lagi.
8. Akses ditolak setelah sesi berakhir, ditutup, dibatalkan, atau token dicabut. Scheduler memperbarui status persisten.

## Batasan dan risiko yang masih ada

- Belum ada integrasi SSO atau sumber roster resmi. Panitia harus mengimpor roster dari sumber tepercaya dan memastikan email institusional benar. OTP email bukan jaminan identitas kampus jika roster/email salah.
- PDF dibaca sebagai blob terbatas (batas upload saat ini 10 MB), tanpa HTTP Range. Browser menerima byte PDF untuk merendernya; watermark dan penyembunyian tombol unduh/cetak tidak dapat mencegah screenshot, fotografi layar, atau ekstraksi dari browser.
- Deteksi pindah tab mengandalkan `visibilitychange`; browser tidak bisa benar-benar melarang perpindahan tab, split screen, atau pemakaian perangkat lain. Jika jaringan terputus saat event dilaporkan, pelanggaran mungkin tidak terkirim.
- Relasi sesi saat ini unik per `bank_soal_id`, sehingga satu dokumen soal belum dapat dipakai oleh beberapa sesi/kelas. Perubahan ini perlu desain dan migrasi terpisah jika dibutuhkan.
- Semua enkripsi file dan email terenkripsi bergantung pada `APP_KEY`. Backup key dan prosedur rotasi/re-enkripsi perlu disiapkan operator.
- Migrasi sudah dijalankan pada database lokal workspace. Deployment harus memeriksa backup, koneksi, dan status migrasi database target sebelum `php artisan migrate`.
- Modul cetak/riwayat printer lama masih ada untuk kebutuhan historis sistem. Distribusi soal sesi baru memakai QR; penghapusan tabel atau modul lama tidak dilakukan.

## Status implementasi dan verifikasi

Implementasi sesi, token hash/expiry/revoke, roster dan OTP email, PDF.js viewer, log akses, CORS/header, scheduler, serta feature tests telah ditambahkan. Build frontend dan test backend/frontend harus dijalankan kembali setelah perubahan terakhir; detail hasil dicatat pada laporan penutup pekerjaan. Persyaratan operasional sebelum ujian: konfigurasi SMTP, origin frontend, URL yang dapat dijangkau HP, HTTPS, APP_KEY yang terjaga, roster valid, dan scheduler aktif.
