import { useEffect, useMemo, useRef, useState } from "react"
import * as pdfjs from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { API_BASE } from "./db"
import "./student-access.css"

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

type ExamInfo = {
  nama_ujian: string
  nama_mk: string | null
  kode_mk: string | null
  dosen: string | null
  kelas: string | null
  semester: number | null
  tahun_ajaran: string | null
  program_studi: string | null
  waktu_mulai: string
  waktu_selesai: string
  status: string
  pesan_status: string | null
}

type Props = { token: string }

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(seconds / 60)} menit ${seconds % 60} detik`
}

export default function StudentAccess({ token }: Props) {
  const [exam, setExam] = useState<ExamInfo | null>(null)
  const [loadingExam, setLoadingExam] = useState(true)
  const [loading, setLoading] = useState(false)
  const [nim, setNim] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [student, setStudent] = useState<{ nama: string; nim: string } | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [violationCount, setViolationCount] = useState(0)
  const [accessLocked, setAccessLocked] = useState(false)
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [remaining, setRemaining] = useState("")
  const [nowTick, setNowTick] = useState(Date.now())
  const [watermarkTime, setWatermarkTime] = useState(() => new Date().toLocaleString("id-ID"))
  const [containerWidth, setContainerWidth] = useState(900)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loadingTaskRef = useRef<pdfjs.PDFDocumentLoadingTask | null>(null)
  const endAt = useMemo(() => exam ? new Date(exam.waktu_selesai).getTime() : 0, [exam])
  const base = `${API_BASE}/ujian-online/akses/${encodeURIComponent(token)}`
  const canVerify = exam?.status === "active" && nowTick >= new Date(exam.waktu_mulai).getTime() && nowTick < endAt

  useEffect(() => {
    let alive = true
    fetch(base, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || "QR tidak valid atau sudah kedaluwarsa.")
        if (alive) setExam(body.data)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal memuat sesi ujian."))
      .finally(() => { if (alive) setLoadingExam(false) })
    return () => { alive = false }
  }, [base])

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const updateWatermark = () => setWatermarkTime(new Date().toLocaleString("id-ID"))
    const interval = window.setInterval(updateWatermark, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const refreshStatus = async () => {
    setLoadingExam(true); setError("")
    try {
      const response = await fetch(base, { headers: { Accept: "application/json" }, cache: "no-store" })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || "QR tidak valid.")
      setExam(body.data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Status sesi gagal diperbarui.") }
    finally { setLoadingExam(false) }
  }

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => setContainerWidth(entries[0]?.contentRect.width ?? 900))
    observer.observe(element)
    return () => observer.disconnect()
  }, [pdf])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    let renderTask: ReturnType<pdfjs.PDFPageProxy["render"]> | undefined
    const render = async () => {
      try {
        const pdfPage = await pdf.getPage(page)
        if (cancelled || !canvasRef.current) return
        const baseViewport = pdfPage.getViewport({ scale: 1 })
        const fitted = Math.min(containerWidth / baseViewport.width, 1.5) * zoom
        const viewport = pdfPage.getViewport({ scale: fitted })
        const canvas = canvasRef.current
        const context = canvas.getContext("2d", { alpha: false })
        if (!context) throw new Error("Canvas PDF tidak tersedia di browser ini.")
        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        renderTask = pdfPage.render({ canvas, canvasContext: context, viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined })
        await renderTask.promise
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Halaman PDF gagal ditampilkan.")
      }
    }
    void render()
    return () => { cancelled = true; renderTask?.cancel() }
  }, [pdf, page, zoom, containerWidth])

  useEffect(() => {
    if (!pdf || !endAt) return
    const update = () => {
      const left = endAt - Date.now()
      if (left <= 0) {
        setRemaining("Waktu ujian berakhir. Akses soal ditutup.")
        setPdf(null)
        void loadingTaskRef.current?.destroy()
        loadingTaskRef.current = null
        return false
      }
      setRemaining(`Sisa waktu akses: ${formatRemaining(left)}`)
      return true
    }
    if (!update()) return
    const interval = window.setInterval(() => { if (!update()) window.clearInterval(interval) }, 1000)
    return () => window.clearInterval(interval)
  }, [pdf, endAt])

  useEffect(() => {
    if (!pdf || !accessToken || accessLocked) return
    let lastViolationAt = 0
    let alive = true
    const reportHiddenTab = async (pageLeaving = false) => {
      if ((!pageLeaving && document.visibilityState !== "hidden") || Date.now() - lastViolationAt < 2500) return
      lastViolationAt = Date.now()
      try {
        const response = await fetch(`${base}/pelanggaran`, {
          method: "POST",
          keepalive: true,
          headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ jenis: "tab_hidden" }),
        })
        const body = await response.json().catch(() => ({}))
        if (!alive) return
        if (typeof body.violations === "number") setViolationCount(body.violations)
        if (response.status === 423 || body.locked) {
          setAccessLocked(true)
          setAccessToken(null)
          setPdf(null)
          void loadingTaskRef.current?.destroy()
          loadingTaskRef.current = null
          setNotice(body.message || "Akses dikunci. Hubungi Panitia untuk meminta pemeriksaan.")
        } else if (response.ok) {
          setNotice(body.message || "Peringatan: jangan meninggalkan halaman soal.")
        }
      } catch {
        // Hilangnya fokus dapat menghentikan koneksi pada browser tertentu;
        // pembatasan akses tetap ditegakkan server untuk laporan yang diterima.
      }
    }
    const reportPageHide = () => { void reportHiddenTab(true) }
    const onVisibilityChange = () => { void reportHiddenTab() }
    const heartbeat = async () => {
      try {
        const response = await fetch(`${base}/heartbeat`, { method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` } })
        if (response.status === 423 && alive) {
          setAccessLocked(true)
          setAccessToken(null)
          setPdf(null)
          void loadingTaskRef.current?.destroy()
          loadingTaskRef.current = null
          setNotice("Akses dikunci. Hubungi Panitia untuk meminta pemeriksaan.")
        }
      } catch { /* Tidak mengganggu tampilan soal jika koneksi sesaat terputus. */ }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", reportPageHide)
    const heartbeatTimer = window.setInterval(() => void heartbeat(), 5 * 60 * 1000)
    return () => {
      alive = false
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", reportPageHide)
      window.clearInterval(heartbeatTimer)
    }
  }, [pdf, accessToken, accessLocked, base])

  useEffect(() => () => { void loadingTaskRef.current?.destroy() }, [])

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setNotice("")
    try {
      const response = await fetch(`${base}/otp`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ nim: nim.trim() }) })
      const body = await response.json().catch(() => ({}))
      if (response.status === 423) setAccessLocked(true)
      if (!response.ok) throw new Error(body.message || "Kode belum dapat diminta.")
      setOtpSent(true); setNotice(body.message)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal meminta kode verifikasi.") }
    finally { setLoading(false) }
  }

  const verifyAndOpen = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setNotice("")
    try {
      const response = await fetch(`${base}/verifikasi`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ nim: nim.trim(), kode: otp.trim() }) })
      const body = await response.json().catch(() => ({}))
      if (response.status === 423) setAccessLocked(true)
      if (!response.ok) throw new Error(body.message || "Verifikasi gagal.")
      setStudent({ nama: body.nama, nim: body.nim })
      setAccessToken(body.access_token)
      setViolationCount(0)
      const pdfResponse = await fetch(`${base}/pdf`, { method: "POST", cache: "no-store", headers: { Accept: "application/pdf", Authorization: `Bearer ${body.access_token}` } })
      if (!pdfResponse.ok) {
        const pdfError = await pdfResponse.json().catch(() => ({}))
        if (pdfResponse.status === 423) setAccessLocked(true)
        throw new Error(pdfError.message || "PDF belum dapat dibuka.")
      }
      const bytes = new Uint8Array(await pdfResponse.arrayBuffer())
      const loadingTask = pdfjs.getDocument({ data: bytes })
      loadingTaskRef.current = loadingTask
      const document = await loadingTask.promise
      setPage(1); setPdf(document); setNotice("")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verifikasi atau pembukaan PDF gagal.") }
    finally { setLoading(false) }
  }

  const leaveViewer = () => {
    void loadingTaskRef.current?.destroy(); loadingTaskRef.current = null; setPdf(null); setStudent(null); setAccessToken(null); setOtp(""); setError("")
    if (containerRef.current && document.fullscreenElement) void document.exitFullscreen()
  }

  return (
    <main className={`student-shell${pdf ? " student-shell-viewer" : ""}`}>
      <header className="student-brand"><img className="student-mark" src="/Logo/favicon_io/android-chrome-192x192.png" alt="" /><span><b>SIAGA</b><small>Sistem Akademik Garda Aman · FEB</small></span></header>
      <h1>Akses Soal Ujian</h1>
      {loadingExam && <section aria-label="Memuat informasi sesi" role="status" className="animate-pulse rounded-[18px] border border-slate-200 bg-white p-5"><div className="h-5 w-2/5 rounded bg-slate-200"/><div className="mt-3 h-4 w-3/5 rounded bg-slate-200"/><div className="mt-5 grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3, 4, 5].map((item) => <div className="h-4 rounded bg-slate-100" key={item}/>)}</div><div className="mt-5 h-10 rounded-lg bg-slate-100"/></section>}
      {exam && <section className="exam-card">
        <h2>{exam.nama_ujian}</h2>
        <p>{exam.nama_mk ?? "Mata kuliah"} · {exam.kode_mk ?? "-"}</p>
        <dl className="exam-meta"><div><dt>Dosen</dt><dd>{exam.dosen ?? "-"}</dd></div><div><dt>Kelas</dt><dd>{exam.kelas ?? "-"}</dd></div><div><dt>Program studi</dt><dd>{exam.program_studi ?? "-"}</dd></div><div><dt>Semester</dt><dd>{exam.semester ?? "-"} · {exam.tahun_ajaran ?? "-"}</dd></div><div><dt>Mulai</dt><dd>{new Date(exam.waktu_mulai).toLocaleString("id-ID")}</dd></div><div><dt>Selesai</dt><dd>{new Date(exam.waktu_selesai).toLocaleString("id-ID")}</dd></div></dl>
        {!pdf && <p className={canVerify ? "status-ready" : "status-wait"}>{canVerify ? "Sesi aktif. Verifikasi identitas untuk membaca soal." : exam.pesan_status || `Status sesi: ${exam.status}`}</p>}
      </section>}
      {accessLocked && <section role="alert" className="rounded-[18px] border border-rose-200 bg-rose-50 p-5 text-rose-900"><h2>Akses soal dikunci</h2><p className="mt-2 text-sm leading-relaxed">Halaman soal terdeteksi ditinggalkan sebanyak tiga kali. Hubungi Panitia di ruang ujian untuk pemeriksaan. Panitia akan meminta bantuan Admin IT; setelah dibuka, kamu perlu verifikasi OTP kembali.</p></section>}
      {exam && !canVerify && !pdf && <button className="student-refresh" onClick={() => void refreshStatus()} disabled={loadingExam}>{loadingExam ? "Memeriksa..." : "Perbarui status sesi"}</button>}
      {exam && canVerify && !pdf && !accessLocked && <section className="verify-card">
        <div className="verify-intro"><span className="verify-step">Langkah 1 dari 2</span><p>Masukkan NIM yang terdaftar. Kode verifikasi akan dikirim ke email kampus pada roster sesi.</p></div>
        <form className="verify-step-card" onSubmit={requestCode}>
          <label htmlFor="student-nim">NIM</label><input id="student-nim" required maxLength={40} inputMode="numeric" autoComplete="username" value={nim} onChange={(e) => { setNim(e.target.value); setOtp(""); setOtpSent(false); setNotice(""); setError("") }} />
          <button disabled={loading}>{loading ? "Memproses..." : "Kirim kode ke email terdaftar"}</button>
        </form>
        {otpSent && <form className="verify-step-card verify-step-card-next" onSubmit={verifyAndOpen}>
          <span className="verify-step">Langkah 2 dari 2</span>
          <label htmlFor="student-otp">Kode OTP 6 digit</label><input id="student-otp" required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value)} />
          <button disabled={loading}>{loading ? "Memverifikasi..." : "Verifikasi dan buka soal"}</button>
        </form>}
        {notice && <p className="student-notice">{notice}</p>}
        {error && <p role="alert" className="student-error">{error}</p>}
      </section>}
      {student && loading && !pdf && <section aria-label="Memuat dokumen soal" role="status" className="animate-pulse rounded-[18px] border border-slate-200 bg-white p-5"><div className="flex flex-wrap gap-3"><div className="h-8 w-36 rounded-lg bg-slate-200"/><div className="h-8 w-28 rounded-lg bg-slate-100"/><div className="h-8 w-24 rounded-lg bg-slate-100"/></div><div className="mt-5 grid min-h-[55vh] place-items-center rounded-lg bg-slate-100 p-6"><div className="h-[45vh] w-full max-w-2xl rounded bg-white shadow-sm"/></div></section>}
      {pdf && <section className="pdf-shell">
        <div className="pdf-toolbar">
          <div className="pdf-session-info">
            <div className="pdf-student"><span className="pdf-eyebrow">Peserta ujian</span><strong>{student?.nama}</strong><span>NIM {student?.nim}</span></div>
            <div className="pdf-status"><span className="pdf-time">{remaining}</span><span className="pdf-warning">Peringatan perpindahan tab <strong>{violationCount}/3</strong></span></div>
          </div>
          <div className="pdf-actions">
            <div className="pdf-control-group" aria-label="Navigasi halaman"><button disabled={page <= 1} aria-label="Halaman sebelumnya" onClick={() => setPage((n) => Math.max(1, n - 1))}>‹ Sebelumnya</button><span className="pdf-control-value">Halaman {page} / {pdf.numPages}</span><button disabled={page >= pdf.numPages} onClick={() => setPage((n) => Math.min(pdf.numPages, n + 1))}>Berikutnya ›</button></div>
            <div className="pdf-control-group" aria-label="Ukuran tampilan"><button disabled={zoom <= 0.7} aria-label="Perkecil tampilan" onClick={() => setZoom((n) => Math.max(0.7, Math.round((n - 0.1) * 10) / 10))}>−</button><span className="pdf-control-value">{Math.round(zoom * 100)}%</span><button disabled={zoom >= 2} aria-label="Perbesar tampilan" onClick={() => setZoom((n) => Math.min(2, Math.round((n + 0.1) * 10) / 10))}>+</button></div>
            <div className="pdf-control-group pdf-view-actions"><button onClick={() => containerRef.current?.requestFullscreen?.()}>Layar penuh</button><button className="pdf-close" onClick={leaveViewer}>Tutup soal</button></div>
          </div>
        </div>
        {notice && <p role="alert" className="student-notice">{notice}</p>}
        <div ref={containerRef} className="pdf-viewport">
          <div className="pdf-page-wrap"><canvas ref={canvasRef} aria-label={`Halaman ${page} dari ${pdf.numPages}`} /><div className="pdf-watermark" aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridTemplateRows: "repeat(4, minmax(0, 1fr))", transform: "none", opacity: 1, color: "inherit", fontSize: "inherit" }}>{Array.from({ length: 12 }, (_, index) => <span key={index} style={{ color: "rgba(120, 25, 25, 0.30)", fontSize: "clamp(8px, 1.1vw, 12px)", lineHeight: 1.35, fontWeight: 800, transform: "rotate(-27deg)", textShadow: "0 0 3px rgba(255,255,255,.9)", overflowWrap: "anywhere" }}>{student?.nama} · NIM {student?.nim}<br />{exam?.nama_ujian} · {watermarkTime}</span>)}</div></div>
          <p className="pdf-page-caption">Halaman {page} dari {pdf.numPages}</p>
        </div>
        {error && <p role="alert" className="student-error">{error}</p>}
      </section>}
      <footer className="student-footer">Dokumen soal bersifat rahasia. Jangan membagikan foto atau salinan. Jawaban ujian dikumpulkan secara fisik.</footer>
    </main>
  )
}
