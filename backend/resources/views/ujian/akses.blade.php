<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <meta name="referrer" content="no-referrer">
    <title>Akses Soal Ujian · SIAGA</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; background: #f4f5f7; color: #202126; font: 16px system-ui, sans-serif; }
        main { width: min(100% - 28px, 820px); margin: 20px auto; padding: clamp(18px,4vw,28px); border: 1px solid #e2e5e9; border-radius: 20px; background: white; }
        h1 { margin: 0 0 8px; font-size: 24px; }
        p { color: #647084; line-height: 1.5; }
        label { display: block; margin-top: 16px; font-size: 13px; font-weight: 700; }
        input { width: 100%; margin-top: 7px; padding: 12px; border: 1px solid #d8dde5; border-radius: 10px; font: inherit; }
        button { width: 100%; margin-top: 20px; padding: 13px; border: 0; border-radius: 10px; background: #202126; color: white; font-weight: 700; }
        button:disabled { opacity: .55; }
        .error { padding: 12px; border-radius: 10px; background: #fff0f0; color: #a12b2b; }
        .meta { font-size: 13px; }
        iframe { width: 100%; height: min(76vh, 1000px); margin-top: 12px; border: 1px solid #e2e5e9; border-radius: 10px; background: #e9ebef; }
        [hidden] { display: none !important; }
    </style>
</head>
<body>
<main>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <div aria-hidden="true" style="display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#202126;color:#f5cf25;font-weight:900;font-size:20px">S</div>
        <div><strong style="display:block;letter-spacing:.08em">SIAGA</strong><span class="meta">Sistem Akademik Garda Aman · FEB</span></div>
    </div>
    <h1>Akses Soal Ujian</h1>
    @if ($error)
        <p class="error">{{ $error }}</p>
    @endif
    @if ($sesi)
        <p><strong>{{ $sesi->nama_ujian ?: $sesi->soal?->judul }}</strong> · {{ $sesi->soal?->mataKuliah?->nama_mk }} · {{ $sesi->soal?->jenis }}</p>
        <p class="meta">Dosen: {{ $sesi->soal?->dosen?->nama ?? '-' }} · Kelas: {{ $sesi->soal?->mataKuliah?->kelas ?? '-' }} · Program studi: {{ $sesi->program_studi ?? '-' }}</p>
        <p class="meta">Jadwal: {{ $sesi->waktu_mulai->format('d-m-Y H:i') }}–{{ $sesi->waktu_selesai->format('H:i') }}</p>
    @endif
    @if ($sesi && ! $error)
        <p class="meta">NIM dicocokkan dengan roster ujian. Kode sekali pakai dikirim ke email peserta yang terdaftar. Jawaban tetap ditulis pada lembar kertas.</p>
        <form id="otp-request-form">
            <label for="nim">NIM</label>
            <input id="nim" maxlength="40" autocomplete="username" inputmode="numeric" required>
            <button id="request-button" type="submit">Kirim Kode Verifikasi</button>
        </form>
        <p id="otp-instruction" class="meta" hidden>Jika NIM terdaftar, kode dikirim ke email yang terhubung pada roster sesi ini.</p>
        <form id="otp-verify-form" hidden>
            <label for="otp">Kode verifikasi 6 digit</label>
            <input id="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required>
            <button id="verify-button" type="submit">Verifikasi dan Buka Soal</button>
        </form>
        <p id="error-message" class="error" hidden></p>
        <p id="remaining-time" class="meta" hidden></p>
        <div id="viewer-wrap" style="position:relative" hidden>
            <iframe id="pdf-viewer" title="Soal ujian PDF" referrerpolicy="no-referrer"></iframe>
            <div id="watermark" aria-hidden="true" style="position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;pointer-events:none;opacity:.18;color:#111;font-size:clamp(16px,4vw,30px);font-weight:800;transform:rotate(-24deg);text-align:center"></div>
        </div>
        <script>
            const requestForm = document.getElementById('otp-request-form');
            const verifyForm = document.getElementById('otp-verify-form');
            const requestButton = document.getElementById('request-button');
            const verifyButton = document.getElementById('verify-button');
            const error = document.getElementById('error-message');
            const instruction = document.getElementById('otp-instruction');
            const viewerWrap = document.getElementById('viewer-wrap');
            const viewer = document.getElementById('pdf-viewer');
            const watermark = document.getElementById('watermark');
            const remaining = document.getElementById('remaining-time');
            const baseEndpoint = @json(url('/api/ujian-online/akses/'.$token));
            const pdfEndpoint = baseEndpoint + '/pdf';
            const endAt = new Date(@json($sesi->waktu_selesai->toIso8601String())).getTime();
            const nimInput = document.getElementById('nim');
            let accessToken = null;
            let pdfUrl = null;
            let timer = null;
            const showError = (message) => { error.textContent = message; error.hidden = false; };
            const closeViewer = () => {
                viewer.src = 'about:blank';
                viewerWrap.hidden = true;
                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                pdfUrl = null;
                accessToken = null;
            };
            requestForm.addEventListener('submit', async (event) => {
                event.preventDefault(); requestButton.disabled = true; error.hidden = true;
                try {
                    const response = await fetch(baseEndpoint + '/otp', { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ nim: nimInput.value.trim() }) });
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(body.message || 'Kode belum dapat diminta.');
                    instruction.hidden = false; verifyForm.hidden = false; document.getElementById('otp').focus();
                } catch (exception) { showError(exception instanceof Error ? exception.message : 'Gagal meminta kode.'); }
                finally { requestButton.disabled = false; }
            });
            verifyForm.addEventListener('submit', async (event) => {
                event.preventDefault(); verifyButton.disabled = true; error.hidden = true;
                try {
                    const response = await fetch(baseEndpoint + '/verifikasi', { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ nim: nimInput.value.trim(), kode: document.getElementById('otp').value.trim() }) });
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(body.message || 'Verifikasi gagal.');
                    accessToken = body.access_token;
                    watermark.textContent = body.nama + ' · NIM ' + body.nim + ' · SIAGA';
                    const pdfResponse = await fetch(pdfEndpoint, { method: 'POST', headers: { 'Accept': 'application/pdf', 'Authorization': 'Bearer ' + accessToken } });
                    if (!pdfResponse.ok) { const pdfError = await pdfResponse.json().catch(() => ({})); throw new Error(pdfError.message || 'PDF belum dapat dibuka.'); }
                    pdfUrl = URL.createObjectURL(await pdfResponse.blob());
                    viewer.src = pdfUrl + '#toolbar=0&navpanes=0'; viewerWrap.hidden = false;
                    requestForm.hidden = true; verifyForm.hidden = true; instruction.hidden = true; remaining.hidden = false;
                    const updateRemaining = () => {
                        const seconds = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
                        if (seconds <= 0) { closeViewer(); remaining.textContent = 'Waktu ujian berakhir. Akses soal telah ditutup.'; clearInterval(timer); return; }
                        remaining.textContent = 'Sisa waktu akses: ' + Math.floor(seconds / 60) + ' menit ' + (seconds % 60) + ' detik';
                    };
                    updateRemaining(); timer = setInterval(updateRemaining, 1000);
                } catch (exception) { showError(exception instanceof Error ? exception.message : 'Verifikasi atau pembukaan soal gagal.'); }
                finally { verifyButton.disabled = false; }
            });
            window.addEventListener('pagehide', () => { if (timer) clearInterval(timer); closeViewer(); });
        </script>
    @elseif (! $sesi && ! $error)
        <p class="error">Sesi ujian tidak ditemukan.</p>
    @endif
</main>
</body>
</html>
