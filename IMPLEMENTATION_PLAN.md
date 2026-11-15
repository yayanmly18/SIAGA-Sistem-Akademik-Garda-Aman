# Rencana dan Status Implementasi SIKASA

## Tahap 1 — Audit

Selesai: pemeriksaan frontend React/Vite, API Laravel, routes, role, model/migrasi, approval, penyimpanan terenkripsi, dan jalur distribusi soal. Temuan aktual dicatat dalam `SYSTEM_AUDIT.md`, `EXISTING_ARCHITECTURE.md`, `DATABASE_ANALYSIS.md`, dan `SECURITY_ASSESSMENT.md`.

## Tahap 2 — Sesi dan QR

Diimplementasikan:

- Sesi ujian terhubung ke soal yang telah disetujui; metadata ujian, mata kuliah, dosen/kelas, tanggal, waktu, program studi, dan keterangan.
- Lifecycle `draft → scheduled → active`, dengan status `suspended`, `completed`, dan `cancelled` serta validasi transisi/alasan.
- Aktifasi mensyaratkan soal disetujui, roster peserta ada, jadwal valid, dan QR aktif.
- Token QR 256-bit tersimpan sebagai hash dan ciphertext, memiliki expiry, dapat dirotasi/dicabut, dan tidak mengekspos file.
- Panitia dapat mengelola peserta lewat CSV dengan kolom `nim,nama,email`, mengunduh/menampilkan QR, melihat log, menutup, dan memperpanjang sesi dengan alasan.

## Tahap 3 — Verifikasi dan PDF

Diimplementasikan: NIM dicocokkan dengan roster sesi; OTP dikirim melalui Laravel Mail ke email roster; OTP memiliki expiry dan batas percobaan. Token akses singkat disimpan berbentuk hash. React PDF.js viewer menampilkan navigasi halaman, zoom, fullscreen, timer, dan watermark. PDF tetap terenkripsi di private storage, didekripsi di backend setelah validasi dan dikirim sebagai respons tanpa cache. Tidak ada fitur pengerjaan atau penilaian online.

Keputusan identitas: tidak ditemukan akun mahasiswa/SSO dalam sistem. Implementasi memakai roster per sesi sebagai faktor pencocokan dan OTP email. OTP email tidak menjamin identitas formal, sehingga sumber roster dan alamat institusi harus diverifikasi. Integrasi SSO kampus memerlukan kredensial/dokumentasi institusi dan belum diasumsikan.

## Tahap 4 — Keamanan dan operasi

Diimplementasikan: throttle endpoint, limit OTP/percobaan, respons generik roster, log akses, CORS allowlist, header keamanan, scheduler penutup sesi, token revoke, dan verifikasi waktu pada setiap permintaan PDF. Event halaman tersembunyi dihitung; pelanggaran ketiga mengunci kredensial, Panitia mengajukan pembukaan dengan catatan, dan Admin IT membuka akses setelah konfirmasi. Pembukaan mengharuskan OTP ulang. Pengiriman PDF menggunakan blob terbatas sesuai batas upload; tidak memakai Range.

Sebelum produksi: atur host frontend/backend yang dapat dijangkau HP, CORS, SMTP, HTTPS, APP_KEY, cache limiter bersama bila multi-node, roster resmi, dan Laravel Scheduler.

## Tahap 5 — Verifikasi

Feature tests backend mencakup OTP/PDF terproteksi, token revoked/expired, roster terenkripsi, larangan aktivasi tanpa peserta, hitungan tiga pelanggaran, permintaan Panitia, dan pembukaan Admin IT. Frontend memiliki test helper/API. Verifikasi akhir menjalankan typecheck, test frontend, build, test Laravel, dan status migration pada database lokal. Pengujian perangkat HP, SMTP produksi, schema server target, dan sesi nyata harus dilakukan di lingkungan kampus.

## Kriteria penerimaan

- Hanya soal disetujui dapat digunakan dan sesi aktif wajib memiliki roster.
- PDF soal berada di private storage dalam keadaan terenkripsi.
- QR tidak mengandung path PDF; token dapat expired/dirotasi/dicabut.
- Mahasiswa harus lolos pencocokan roster dan OTP sebelum PDF dibuka.
- Akses PDF ditolak setelah jadwal/status tidak valid; log akses dicatat.
- Tiga laporan pindah halaman mengunci akses; pembukaan butuh permintaan Panitia dan tindakan Admin IT.
- Mahasiswa membaca soal pada browser dan menulis jawaban di kertas; tidak ada CBT/penilaian online.
- Watermark dan kontrol viewer bukan perlindungan absolut dari tangkapan layar atau penyalinan browser.
