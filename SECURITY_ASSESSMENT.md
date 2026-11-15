# Penilaian Keamanan SIKASA

## Kontrol yang diterapkan

- API internal memakai Sanctum dan pemeriksaan role.
- PDF upload divalidasi dan dienkripsi dengan Laravel Crypt (AES-256-CBC) sebelum disimpan di private storage.
- Akses soal hanya tersedia untuk soal disetujui dan sesi yang aktif dalam jendela waktu.
- QR memakai token acak 256-bit; database menyimpan SHA-256 hash untuk verifikasi dan ciphertext untuk ditampilkan kembali hanya melalui API Panitia. Token memiliki expiry dan dapat dirotasi/dicabut.
- Roster peserta diimpor per sesi. Email dienkripsi di database. OTP enam digit disimpan sebagai HMAC/hash dengan expiry dan batas percobaan; verifikasi menghasilkan kredensial singkat yang disimpan dalam hash.
- Request OTP dan verifikasi dibatasi per-IP oleh route throttle dan per-NIM oleh limiter. Respons permintaan OTP tidak mengungkap apakah NIM ada di roster.
- Endpoint PDF memeriksa QR, kredensial peserta, approval, status, dan waktu setiap kali; PDF didekripsi di memori dan dikirim `no-store`.
- Log akses merekam peserta terdaftar dan aktivitas akses tanpa menyimpan OTP/token.
- Viewer melaporkan event saat halaman menjadi tersembunyi; tiga laporan mengunci kredensial dan dicatat pada `log_pelanggaran_ujian`. Panitia mengajukan pembukaan setelah konfirmasi, lalu Admin IT memprosesnya; pembukaan memerlukan OTP ulang.
- CORS memakai allowlist yang dapat diatur; middleware menambah header dasar. HTTPS tetap persyaratan deployment.

## Risiko dan batas perlindungan

| Area | Kondisi dan tindak lanjut |
|---|---|
| Identitas mahasiswa | OTP membuktikan kontrol email roster, bukan identitas formal. Gunakan roster resmi dan email kampus yang telah divalidasi; integrasi SSO dapat menjadi pengembangan berikutnya. |
| Kebocoran QR | QR adalah bearer link sampai verifikasi mahasiswa. Tampilkan hanya pada saat/tempat ujian, rotasi/revoke jika bocor, dan gunakan HTTPS. |
| Salinan PDF | PDF.js tanpa kontrol unduh/cetak UI dan watermark mengurangi kemudahan salin. Browser tetap menerima byte PDF; screenshot, foto, developer tools, dan cara tangkap lain tidak bisa sepenuhnya dicegah. |
| Pengiriman PDF | Viewer mengunduh satu blob maksimal sesuai batas upload 10 MB dan tidak memakai Range. Setiap pemanggilan endpoint tetap divalidasi. |
| Deteksi pindah tab | `visibilitychange` mengurangi peluang mahasiswa meninggalkan halaman tanpa tercatat, tetapi browser tidak memberi kontrol untuk benar-benar melarang tab lain, split screen, atau perangkat kedua. Event saat koneksi putus juga dapat gagal terkirim. |
| Kunci aplikasi | `APP_KEY` melindungi file dan email terenkripsi serta token QR ciphertext. Backup dengan aman dan rencanakan prosedur re-enkripsi sebelum rotasi. Jangan commit `.env`. |
| Email/OTP | Konfigurasikan SMTP dengan TLS dan akun pengirim tepercaya. Uji pengiriman, batas kirim, dan deliverability sebelum hari ujian. Jangan masukkan alamat email penuh atau OTP ke log. |
| Infrastruktur | Arahkan CORS ke origin frontend yang benar, gunakan HTTPS, trusted proxy yang benar, dan batasi akses jaringan server/database. Jalankan scheduler setiap menit. |
| Pembatasan percobaan | Laravel cache limiter harus memakai backend cache yang sesuai untuk beberapa instance; cache lokal per server tidak membagi rate limit antar-node. |
| Audit DB | Migrasi mengubah status/token dan menambah roster; backup dan verifikasi schema target sebelum penerapan. |

## Catatan deployment

Nilai `SIKASA_FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `API_BASE`, SMTP, `APP_URL`, HTTPS, `APP_KEY`, dan scheduler harus diperiksa pada server ujian. `localhost` pada URL QR tidak dapat dijangkau ponsel mahasiswa. Impor roster dari sumber institusi tepercaya; jangan menjalankan sesi aktif tanpa roster peserta yang sudah diverifikasi.
