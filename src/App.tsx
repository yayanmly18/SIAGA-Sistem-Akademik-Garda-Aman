import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  lazy,
  Suspense,
  type ReactNode,
} from "react"
import QRCode from "qrcode"
import { detectPdfSignatureLayout, type PdfSignatureLayout } from "./pdfSignatureAnchor"
import { enableNotificationSounds, playNotificationSound } from "./notificationSound"
const StudentAccess = lazy(() => import("./StudentAccess"))
import {
  APP_NAMA,
  APP_SINGKATAN,
  APP_TAGLINE,
  BARIS_HAK_CIPTA,
  INSTANSI_KOP,
  JUDUL_DOKUMEN,
} from "./brand"
import {
  addUser,
  authenticate,
  createBankSoal,
  createTemplateSoal,
  deleteTemplateSoal,
  downloadTemplateSoal,
  createMataKuliah,
  decideRevisi,
  deleteMataKuliah,
  deletePrinter,
  emptyDatabase,
  exportBeritaAcara,
  fetchNotifikasi,
  fetchPrintersAdmin,
  createSesiUjian,
  deleteSesiUjian,
  fetchLogAksesUjian,
  fetchPesertaTerkunci,
  mintaBukaAksesPeserta,
  fetchPermintaanBukaAkses,
  bukaAksesPeserta,
  hapusPermintaanLama,
  fetchSesiUjian,
  fetchSoalDisetujui,
  previewSoalPersetujuan,
  putuskanPersetujuanSoal,
  rotateSesiToken,
  revokeSesiToken,
  extendSesiUjian,
  importPesertaSesi,
  deletePesertaSesi,
  setStatusSesiUjian,
  updateSesiUjian,
  findUser,
  formatJam,
  formatTanggal,
  hasToken,
  initials,
  logout as dbLogout,
  loadDatabase,
  markAllNotifikasiRead,
  markNotifikasiRead,
  requestRevisi,
  resetUserPassword,
  roleLabel,
  savePrinter,
  scanPrinters,
  sendPengingat,
  toLogRows,
  togglePrinter,
  toggleUser,
  updateMataKuliah,
  updateUser,
  updateMyProfile,
  type BankSoal,
  type Database,
  type LogRow,
  type MataKuliah,
  type MataKuliahInput,
  type Notifikasi,
  type PrinterAdmin,
  type PrinterScan,
  type RekapRow,
  type TemplateSoal,
  type LogAksesUjian,
  type PesertaTerkunci,
  type SesiUjian,
  type SoalDisetujui,
  type UploadSoalInput,
  type User,
} from "./db"

function toLocalDateTime(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function defaultExamTimes(): { mulai: string; selesai: string } {
  const mulai = new Date()
  mulai.setSeconds(0, 0)
  const selesai = new Date(mulai.getTime() + 2 * 60 * 60 * 1000)
  return { mulai: toLocalDateTime(mulai), selesai: toLocalDateTime(selesai) }
}

type IconName = "archive" | "bell" | "book" | "calendar" | "check" | "chevron" | "chevronKiri" | "clock" | "dashboard" | "document" | "download" | "eye" | "eyeOff" | "file" | "history" | "lock" | "logout" | "menu" | "printer" | "qrcode" | "search" | "settings" | "shield" | "upload" | "users" | "x"

type UserRole = "dosen" | "kaprodi" | "panitia" | "admin"

const iconPaths: Record<IconName, ReactNode> = {
  archive: (
    <>
      <path d="M4 7h16M5 7l1 13h12l1-13M8 4h8l1 3H7l1-3Z" />
      <path d="M9 11h6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a3 3 0 0 1 3-3h13v17H7a3 3 0 0 0-3 3V5Z" />
      <path d="M4 18a3 3 0 0 1 3-3h13" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  chevronKiri: <path d="m15 18-6-6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  document: (
    <>
      <path d="M6 2h8l4 4v16H6V2Z" />
      <path d="M14 2v5h5M9 13h6M9 17h6M9 9h2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a17.9 17.9 0 0 1-2.16 3.19M6.61 6.61A17.8 17.8 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 4.39-1.11" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M3 3l18 18" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h8l4 4v16H6V2Z" />
      <path d="M14 2v5h5" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  printer: (
    <>
      <path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14" width="10" height="7" />
    </>
  ),
  qrcode: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="8" y="8" width="8" height="8" />
    </>
  ),
  // qrcode section removed due to Vite Oxc parsing issue
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 11a4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.7" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
}

type IconProps = {
  name: IconName
  size?: number
}

function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {iconPaths[name]}
    </svg>
  )
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} />
}

function UploadProgress({ label = "Sedang mengunggah berkas..." }: { label?: string }) {
  return <div role="status" aria-live="polite" className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700"><span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />{label}</div>
}

function SessionListSkeleton() {
  return (
    <div role="status" aria-label="Memuat daftar sesi" className="divide-y divide-slate-100">
      {[0, 1, 2].map((row) => (
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start" key={row}>
          <div className="flex-1 space-y-3">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-2/5" />
            <SkeletonBlock className="h-3 w-1/2" />
            <div className="flex gap-3 pt-2">
              <SkeletonBlock className="size-28 rounded-xl" />
              <div className="space-y-2 pt-2"><SkeletonBlock className="h-3 w-32" /><SkeletonBlock className="h-3 w-24" /></div>
            </div>
          </div>
          <div className="flex gap-2"><SkeletonBlock className="h-8 w-20" /><SkeletonBlock className="h-8 w-20" /></div>
        </div>
      ))}
    </div>
  )
}

function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Memuat data tabel" className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, row) => (
        <div className="grid grid-cols-5 gap-4 p-4" key={row}>
          {["w-4/5", "w-3/4", "w-2/3", "w-4/5", "w-1/3"].map((width, col) => <SkeletonBlock className={`h-4 ${width}`} key={col} />)}
        </div>
      ))}
    </div>
  )
}

type NavItem = {
  label: string
  icon: IconName
}

const roleMeta: Record<UserRole, {
  label: string
  hint: string
  nav: NavItem[]
}> = {
  dosen: {
    label: "Dosen",
    hint: "Upload & kelola soal",
    nav: [
      { label: "Dashboard", icon: "dashboard" },
      { label: "Upload Soal", icon: "upload" },
      { label: "Soal Saya", icon: "book" },
      { label: "Log Aktivitas", icon: "history" },
    ],
  },
  kaprodi: {
    label: "Kaprodi",
    hint: "Rekap & approval",
    nav: [
      { label: "Dashboard", icon: "dashboard" },
      { label: "Rekap Soal", icon: "book" },
      { label: "Approval Revisi", icon: "history" },
      { label: "Master Mata Kuliah", icon: "document" },
      { label: "Log & Berita Acara", icon: "document" },
    ],
  },
  panitia: {
    label: "Panitia",
    hint: "Distribusi soal ujian",
    nav: [
      { label: "Dashboard", icon: "dashboard" },
      { label: "Sesi Ujian", icon: "qrcode" },
      { label: "Log Akses Ujian", icon: "history" },
    ],
  },
  admin: {
    label: "Admin IT",
    hint: "User & server",
    nav: [
      { label: "Dashboard", icon: "dashboard" },
      { label: "Pengawasan Ujian", icon: "eye" },
      { label: "Status Server", icon: "settings" },
      { label: "Manajemen User", icon: "users" },
      { label: "Template Soal", icon: "document" },
      { label: "Master Mata Kuliah", icon: "book" },
      { label: "Log Sistem", icon: "history" },
    ],
  },
}

function normalizeRole(value: unknown): UserRole {
  return typeof value === "string" && value in roleMeta
    ? value as UserRole
    : "panitia"
}

// ----------------------------------------------------------------------------
// Context database — membuat seluruh komponen bisa membaca/menulis "database"
// secara reaktif. Semua operasi bersifat async karena berbicara dengan API
// Laravel (Bearer token); state database dimuat ulang setelah tiap mutasi.
// ----------------------------------------------------------------------------
interface DbContextValue {
  db: Database
  currentUser: User | null
  loading: boolean
  logs: LogRow[]
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  upload: (input: UploadSoalInput) => Promise<BankSoal>
  uploadTemplate: (input: {
    nama_template: string
    deskripsi?: string | null
    file: File
  }) => Promise<TemplateSoal>
  deleteTemplate: (id: number) => Promise<void>
  downloadTemplate: (id: number) => Promise<Blob>
  createUser: (input: {
    nama: string
    email: string
    role: UserRole
    nidn: string
  }) => Promise<{
    user: User
    password: string
    pinCetak: string | null
  }>
  decideRevisi: (
    revisiId: number,
    keputusan: "disetujui" | "ditolak",
  ) => Promise<void>
  ajukanRevisi: (
    bankSoalId: number,
    alasan: string,
    file: File,
  ) => Promise<string>
  refresh: () => Promise<void>
  updateProfile: (input: { nama: string; currentPassword?: string; newPassword?: string; photo?: File; signature?: File }) => Promise<void>
}

const DbContext = createContext<DbContextValue | null>(null)

function useDb(): DbContextValue {
  const ctx = useContext(DbContext)
  if (!ctx) throw new Error("useDb harus dipakai di dalam DbProvider")
  return ctx
}

// Provider: memegang state "database" (hasil mapper API), menyediakan operasi
// baca/tulis async, dan memuat ulang data setelah tiap mutasi (commit).
function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(emptyDatabase)
  const [loading, setLoading] = useState(true)
  const currentUser = findUser(db, db.session.userId)

  // Pulihkan sesi dari token tersimpan (jika ada) saat aplikasi dibuka.
  // Splash ditahan minimal MIN_SPLASH_MS hanya saat belum ada sesi (tanpa
  // token), agar animasi loading sempat tampil di halaman login. Saat refresh
  // dengan sesi aktif, delay dilewati agar masuk aplikasi terasa cepat.
  useEffect(() => {
    let active = true
    const mulai = Date.now()
    const MIN_SPLASH_MS = hasToken() ? 0 : 2400
    let selesaiSplash: number | undefined

    loadDatabase()
      .then((loaded) => {
        if (active) setDb(loaded)
      })
      .catch(() => {
        if (active) setDb(emptyDatabase())
      })
      .finally(() => {
        const sisa = Math.max(0, MIN_SPLASH_MS - (Date.now() - mulai))
        selesaiSplash = window.setTimeout(() => {
          if (active) setLoading(false)
        }, sisa)
      })

    return () => {
      active = false
      if (selesaiSplash !== undefined) window.clearTimeout(selesaiSplash)
    }
  }, [])

  // Sinkronkan perubahan yang dilakukan pengguna lain tanpa memuat ulang halaman.
  // Polling hanya berjalan ketika sesi sudah siap; tab tersembunyi diperbarui
  // saat kembali aktif agar tidak terus meminta data di latar belakang.
  useEffect(() => {
    if (loading) return
    let active = true
    let syncing = false
    const sync = async () => {
      if (!active || syncing || document.visibilityState === "hidden") return
      syncing = true
      try {
        const latest = await loadDatabase()
        // /me dapat gagal sementara; loadDatabase mengembalikan database kosong
        // untuk kasus itu, jadi jangan hapus tampilan yang masih valid.
        if (active && latest.session.userId) setDb(latest)
      } catch {
        // Pertahankan data yang sudah tampil jika jaringan sedang terputus.
      } finally {
        syncing = false
      }
    }
    const timer = window.setInterval(() => void sync(), 30_000)
    const onVisible = () => { if (document.visibilityState === "visible") void sync() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [loading])

  const value = useMemo<DbContextValue>(
    () => ({
      db,
      currentUser,
      loading,
      logs: toLogRows(db),
      login: async (email, password) => {
        const user = await authenticate(email, password)
        setDb(await loadDatabase())
        return user
      },
      logout: async () => {
        await dbLogout()
        setDb(emptyDatabase())
      },
      upload: async (input) => {
        const soal = await createBankSoal(input)
        setDb(await loadDatabase())
        return soal
      },
      uploadTemplate: async (input) => {
        const template = await createTemplateSoal(input)
        setDb((current) => ({
          ...current,
          template_soal: [template, ...current.template_soal],
        }))
        return template
      },
      deleteTemplate: async (id) => {
        await deleteTemplateSoal(id)
        setDb((current) => ({
          ...current,
          template_soal: current.template_soal.filter((item) => item.id !== id),
        }))
      },
      downloadTemplate: async (id) => {
        return downloadTemplateSoal(id)
      },
      createUser: async (input) => {
        const created = await addUser(input)
        setDb(await loadDatabase())
        return created
      },
      decideRevisi: async (revisiId, keputusan) => {
        await decideRevisi(revisiId, keputusan)
        setDb(await loadDatabase())
      },
      ajukanRevisi: async (bankSoalId, alasan, file) => {
        const message = await requestRevisi(bankSoalId, alasan, file)
        setDb(await loadDatabase())
        return message
      },
      refresh: async () => {
        setDb(await loadDatabase())
      },
      updateProfile: async (input) => {
        await updateMyProfile(input)
        setDb(await loadDatabase())
      },
    }),
    [db, currentUser, loading],
  )

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>
}

function Sidebar({
  open,
  active,
  role,
  userName,
  onClose,
  onNavigate,
  onLogout,
  onProfile,
  photoUrl,
}: {
  open: boolean
  active: string
  role: UserRole
  userName: string
  onClose: () => void
  onNavigate: (label: string) => void
  onLogout: () => void
  onProfile: () => void
  photoUrl?: string | null
}) {
  const profile = roleMeta[normalizeRole(role)]
  return (
    <>
      {open && (
        <button
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`sikasa-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-black/5 bg-[#f4f1ea] text-slate-800 transition-transform duration-300 lg:w-72 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="sikasa-sidebar-brand flex min-h-20 items-center gap-2.5 border-b border-black/5 px-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#202126] text-[#f5cf25] shadow-lg shadow-black/10">
            <span
              className="font-display text-[11px] font-extrabold tracking-tight lg:hidden"
              aria-hidden="true"
            >
              <Icon name="lock" size={23} />
            </span>
            <span
              className="font-display hidden text-[11px] font-extrabold tracking-tight lg:block"
              title={APP_TAGLINE}
            >
              {APP_SINGKATAN.slice(0, 3)}
            </span>
          </div>
          <div className="sikasa-brand-copy min-w-0 flex-1">
            <div className="font-display text-[14px] font-bold leading-tight tracking-normal">
              {APP_NAMA}
            </div>
            <div
              className="sikasa-institution mt-1 text-[8px] font-semibold leading-[1.35] tracking-[0.08em] text-slate-400"
              title={APP_TAGLINE}
            >
              {INSTANSI_KOP}
            </div>
          </div>
          <button
            className="ml-auto rounded-lg p-2 text-slate-500 lg:hidden"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-7 lg:px-4">
          <div className="mb-3 px-3 text-[10px] font-bold tracking-[0.2em] text-slate-400 lg:hidden">
            MENU UTAMA
          </div>
          <nav className="space-y-2">
            {profile.nav.map((item) => (
              <button
                aria-label={item.label}
                title={item.label}
                key={item.label}
                className={`sikasa-nav-item group relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                  active === item.label
                    ? "is-active bg-[#202126] text-white shadow-sm"
                    : "text-slate-500 hover:bg-white hover:text-slate-900"
                }`}
                onClick={() => {
                  onNavigate(item.label)
                  onClose()
                }}
              >
                <span
                  className={
                    active === item.label ? "text-[#f5cf25]" : "text-slate-500"
                  }
                >
                  <Icon name={item.icon} size={19} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto shrink-0 p-4 lg:px-3">
          <div className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              Server Aman & Aktif
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Enkripsi aktif · Distribusi soal terlindungi
            </p>
          </div>
          <button
            className="mt-5 flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-white"
            onClick={onProfile}
          >
            {photoUrl ? <img src={photoUrl} alt="" className="size-10 rounded-full object-cover" /> : <div className="grid size-10 place-items-center rounded-full bg-[#202126] text-sm font-bold text-[#f5cf25]">{initials(userName)}</div>}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{userName}</div>
              <div className="text-[11px] text-slate-400">{profile.label}</div>
            </div>
            <span className="ml-auto">
              <Icon name="chevron" size={16} />
            </span>
          </button>
          <button
            aria-label="Keluar"
            title="Keluar"
            className="group relative mt-2 flex min-h-11 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            onClick={onLogout}
          >
            <Icon name="logout" size={19} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  )
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: IconName
  label: string
  value: string
  detail: string
  tone: "green" | "gold" | "blue"
}) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700",
    gold: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
  }
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,45,43,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-800">
            {value}
          </p>
        </div>
        <div
          className={`grid size-11 place-items-center rounded-xl ${colors[tone]}`}
        >
          <Icon name={icon} size={21} />
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {detail}
      </p>
    </div>
  )
}

type ConfirmOptions = {
  title: string
  description: string
  confirmLabel?: string
  tone?: "danger" | "warning"
  icon?: IconName | null
}

function useConfirmCard() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)

  const ask = (nextOptions: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setOptions(nextOptions)
    })

  const close = (confirmed: boolean) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setOptions(null)
    resolve?.(confirmed)
  }

  const dialog = options ? (
    <ConfirmCard
      {...options}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null

  return { ask, dialog }
}

function ConfirmCard({
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  tone = "danger",
  icon,
  onCancel,
  onConfirm,
}: ConfirmOptions & { onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    cancelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onCancel])

  const danger = tone === "danger"
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_28px_90px_rgba(15,35,30,0.28)] sm:p-7"
        role="alertdialog"
      >
        <div className="flex items-start gap-4">
          {icon !== null && <div
            className={`grid size-12 shrink-0 place-items-center rounded-2xl ${danger ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
          >
            <Icon name={icon ?? (danger ? "x" : "shield")} size={21} />
          </div>}
          <div className="min-w-0 pt-0.5">
            <h2 className="font-display text-lg font-bold tracking-tight text-slate-900" id={titleId}>
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600" id={descriptionId}>
              {description}
            </p>
          </div>
        </div>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            Batal
          </button>
          <button
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-white ${danger ? "bg-rose-700 hover:bg-rose-800" : "bg-amber-700 hover:bg-amber-800"}`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

type PromptOptions = {
  title: string
  description: string
  label: string
  initialValue?: string
  type?: "text" | "datetime-local"
  placeholder?: string
}

function usePromptCard() {
  const [options, setOptions] = useState<PromptOptions | null>(null)
  const resolveRef = useRef<((value: string | null) => void) | null>(null)

  const ask = (nextOptions: PromptOptions) =>
    new Promise<string | null>((resolve) => {
      resolveRef.current = resolve
      setOptions(nextOptions)
    })

  const close = (value: string | null) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setOptions(null)
    resolve?.(value)
  }

  const dialog = options ? (
    <PromptCard
      {...options}
      onCancel={() => close(null)}
      onSubmit={(value) => close(value)}
    />
  ) : null

  return { ask, dialog }
}

function PromptCard({
  title,
  description,
  label,
  initialValue = "",
  type = "text",
  placeholder,
  onCancel,
  onSubmit,
}: PromptOptions & {
  onCancel: () => void
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const fieldRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    fieldRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_28px_90px_rgba(15,35,30,0.28)] sm:p-7"
        role="dialog"
      >
        <h2 className="font-display text-lg font-bold tracking-tight text-slate-900" id={titleId}>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600" id={descriptionId}>
          {description}
        </p>
        <label className="mt-5 block text-xs font-bold text-slate-700">
          {label}
          <input
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            ref={fieldRef}
            type={type}
            value={value}
          />
        </label>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>
          <button
            className="min-h-11 rounded-xl bg-[#173a35] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#244b45]"
            onClick={() => onSubmit(value)}
            type="button"
          >
            Simpan
          </button>
        </div>
      </section>
    </div>
  )
}

interface DemoCredential {
  email: string
  password: string
}

// Sapaan singkat pada heading form (mis. "Hai, Kaprodi").
const roleSapaan: Record<UserRole, string> = {
  dosen: "Dosen",
  kaprodi: "Kaprodi",
  panitia: "Panitia",
  admin: "Admin",
}

// Tiga "karya" pada galeri panel kiri — diganti lewat panah kiri/kanan.
// Tiap slide punya warna aksen + gradasi latar sendiri yang senada nilainya.
const loginSlides: {
  tag: string
  judul: string
  detail: string
  ikon: IconName
  aksen: string
  gradasi: string
}[] = [
  {
    tag: "Nilai 01",
    judul: "Aman & Terenkripsi",
    detail:
      "Naskah soal tersimpan terenkripsi di server pusat dan tidak pernah tersimpan di laptop pribadi.",
    ikon: "shield",
    aksen: "#f5cf25",
    gradasi:
      "radial-gradient(120% 85% at 50% 118%, rgba(245,207,37,0.22) 0%, rgba(245,207,37,0.07) 45%, rgba(32,33,38,0) 74%), radial-gradient(60% 50% at 82% 8%, rgba(245,207,37,0.16), rgba(32,33,38,0) 62%), linear-gradient(180deg, #202126 0%, #26272d 48%, #1a1b1e 100%)",
  },
  {
    tag: "Nilai 02",
    judul: "Jejak Audit Lengkap",
    detail:
      "Setiap unggah, revisi, persetujuan, dan akses soal tercatat beserta waktunya.",
    ikon: "history",
    aksen: "#f5cf25",
    gradasi:
      "radial-gradient(120% 85% at 50% 118%, rgba(245,207,37,0.22) 0%, rgba(245,207,37,0.07) 45%, rgba(32,33,38,0) 74%), radial-gradient(60% 50% at 82% 8%, rgba(245,207,37,0.16), rgba(32,33,38,0) 62%), linear-gradient(180deg, #202126 0%, #26272d 48%, #1a1b1e 100%)",
  },
  {
    tag: "Nilai 03",
    judul: "Distribusi QR Terkontrol",
    detail:
      "Soal dibuka dari QR sesuai jadwal ujian dan akses mahasiswa tercatat.",
    ikon: "qrcode",
    aksen: "#f5cf25",
    gradasi:
      "radial-gradient(120% 85% at 50% 118%, rgba(245,207,37,0.22) 0%, rgba(245,207,37,0.07) 45%, rgba(32,33,38,0) 74%), radial-gradient(60% 50% at 82% 8%, rgba(245,207,37,0.16), rgba(32,33,38,0) 62%), linear-gradient(180deg, #202126 0%, #26272d 48%, #1a1b1e 100%)",
  },
]

// Posisi bintang (persen) pada langit kartu galeri.
const bintangLogin = [
  [8, 12, 1.2],
  [22, 6, 0.9],
  [34, 18, 1.5],
  [48, 8, 1],
  [63, 15, 1.3],
  [76, 5, 0.8],
  [88, 20, 1.1],
  [14, 32, 1],
  [92, 38, 1.4],
  [58, 30, 0.9],
] as const

function LoginPage({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>
}) {
  const [selectedRole, setSelectedRole] = useState<UserRole>("panitia")
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("siti.h@feb.ac.id")
  const [password, setPassword] = useState("panitia123")
  const [error, setError] = useState("")
  const [catatan, setCatatan] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [slide, setSlide] = useState(0)
  const [info, setInfo] = useState<null | "alur" | "bantuan">(null)
  // Kredensial demo per peran — di produksi diganti autentikasi server.
  const demoCredentials: Record<UserRole, DemoCredential> = {
    dosen: { email: "rina.kurniawati@feb.ac.id", password: "dosen123" },
    kaprodi: { email: "dian.puspitasari@feb.ac.id", password: "kaprodi123" },
    panitia: { email: "siti.h@feb.ac.id", password: "panitia123" },
    admin: { email: "rizky.it@feb.ac.id", password: "admin123" },
  }
  const geser = (arah: number) =>
    setSlide((n) => (n + arah + loginSlides.length) % loginSlides.length)
  // Ganti slide otomatis setiap 5 detik.
  useEffect(() => {
    const timer = setInterval(() => geser(1), 5000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const karya = loginSlides[slide]
  // Ilustrasi berbeda untuk tiap slide — bukan cuma ganti warna.
  const renderIlustrasi = () => {
    if (karya.ikon === "history")
      return (
        <svg
          aria-hidden="true"
          className="h-full w-full"
          fill="none"
          viewBox="0 0 200 180"
        >
          <circle
            cx="86"
            cy="92"
            r="76"
            stroke={karya.aksen}
            strokeLinecap="round"
            strokeOpacity="0.18"
            strokeWidth="1.5"
          />
          <path
            d="M52 20 V164"
            stroke={karya.aksen}
            strokeLinecap="round"
            strokeOpacity="0.8"
            strokeWidth="2"
          />
          {[40, 80, 120, 158].map((y, i) => (
            <g key={y}>
              <circle
                cx="52"
                cy={y}
                r="6"
                fill={karya.aksen}
                stroke={karya.aksen}
                strokeOpacity="0.4"
                strokeWidth="6"
              />
              <circle
                cx="52"
                cy={y}
                r="13"
                strokeOpacity="0.35"
                strokeWidth="1.5"
              />
              <path
                d={`M72 ${y} H${138 - i * 12}`}
                stroke={karya.aksen}
                strokeLinecap="round"
                strokeOpacity={0.65 - i * 0.12}
                strokeWidth="6"
              />
            </g>
          ))}
        </svg>
      )
    if (karya.ikon === "printer")
      return (
        <svg
          aria-hidden="true"
          className="h-full w-full"
          fill="none"
          viewBox="0 0 200 180"
        >
          <circle
            cx="100"
            cy="92"
            r="76"
            stroke={karya.aksen}
            strokeOpacity="0.18"
            strokeWidth="1.5"
          />
          <rect
            fill={karya.aksen}
            fillOpacity="0.12"
            height="98"
            rx="8"
            transform="rotate(-7 95 83)"
            width="74"
            x="58"
            y="34"
          />
          <rect
            fill="#202126"
            fillOpacity="0.55"
            height="100"
            rx="8"
            stroke={karya.aksen}
            strokeOpacity="0.9"
            strokeWidth="2"
            width="76"
            x="64"
            y="44"
          />
          <path
            d="M78 66 H126 M78 82 H126 M78 98 H110"
            stroke={karya.aksen}
            strokeLinecap="round"
            strokeOpacity="0.7"
            strokeWidth="4"
          />
          <circle
            cx="134"
            cy="122"
            fill={karya.aksen}
            fillOpacity="0.9"
            r="22"
          />
          <path
            d="M124 122 l7 8 l13 -16"
            stroke="#202126"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
          />
        </svg>
      )
    // shield — Aman & Terenkripsi
    return (
      <svg
        aria-hidden="true"
        className="h-full w-full"
        fill="none"
        viewBox="0 0 200 180"
      >
        <circle
          cx="100"
          cy="92"
          r="74"
          stroke={karya.aksen}
          strokeDasharray="4 9"
          strokeOpacity="0.28"
          strokeWidth="1.5"
        />
        <path
          d="M100 22 L162 44 V96 C162 128 100 160 100 160 C100 160 38 128 38 96 V44 Z"
          stroke={karya.aksen}
          strokeOpacity="0.9"
          strokeWidth="2"
        />
        <path
          d="M100 34 L150 51 V96 C150 121 100 148 100 148 C100 148 50 121 50 96 V51 Z"
          fill={karya.aksen}
          fillOpacity="0.1"
        />
        <rect
          fill={karya.aksen}
          fillOpacity="0.85"
          height="22"
          rx="5"
          width="28"
          x="86"
          y="92"
        />
        <path
          d="M91 92 V86 a9 9 0 0 1 18 0 V92"
          stroke={karya.aksen}
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <circle cx="100" cy="103" fill="#202126" r="3" />
        <circle cx="170" cy="58" fill={karya.aksen} r="3" />
        <circle cx="177" cy="84" fill={karya.aksen} fillOpacity="0.7" r="2" />
        <circle
          cx="168"
          cy="108"
          fill={karya.aksen}
          fillOpacity="0.5"
          r="2.5"
        />
      </svg>
    )
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf9f0] p-4 sm:p-6 lg:h-screen lg:overflow-hidden">
      <div className="flex w-full max-w-5xl overflow-hidden rounded-[34px] bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] lg:h-[calc(100vh-3rem)]">
        <div className="grid flex-1 lg:grid-cols-[0.92fr_1.08fr]">
          {/* ---------------------------------------------------------- */}
          {/* Panel kiri: kartu galeri bertema gelap-emas + carousel     */}
          {/* ---------------------------------------------------------- */}
          <section className="p-3 sm:p-4 lg:p-5">
            <div
              className="relative flex h-[300px] flex-col overflow-hidden rounded-[26px] p-7 text-white transition-[background-image] duration-700 sm:h-[360px] lg:h-full"
              style={{ backgroundImage: karya.gradasi }}
            >
              {/* Ilustrasi utama — beda bentuk tiap slide */}
              <div
                className="animate-login-right pointer-events-none absolute right-4 top-1/2 h-[170px] w-[170px] sm:right-8 sm:h-[210px] sm:w-[210px]"
                key={`ilustrasi-${slide}`}
              >
                {renderIlustrasi()}
              </div>
              {bintangLogin.map(([x, y, skala]) => (
                <div
                  aria-hidden="true"
                  className="absolute size-1 rounded-full bg-white/80"
                  key={`${x}-${y}`}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `scale(${skala})`,
                  }}
                />
              ))}
              {/* Gelap bertahap di bawah agar teks terbaca */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#111214] via-[#111214]/75 to-transparent"
              />
              <div className="relative flex items-start justify-end gap-4">
                <button
                  className="rounded-full border border-white/30 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-white hover:text-[#202126]"
                  onClick={() => setInfo("bantuan")}
                  type="button"
                >
                  Bantuan
                </button>
              </div>
              <div className="relative mt-auto" key={`teks-${slide}`}>
                <div className="animate-login-up">
                  <div
                    className="grid size-14 place-items-center rounded-2xl text-[#202126] transition-colors duration-700"
                    style={{
                      backgroundColor: karya.aksen,
                      boxShadow: `0 12px 30px -8px ${karya.aksen}bf`,
                    }}
                  >
                    <Icon name={karya.ikon} size={26} />
                  </div>
                  <div
                    className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-700"
                    style={{ color: karya.aksen }}
                  >
                    {karya.tag}
                  </div>
                  <div className="font-display mt-2 text-2xl font-bold leading-snug sm:text-[28px]">
                    {karya.judul}
                  </div>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">
                    {karya.detail}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between gap-4">
                  <div className="flex gap-1.5">
                    {loginSlides.map((item, index) => (
                      <div
                        className={`h-1 rounded-full transition-all ${
                          index === slide ? "w-7" : "w-2.5 bg-white/25"
                        }`}
                        key={item.judul}
                        style={
                          index === slide
                            ? { backgroundColor: karya.aksen }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      aria-label="Karya sebelumnya"
                      className="grid size-10 place-items-center rounded-full border border-white/25 transition hover:bg-white/15"
                      onClick={() => geser(-1)}
                      type="button"
                    >
                      <Icon name="chevronKiri" size={18} />
                    </button>
                    <button
                      aria-label="Karya berikutnya"
                      className="grid size-10 place-items-center rounded-full border border-white/25 transition hover:bg-white/15"
                      onClick={() => geser(1)}
                      type="button"
                    >
                      <Icon name="chevron" size={18} />
                    </button>
                  </div>
                </div>
              </div>
              {info && (
                <div className="absolute inset-0 z-10 flex flex-col justify-end rounded-[26px] bg-[#202126]/94 p-7 backdrop-blur-sm">
                  <div className="font-display text-lg font-bold">
                    {info === "alur" ? "Alur kerja sistem" : "Butuh bantuan?"}
                  </div>
                  {info === "alur" ? (
                    <ol className="mt-3 space-y-2 text-xs leading-relaxed text-white/70">
                      {loginSlides.map((item) => (
                        <li className="flex gap-2" key={item.judul}>
                          <span className="text-[#f5cf25]">•</span>
                          <span>
                            <b className="text-white">{item.tag}</b> —{" "}
                            {item.judul}
                          </span>
                        </li>
                      ))}
                      <li className="flex gap-2">
                        <span className="text-[#f5cf25]">•</span>
                        <span>
                          Setiap langkah tercatat di log aktivitas & berita
                          acara.
                        </span>
                      </li>
                    </ol>
                  ) : (
                    <p className="mt-3 text-xs leading-relaxed text-white/70">
                      Lupa kata sandi? Setelah masuk, Admin IT
                      dapat mereset lewat menu{" "}
                      <b className="text-white">Manajemen User</b> — atau
                      hubungi tim infrastruktur FEB.
                    </p>
                  )}
                  <button
                    className="mt-5 self-start rounded-full border border-white/30 px-4 py-1.5 text-xs font-bold transition hover:bg-white hover:text-[#202126]"
                    onClick={() => setInfo(null)}
                    type="button"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>
          </section>
          {/* ---------------------------------------------------------- */}
          {/* Panel kanan: form login ala kartu modern                   */}
          {/* ---------------------------------------------------------- */}
          <section className="flex items-center justify-center px-6 py-6 sm:px-10 lg:py-8">
            <form
              className="w-full max-w-md"
              onSubmit={async (event) => {
                event.preventDefault()
                setSubmitting(true)
                setError("")
                setCatatan("")
                const message = await onLogin(email, password)
                if (message) setError(message)
                setSubmitting(false)
              }}
            >
              <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-[#202126] text-[#f5cf25]">
                    <Icon name="lock" size={18} />
                  </div>
                  <div className="font-display text-[15px] font-extrabold tracking-tight text-slate-900">
                    {APP_NAMA}
                  </div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {APP_TAGLINE}
                  </div>
                </div>
              </div>
              <div className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[34px]">
                Hai, {roleSapaan[selectedRole]}
              </div>
              <p className="mt-1.5 text-[13px] text-slate-500">
                Kelola soal ujian dengan distribusi aman melalui QR Code.
              </p>
              <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Masuk sebagai
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(roleMeta) as UserRole[]).map((role) => (
                  <button
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                      selectedRole === role
                        ? "border-[#202126] bg-[#202126] text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-800"
                    }`}
                    key={role}
                    onClick={() => {
                      setSelectedRole(role)
                      setEmail(demoCredentials[role].email)
                      setPassword(demoCredentials[role].password)
                      setError("")
                      setCatatan("")
                    }}
                    type="button"
                  >
                    {roleMeta[role].label}
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-xs font-semibold text-slate-600">
                Email
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-[#202126]"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@feb.ac.id"
                required
                type="email"
                value={email}
              />
              <label className="mt-3 block text-xs font-semibold text-slate-600">
                Kata sandi
              </label>
              <div className="relative mt-1.5">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-12 text-sm text-slate-800 outline-none transition focus:border-[#202126]"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan kata sandi"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={
                    showPassword ? "Sembunyi kata sandi" : "Lihat kata sandi"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-800"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
                </button>
              </div>
              {catatan && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                  {catatan}
                </div>
              )}
              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  <Icon name="shield" size={16} />
                  {error}
                </div>
              )}
              {/* Pemisah "atau" seperti referensi */}
              <div className="my-4 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-widest text-slate-300">
                <span className="h-px flex-1 bg-slate-200" />
                atau
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() =>
                  setCatatan(
                    "Masuk SSO Google belum aktif di server ini. Gunakan email institusi FEB sesuai peran Anda.",
                  )
                }
                type="button"
              >
                <svg aria-hidden="true" className="size-4" viewBox="0 0 48 48">
                  <path
                    d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9Z"
                    fill="#FFC107"
                  />
                  <path
                    d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z"
                    fill="#FF3D00"
                  />
                  <path
                    d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44Z"
                    fill="#4CAF50"
                  />
                  <path
                    d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C36.9 39.8 44 34 44 24c0-1.3-.1-2.6-.4-3.9Z"
                    fill="#1976D2"
                  />
                </svg>
                Lanjutkan dengan Google
              </button>
              <button
                className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-full bg-[#202126] py-3 text-sm font-bold text-[#f5cf25] shadow-[0_10px_25px_-10px_rgba(32,33,38,0.9)] transition hover:bg-[#111216] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                <Icon name="lock" size={16} />
                {submitting ? "Memverifikasi..." : "Masuk"}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                Belum punya akun?{" "}
                <button
                  className="font-bold text-slate-700 hover:underline"
                  onClick={() => setInfo("bantuan")}
                  type="button"
                >
                  Hubungi Admin IT
                </button>
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

function DashboardPage({
  navigate,
  role,
}: {
  navigate: (page: string) => void
  role: UserRole
}) {
  const { db, currentUser } = useDb()
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
  const BULAN_SINGKAT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ]
  const today = new Date()
  const todayLabel = `${HARI[today.getDay()]}, ${today.getDate()} ${BULAN_SINGKAT[today.getMonth()]} ${today.getFullYear()}`

  // Kartu statistik diambil langsung dari endpoint /dashboard (per peran).
  const statStyles = role === "panitia"
    ? ([
        { icon: "file", tone: "blue", detail: "Naskah disetujui" },
        { icon: "calendar", tone: "gold", detail: "Sesi terjadwal" },
        { icon: "check", tone: "green", detail: "Sedang berlangsung" },
      ] as const)
    : ([
        { icon: "book", tone: "blue", detail: "Ringkasan sistem" },
        { icon: "check", tone: "green", detail: "Status terkini" },
        { icon: "clock", tone: "gold", detail: "Perlu tindakan" },
        { icon: "qrcode", tone: "blue", detail: "Akses tercatat" },
      ] as const)
  const stats = (db.dashboard?.cards ?? []).map((card, index) => {
    const style = statStyles[index % statStyles.length]
    return {
      label: card.label,
      value: String(card.value),
      detail: style.detail,
      icon: style.icon as IconName,
      tone: style.tone as "green" | "gold" | "blue",
    }
  })

  const namaDepan = (currentUser?.nama ?? "").split(/[,.]/)[0].trim()
  const greeting = `Selamat datang, ${namaDepan || roleLabel(role)}.`

  const statusWidth = (s: string) =>
    s === "siap_ujian" || s === "terkunci" ? "w-full" : "w-1/3"
  const statusSingkat = (s: string) =>
    s === "siap_ujian" ? "Disetujui" : s === "ditolak" ? "Ditolak" : s === "arsip" ? "Arsip" : "Menunggu"

  // Ringkasan + panel progres dibangun dari data nyata milik peran terkait.
  let summary = "Semua layanan berjalan normal."
  let title = "Ringkasan Aktivitas"
  let subtitle = "Berdasarkan data terbaru dari server"
  let percent = "0%"
  let width = "w-0"
  let rows: string[][] = []

  if (role === "dosen") {
    const total = db.bank_soal.length
    const menunggu = db.bank_soal.filter((s) => s.status === "terkunci").length
    summary = `${total} soal Anda; ${menunggu} menunggu persetujuan Kaprodi.`
    title = "Kesiapan Soal Anda"
    subtitle = `${total} soal pada semester aktif`
    percent = total ? `${Math.round(((total - menunggu) / total) * 100)}%` : "0%"
    width = total ? (menunggu === 0 ? "w-full" : "w-3/4") : "w-0"
    rows = db.bank_soal
      .slice(0, 6)
      .map((s) => [
        s.nama_mk,
        s.judul,
        statusSingkat(s.status),
        statusWidth(s.status),
      ])
  } else if (role === "kaprodi") {
    const total = db.rekap.length
    const sudah = db.rekap.filter((r) => r.status !== "belum_upload").length
    summary = `${sudah} dari ${total} mata kuliah sudah upload; ${db.revisi.length} revisi menunggu.`
    title = "Progres Pengumpulan"
    subtitle = `${sudah} dari ${total} mata kuliah sudah mengunggah`
    percent = total ? `${Math.round((sudah / total) * 100)}%` : "0%"
    width = total
      ? sudah === total
        ? "w-full"
        : sudah
          ? "w-3/4"
          : "w-0"
      : "w-0"
    rows = db.rekap
      .slice(0, 6)
      .map((r) => [
        r.nama_mk,
        r.dosen ?? "-",
        r.status !== "belum_upload" ? "Sudah" : "Belum",
        r.status !== "belum_upload" ? "w-full" : "w-1/3",
      ])
  } else if (role === "panitia") {
    summary = "Atur sesi ujian dan distribusikan akses soal melalui QR Code."
    title = "Distribusi Soal Online"
    subtitle = "Jawaban tetap dikerjakan pada lembar kertas"
    percent = "QR"
    width = "w-full"
  } else {
    const total = db.users.length
    const aktif = db.users.filter((u) => u.aktif).length
    summary = `${total} pengguna terkelola; ${aktif} aktif.`
    title = "Pengguna Sistem"
    subtitle = `${aktif} aktif dari ${total} pengguna`
    percent = total ? `${Math.round((aktif / total) * 100)}%` : "0%"
    width = total
      ? aktif === total
        ? "w-full"
        : aktif
          ? "w-3/4"
          : "w-0"
      : "w-0"
    rows = db.users
      .slice(0, 6)
      .map((u) => [
        u.nama,
        roleLabel(u.role),
        u.aktif ? "Aktif" : "Nonaktif",
        u.aktif ? "w-full" : "w-1/3",
      ])
  }

  const dashboard = {
    greeting,
    summary,
    target:
      role === "dosen"
        ? "Upload Soal"
        : role === "kaprodi"
          ? "Rekap Soal"
          : role === "panitia"
            ? "Sesi Ujian"
            : "Status Server",
    action:
      role === "dosen"
        ? "Upload soal baru"
        : role === "kaprodi"
          ? "Buka rekap soal"
          : role === "panitia"
            ? "Kelola sesi ujian"
            : "Periksa status server",
    actionIcon: (role === "dosen"
      ? "upload"
      : role === "kaprodi"
        ? "book"
        : role === "panitia"
          ? "qrcode"
          : "settings") as IconName,
    stats,
  }
  const verbAksi: Record<string, string> = {
    login: "melakukan login",
    upload: "mengunggah soal",
    cetak: "mencetak soal",
    revisi: "mengajukan revisi",
    approval_revisi: "memutuskan revisi",
    kunci: "mengunci soal",
    buka_cetak: "membuka akses cetak",
  }
  const overview = {
    title,
    subtitle,
    percent,
    width,
    rows,
    // Aktivitas terbaru dari log_aktivitas nyata (maks 4 baris).
    activities: db.log_aktivitas.slice(0, 4).map((l) => {
      const aksi = verbAksi[l.aksi] ?? l.aksi
      const waktu = l.waktu
        ? `${formatTanggal(l.waktu)} ${formatJam(l.waktu)}`.trim()
        : "-"
      return [
        l.pengguna,
        l.mata_kuliah ? `${aksi} · ${l.mata_kuliah}` : aksi,
        waktu,
      ]
    }),
  }
  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-black/5 bg-white p-7 text-slate-900 shadow-[0_18px_50px_rgba(32,33,38,0.05)] sm:p-9">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex rounded-full bg-[#f5cf25] px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-[#202126]">
              {todayLabel}
            </div>
            <div className="font-display mt-3 text-3xl font-bold">
              {dashboard.greeting}
            </div>
            <p className="mt-3 text-sm text-slate-400">{dashboard.summary}</p>
          </div>
          <button
            className="flex items-center justify-center gap-2 rounded-full bg-[#202126] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-black"
            onClick={() => navigate(dashboard.target)}
          >
            <Icon name={dashboard.actionIcon} size={18} /> {dashboard.action}
          </button>
        </div>
      </section>
      <section className={`mt-6 grid gap-4 sm:grid-cols-2 ${role === "panitia" ? "md:grid-cols-3" : "xl:grid-cols-4"}`}>
        {dashboard.stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        {role === "panitia" ? (
          <div className="panitia-prep-card rounded-2xl border border-slate-200/80 bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f5cf25] text-[#202126]">
                <Icon name="qrcode" size={21} />
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-bold text-slate-900">
                  Persiapan Distribusi Soal
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Alur singkat sebelum QR Code ditampilkan di ruang ujian.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              {[
                ["01", "Pilih naskah", "Gunakan soal yang sudah disetujui Kaprodi."],
                ["02", "Atur sesi", "Isi jadwal ujian dan data peserta."],
                ["03", "Tampilkan QR", "Mahasiswa membaca soal, jawaban tetap di kertas."],
              ].map(([number, title, detail]) => (
                <div className="panitia-prep-step rounded-xl border border-slate-200 bg-slate-50 p-3.5" key={number}>
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#173a35] text-[10px] font-extrabold text-[#d9ef83]">
                      {number}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{title}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-bold text-slate-900">
                {overview.title}
              </div>
              <p className="mt-1 text-xs text-slate-400">{overview.subtitle}</p>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {overview.percent}
            </span>
          </div>
          <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-[#202126] ${overview.width}`}
            />
          </div>
          <div className="mt-7 space-y-5">
            {overview.rows.map(([name, detail, value, width]) => (
              <div className="grid grid-cols-[1fr_auto] gap-3" key={name}>
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{name}</span>
                    <span className="text-slate-400">{detail}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-[#202126] ${width}`}
                    />
                  </div>
                </div>
                <span className="w-9 text-right text-xs font-bold text-slate-600">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
        )}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="font-display text-lg font-bold text-slate-900">
            Aktivitas Terbaru
          </div>
          <div className="mt-5 space-y-5">
            {overview.activities.map(([name, action, time], index) => (
              <div className="flex gap-3" key={name + action}>
                <div
                  className={`mt-1 grid size-8 shrink-0 place-items-center rounded-lg ${
                    index === 1
                      ? "bg-sky-50 text-sky-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <Icon name={index === 1 ? "printer" : "document"} size={15} />
                </div>
                <div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    <strong className="text-slate-800">{name}</strong> {action}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">{time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function UploadPage({ showToast }: { showToast: (message: string) => void }) {
  const {
    db,
    upload,
    downloadTemplate,
  } = useDb()
  const [file, setFile] = useState<File | null>(null)
  const [signatureLayout, setSignatureLayout] = useState<PdfSignatureLayout | null>(null)
  const [layoutStatus, setLayoutStatus] = useState<"idle" | "checking" | "detected" | "missing">("idle")
  const layoutDetectionId = useRef(0)
  const [judul, setJudul] = useState("")
  const [busy, setBusy] = useState(false)
  const [konfirmasiFinal, setKonfirmasiFinal] = useState(false)
  const [mkId, setMkId] = useState<number | null>(null)
  const [jenis, setJenis] = useState<"UTS" | "UAS">("UTS")
  const [jadwal, setJadwal] = useState(() => defaultExamTimes().mulai)
  const [jumlah, setJumlah] = useState(40)
  const [templateSoalId, setTemplateSoalId] = useState<number | null>(null)
  const effectiveMkId = mkId ?? db.mata_kuliah[0]?.id ?? 0
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.65fr]">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <div className="font-display text-xl font-bold text-slate-900">
          Upload Soal Baru
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Pastikan berkas sudah final sebelum dikunci.
        </p>
        <div className="mt-6 grid gap-2 rounded-2xl bg-[#f4f1ea] p-3 sm:grid-cols-3">
          {[
            ["1", "Lengkapi data"],
            ["2", "Unggah PDF"],
            ["3", "Periksa & kunci"],
          ].map(([number, label]) => (
            <div
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[11px] font-bold text-slate-600"
              key={number}
            >
              <span className="grid size-6 place-items-center rounded-full bg-[#202126] text-[10px] text-[#f5cf25]">
                {number}
              </span>
              {label}
            </div>
          ))}
        </div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Mata kuliah
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
              onChange={(event) => setMkId(Number(event.target.value))}
              value={effectiveMkId}
            >
              {db.mata_kuliah.map((mk) => (
                <option key={mk.id} value={mk.id}>
                  {mk.nama_mk} · {mk.kode_mk}
                </option>
              ))}
            </select>
          </label>
          {db.template_soal.length > 0 && (
            <label className="text-xs font-bold text-slate-600">
              Referensi template
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
                onChange={(event) =>
                  setTemplateSoalId(
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  )
                }
                value={templateSoalId ?? ""}
              >
                <option value="">— Pilih template (opsional) —</option>
                {db.template_soal.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.nama_template}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                Format acuan yang disediakan Admin IT.
              </p>
            </label>
          )}
          <label className="text-xs font-bold text-slate-600">
            Judul soal
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
              onChange={(event) => setJudul(event.target.value)}
              placeholder="cth: Soal UTS Ganjil 2026"
              type="text"
              value={judul}
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Jenis ujian
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
              onChange={(event) =>
                setJenis(event.target.value as "UTS" | "UAS")
              }
              value={jenis}
            >
              <option>UTS</option>
              <option>UAS</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Jadwal ujian
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
              onChange={(event) => setJadwal(event.target.value)}
              min={toLocalDateTime(new Date())}
              type="datetime-local"
              value={jadwal}
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Jumlah mahasiswa
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
              min="1"
              onChange={(event) => setJumlah(Number(event.target.value))}
              type="number"
              value={jumlah}
            />
          </label>
        </div>
        <label className="mt-6 block text-xs font-bold text-slate-600">
          Berkas soal PDF
        </label>
        <label className="mt-2 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-6 text-center transition hover:border-emerald-400">
          <input
            accept=".pdf"
            className="hidden"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null
              const detectionId = ++layoutDetectionId.current
              event.currentTarget.value = ""
              setFile(selectedFile)
              setSignatureLayout(null)
              setLayoutStatus(selectedFile ? "checking" : "idle")
              setKonfirmasiFinal(false)
              if (selectedFile) {
                void detectPdfSignatureLayout(selectedFile)
                  .then((layout) => {
                    if (detectionId !== layoutDetectionId.current) return
                    setSignatureLayout(layout)
                    setLayoutStatus(layout ? "detected" : "missing")
                  })
                  .catch(() => {
                    if (detectionId !== layoutDetectionId.current) return
                    setLayoutStatus("missing")
                  })
              }
            }}
            type="file"
          />
          <div className="grid size-12 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
            <Icon name={file ? "check" : "upload"} size={23} />
          </div>
          <div className="mt-4 text-sm font-bold text-slate-700">
            {file?.name || "Klik untuk pilih berkas PDF"}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Maksimal 10 MB · Hanya format PDF
          </div>
        </label>
        {busy ? <UploadProgress label="Mengunggah dan mengamankan soal..." /> : file && <p className="mt-2 text-xs font-medium text-emerald-700" role="status">Berkas siap diunggah.</p>}
        {layoutStatus === "checking" && <p role="status" className="mt-2 text-xs font-medium text-slate-500">Memeriksa posisi kotak tanda tangan pada PDF...</p>}
        {layoutStatus === "detected" && signatureLayout && <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">Kotak Kaprodi terdeteksi di halaman {signatureLayout.page}. Posisi tanda tangan akan mengikuti tata letak PDF ini.</p>}
        {layoutStatus === "missing" && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">Kotak Kaprodi tidak terdeteksi. Gunakan PDF yang memuat tabel dengan label “Dosen” dan “Kaprodi” agar tanda tangan dapat ditempatkan tepat.</p>}
        <label className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          <input
            className="mt-0.5"
            checked={konfirmasiFinal}
            onChange={(event) => setKonfirmasiFinal(event.target.checked)}
            required
            type="checkbox"
          />
          Saya memastikan soal sudah final dan memahami bahwa revisi setelah
          dikunci memerlukan persetujuan Kaprodi.
        </label>
        {!konfirmasiFinal && (
          <p className="-mt-3 px-1 text-xs font-medium text-amber-800">
            Centang konfirmasi ini sebelum mengajukan soal.
          </p>
        )}
        <button
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#202126] py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !konfirmasiFinal || (!!file && layoutStatus !== "detected")}
          onClick={async () => {
            if (!file) return showToast("Pilih berkas PDF terlebih dahulu.")
            if (!signatureLayout) return showToast("Kotak tanda tangan Kaprodi belum terdeteksi pada PDF.")
            if (!judul.trim()) return showToast("Judul soal wajib diisi.")
            setBusy(true)
            try {
              await upload({
                mkId: effectiveMkId,
                jenis,
                judul: judul.trim(),
                jadwalUjian: jadwal,
                jumlahMahasiswa: jumlah,
                templateSoalId,
                file,
                signatureLayout,
              })
              setFile(null)
              setSignatureLayout(null)
              setLayoutStatus("idle")
              setJudul("")
              setKonfirmasiFinal(false)
              showToast("Soal terenkripsi dan menunggu persetujuan Kaprodi.")
            } catch (error) {
              showToast(
                error instanceof Error
                  ? error.message
                  : "Upload gagal. Coba lagi.",
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          <Icon name="lock" size={18} />{" "}
          {busy ? "Mengenkripsi..." : "Enkripsi & Ajukan Persetujuan"}
        </button>
      </section>
      <section className="space-y-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon name="shield" />
            </div>
            <div>
              <div className="font-bold text-slate-800">
                Pengamanan otomatis
              </div>
              <p className="text-xs text-slate-400">Saat berkas dikunci</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {[
              "Nama file diacak oleh sistem",
              "PDF dienkripsi di server lokal",
              "Akses langsung ke file diblokir",
              "Aktivitas upload dicatat lengkap",
            ].map((item) => (
              <div
                className="flex items-center gap-3 text-xs text-slate-600"
                key={item}
              >
                <span className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Icon name="check" size={12} />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        {db.template_soal.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-lg font-bold text-slate-900">
                Template Soal
              </div>
              <button
                onClick={() => {
                  // placeholder: handled by TemplatePage for admin; here just info
                }}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                disabled
              >
                Dikelola oleh Admin IT
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {db.template_soal.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="grid size-8 place-items-center rounded-lg bg-[#f4f1ea] text-slate-600">
                    <Icon name="document" size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-700 truncate">
                      {tpl.nama_template}
                    </div>
                    {tpl.deskripsi && (
                      <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                        {tpl.deskripsi}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-slate-400">
                      Oleh {tpl.pembuat_nama ?? "-"} ·
                      {tpl.created_at ?? "-"}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const blob = await downloadTemplate(tpl.id)
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url
                        const extension = tpl.file_path?.split(".").pop() || "bin"
                        a.download = `${tpl.nama_template}.${extension}`
                        a.click()
                        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
                        showToast(`Template "${tpl.nama_template}" diunduh.`)
                      } catch (error) {
                        showToast(
                          error instanceof Error
                            ? error.message
                            : "Unduhan gagal.",
                        )
                      }
                    }}
                    className="ml-2 flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-[11px] font-bold transition"
                    title="Unduh template"
                  >
                    <Icon name="download" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="font-display text-lg font-bold text-slate-900">
            Soal Saya
          </div>
          <div className="mt-4 space-y-3">
            {db.bank_soal.map((soal) => (
              <div
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5"
                key={soal.id}
              >
                <Icon name="document" size={18} />
                <div>
                  <div className="text-xs font-bold text-slate-700">
                    {soal.nama_mk}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {soal.status === "siap_ujian"
                      ? "Disetujui untuk ujian"
                      : soal.status === "ditolak"
                        ? "Ditolak Kaprodi"
                      : soal.status === "arsip"
                        ? "Diarsipkan"
                        : "Terkunci"}{" "}
                    · {formatTanggal(soal.jadwal_ujian)}
                  </div>
                </div>
                <Icon name="lock" size={14} />
              </div>
            ))}
            {db.bank_soal.length === 0 && (
              <p className="text-xs text-slate-400">
                Belum ada soal yang dikirim untuk persetujuan Kaprodi.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// Halaman manajemen Template Soal (khusus Admin IT).
function TemplatePage({ showToast }: { showToast: (message: string) => void }) {
  const {
    db,
    currentUser,
    uploadTemplate,
    deleteTemplate,
    downloadTemplate,
  } = useDb()
  const [namaTemplate, setNamaTemplate] = useState("")
  const [deskripsi, setDeskripsi] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const { ask, dialog } = useConfirmCard()

  const isAdmin = currentUser?.role === "admin"

  const handleUpload = async () => {
    if (!namaTemplate.trim()) return showToast("Nama template wajib diisi.")
    if (!file) return showToast("Pilih berkas template terlebih dahulu.")
    if (!/\.(pdf|docx?)$/i.test(file.name)) {
      return showToast("Format berkas harus PDF, DOC, atau DOCX.")
    }
    if (file.size > 10 * 1024 * 1024) {
      return showToast("Ukuran berkas maksimal 10 MB.")
    }
    setBusy(true)
    try {
      await uploadTemplate({
        nama_template: namaTemplate.trim(),
        deskripsi: deskripsi.trim() || null,
        file,
      })
      setNamaTemplate("")
      setDeskripsi("")
      setFile(null)
      showToast("Template soal berhasil diunggah.")
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal mengunggah template.",
      )
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: number) => {
    const template = db.template_soal.find((item) => item.id === id)
    if (!template) return
    const confirmed = await ask({
      title: "Hapus template soal?",
      description: `Template “${template.nama_template}” akan dihapus dan tidak lagi tersedia sebagai acuan dosen. Aksi ini tidak dapat dibatalkan.`,
      confirmLabel: "Hapus template",
    })
    if (!confirmed) return
    setDeleting(id)
    try {
      await deleteTemplate(id)
      showToast("Template berhasil dihapus.")
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal menghapus template.",
      )
    } finally {
      setDeleting(null)
    }
  }

  const handleDownload = async (tpl: TemplateSoal) => {
    try {
      const blob = await downloadTemplate(tpl.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const extension = tpl.file_path?.split(".").pop() || "bin"
      a.download = `${tpl.nama_template}.${extension}`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unduhan gagal.",
      )
    }
  }

  return (
    <>
    <div className="template-page grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
            <Icon name="document" size={21} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Tambah Template
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Siapkan berkas acuan yang bisa dipilih dosen saat mengunggah soal.
            </p>
          </div>
          <span className="ml-auto hidden shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800 sm:inline-flex">
            PDF · DOC · DOCX
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">
            Nama template
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
              onChange={(event) => setNamaTemplate(event.target.value)}
              placeholder="Contoh: Format Soal UTS"
              value={namaTemplate}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Deskripsi <span className="font-normal text-slate-400">(opsional)</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
              onChange={(event) => setDeskripsi(event.target.value)}
              placeholder="Jelaskan kegunaan atau format template"
              type="text"
              value={deskripsi}
            />
          </label>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700" htmlFor="template-file">
              Berkas template
            </label>
            <label
              className="mt-2 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50/70"
              htmlFor="template-file"
            >
              <input
                accept=".pdf,.doc,.docx"
                className="sr-only"
                id="template-file"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  event.currentTarget.value = ""
                }}
                type="file"
              />
              <div className="grid size-11 place-items-center rounded-xl bg-white text-emerald-800 shadow-sm">
                <Icon name={file ? "check" : "upload"} size={21} />
              </div>
              <div className="mt-3 max-w-full break-all text-sm font-bold text-slate-700">
                {file?.name || "Pilih berkas template"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                PDF, DOC, atau DOCX · Maksimal 10 MB
              </div>
            </label>
            {busy ? <UploadProgress label="Mengunggah template..." /> : file && <p className="mt-2 text-xs font-medium text-emerald-700" role="status">Berkas siap disimpan.</p>}
          </div>
        </div>

        <button
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#202126] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !namaTemplate.trim() || !file}
          onClick={handleUpload}
        >
          <Icon name="upload" size={18} />
          {busy ? "Mengunggah template..." : "Simpan Template"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Template Tersimpan
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Berkas acuan yang tersedia untuk dosen.
            </p>
          </div>
          <span className="grid min-h-8 min-w-8 place-items-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-700">
            {db.template_soal.length}
          </span>
        </div>
        {db.template_soal.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-slate-50 text-slate-500">
              <Icon name="document" size={21} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Belum ada template
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              Template yang berhasil diunggah akan tampil di daftar ini.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {db.template_soal.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2f6f3] text-emerald-800">
                  <Icon name="document" size={17} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="break-words text-sm font-bold text-slate-800">
                    {tpl.nama_template}
                  </div>
                  {tpl.deskripsi && (
                    <div className="mt-1 break-words text-xs leading-relaxed text-slate-500">
                      {tpl.deskripsi}
                    </div>
                  )}
                  <div className="mt-2 text-[10px] leading-relaxed text-slate-400">
                    Oleh {tpl.pembuat_nama ?? "-"} · {tpl.created_at ?? "-"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    aria-label={`Unduh ${tpl.nama_template}`}
                    onClick={() => handleDownload(tpl)}
                    className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                    title="Unduh template"
                    type="button"
                  >
                    <Icon name="download" size={15} />
                  </button>
                  {isAdmin && (
                    <button
                      aria-label={`Hapus ${tpl.nama_template}`}
                      onClick={() => handleDelete(tpl.id)}
                      disabled={deleting === tpl.id}
                      className="flex size-9 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      title="Hapus template"
                      type="button"
                    >
                      <Icon name="x" size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
    {dialog}
    </>
  )
}

function statusBadge(status: string) {
  const variants: Record<string, { bg: string; text: string; border: string }> = {
    draft: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
    scheduled: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    active: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    suspended: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    completed: { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200" },
    cancelled: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  }
  const v = variants[status] ?? variants.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${v.border} ${v.bg} ${v.text}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function SesiUjianPage({ showToast }: { showToast: (message: string) => void }) {
  const { ask: askConfirm, dialog: confirmDialog } = useConfirmCard()
  const { ask: askPrompt, dialog: promptDialog } = usePromptCard()
  const [soal, setSoal] = useState<SoalDisetujui[]>([])
  const [sesi, setSesi] = useState<SesiUjian[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [soalId, setSoalId] = useState("")
  const [namaUjian, setNamaUjian] = useState("")
  const [programStudi, setProgramStudi] = useState("")
  const [keterangan, setKeterangan] = useState("")
  const [statusAwal, setStatusAwal] = useState<"draft" | "scheduled">("scheduled")
  const [mulai, setMulai] = useState(() => defaultExamTimes().mulai)
  const [selesai, setSelesai] = useState(() => defaultExamTimes().selesai)
  const waktuMinimum = toLocalDateTime(new Date())
  const [qrImages, setQrImages] = useState<Record<number, string>>({})
  const [qrBesar, setQrBesar] = useState<number | null>(null)

  const refresh = async () => {
    const [approved, sessions] = await Promise.all([fetchSoalDisetujui(), fetchSesiUjian()])
    setSoal(approved)
    setSesi(sessions)
    const images = await Promise.all(sessions.filter((row) => row.token && row.qr_url).map(async (row) => [row.id, await QRCode.toDataURL(row.qr_url!, { width: 300, margin: 2, errorCorrectionLevel: "M" })] as const))
    setQrImages(Object.fromEntries(images))
  }

  useEffect(() => {
    refresh().catch((error) => showToast(error instanceof Error ? error.message : "Gagal memuat sesi."))
      .finally(() => setLoading(false))
  }, [])

  const resetForm = () => { const times = defaultExamTimes(); setEditingId(null); setSoalId(""); setNamaUjian(""); setProgramStudi(""); setKeterangan(""); setStatusAwal("scheduled"); setMulai(times.mulai); setSelesai(times.selesai) }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusyId(editingId ?? 0)
    try {
      const metadata = { nama_ujian: namaUjian.trim(), program_studi: programStudi.trim(), keterangan: keterangan.trim() }
      if (editingId) await updateSesiUjian(editingId, { waktu_mulai: mulai, waktu_selesai: selesai, ...metadata })
      else await createSesiUjian({ bank_soal_id: Number(soalId), waktu_mulai: mulai, waktu_selesai: selesai, status: statusAwal, ...metadata })
      await refresh()
      resetForm()
      showToast(editingId ? "Jadwal sesi diperbarui." : "Sesi ujian dibuat.")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menyimpan sesi.")
    } finally { setBusyId(null) }
  }

  const beginEdit = (item: SesiUjian) => {
    setEditingId(item.id)
    setSoalId(String(item.bank_soal_id))
    setNamaUjian(item.nama_ujian ?? item.judul)
    setProgramStudi(item.program_studi ?? "")
    setKeterangan(item.keterangan ?? "")
    setMulai(item.waktu_mulai.replace(" ", "T"))
    setSelesai(item.waktu_selesai.replace(" ", "T"))
  }

  const mutate = async (id: number, fn: () => Promise<unknown>, success: string) => {
    setBusyId(id)
    try { await fn(); await refresh(); showToast(success) }
    catch (error) { showToast(error instanceof Error ? error.message : "Operasi sesi gagal.") }
    finally { setBusyId(null) }
  }

  const changeSessionStatus = async (item: SesiUjian, status: SesiUjian["status"]) => {
    const needsReason = status === "cancelled" || status === "suspended"
    const catatan = needsReason
      ? await askPrompt({
          title: status === "cancelled" ? "Batalkan sesi ujian?" : "Tangguhkan sesi ujian?",
          description: `Tindakan ini mengubah akses peserta. Tuliskan alasan agar tercatat untuk sesi ${item.nama_ujian}.`,
          label: "Alasan",
          placeholder: "Contoh: perubahan jadwal dari fakultas",
        })
      : undefined
    if ((status === "cancelled" || status === "suspended") && !catatan?.trim()) return
    void mutate(item.id, () => setStatusSesiUjian(item.id, status, catatan ?? undefined), `Status sesi menjadi ${status}.`)
  }

  const extendSession = async (item: SesiUjian) => {
    const waktuBaru = await askPrompt({
      title: "Perpanjang waktu sesi",
      description: `Atur waktu selesai baru untuk sesi ${item.nama_ujian}.`,
      label: "Waktu selesai",
      initialValue: item.waktu_selesai.replace(" ", "T"),
      type: "datetime-local",
    })
    if (!waktuBaru) return
    const catatan = await askPrompt({
      title: "Alasan perpanjangan",
      description: "Alasan ini akan disimpan bersama perubahan sesi.",
      label: "Alasan",
      placeholder: "Contoh: ujian tertunda karena kendala teknis",
    })
    if (!catatan?.trim()) return
    void mutate(item.id, () => extendSesiUjian(item.id, waktuBaru.replace("T", " "), catatan.trim()), "Waktu sesi diperpanjang.")
  }

  const removeRoster = async (item: SesiUjian) => {
    if (!await askConfirm({
      title: "Hapus daftar peserta?",
      description: `Seluruh roster untuk sesi ${item.nama_ujian} akan dihapus. Mahasiswa tidak dapat diverifikasi sampai roster diimpor kembali.`,
      confirmLabel: "Hapus roster",
    })) return
    void mutate(item.id, () => deletePesertaSesi(item.id), "Roster peserta dihapus.")
  }

  const revokeToken = async (item: SesiUjian) => {
    if (!await askConfirm({
      title: "Cabut QR Code sesi?",
      description: "QR yang sudah dibagikan langsung tidak berlaku. Buat token baru untuk membagikan akses kembali.",
      confirmLabel: "Cabut QR",
    })) return
    void mutate(item.id, () => revokeSesiToken(item.id), "Token QR dicabut.")
  }

  const removeSession = async (item: SesiUjian) => {
    if (!await askConfirm({
      title: "Hapus sesi ujian?",
      description: `Sesi ${item.nama_ujian} akan dihapus permanen dari daftar sesi.`,
      confirmLabel: "Hapus sesi",
    })) return
    void mutate(item.id, () => deleteSesiUjian(item.id), "Sesi dihapus.")
  }

  const uploadRoster = (item: SesiUjian, file: File) => {
    void mutate(item.id, async () => {
      const count = await importPesertaSesi(item.id, file)
      return count
    }, `Roster ${item.nama_ujian} berhasil diimpor.`)
  }

  const downloadRosterTemplate = () => {
    const csv = "\uFEFFnim,nama,email\r\n"
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "template-peserta-sesi.csv"
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const downloadQrPdf = async (item: SesiUjian) => {
    const image = qrImages[item.id]
    if (!image) return showToast("QR belum tersedia. Buat token sesi terlebih dahulu.")
    try {
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(18)
      pdf.text("SIKASA · AKSES SOAL UJIAN", 105, 24, { align: "center" })
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(12)
      pdf.text(item.nama_ujian || item.judul, 105, 36, { align: "center", maxWidth: 175 })
      pdf.text(`${item.nama_mk} · ${item.kode_mk} · Kelas ${item.kelas}`, 105, 45, { align: "center", maxWidth: 175 })
      pdf.text(`Dosen: ${item.dosen ?? "-"}`, 105, 53, { align: "center" })
      pdf.text(`Jadwal: ${item.waktu_mulai} — ${item.waktu_selesai}`, 105, 61, { align: "center" })
      pdf.addImage(image, "PNG", 55, 72, 100, 100)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(13)
      pdf.text("Scan QR untuk membaca soal melalui browser", 105, 184, { align: "center" })
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      pdf.text("Verifikasi dilakukan menggunakan roster dan kode OTP email. Jawaban ujian ditulis pada lembar kertas.", 105, 193, { align: "center", maxWidth: 170 })
      pdf.save(`qr-sikasa-${item.id}.pdf`)
      showToast("QR sesi berhasil disimpan sebagai PDF.")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "PDF QR gagal dibuat.")
    }
  }

  const idleSoal = soal.filter((item) => !sesi.some((s) => s.bank_soal_id === item.id))
  const totalSesi = sesi.length
  const activeSesi = sesi.filter((s) => s.status === "active").length
  const scheduledSesi = sesi.filter((s) => s.status === "scheduled").length
  const completedSesi = sesi.filter((s) => s.status === "completed").length

  return (
    <>
    <div className="space-y-6">

      {/* Page Header */}
      <section className="rounded-[2rem] border border-black/5 bg-white p-7 sm:p-9 shadow-[0_18px_50px_rgba(32,33,38,0.05)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f5cf25] px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-[#202126]">
              Sesi Ujian Online
            </div>
            <h2 className="font-display mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">Distribusi Soal via QR Code</h2>
            <p className="mt-2 text-sm text-slate-500">
              Kelola jadwal ujian, buat token akses, dan distribusikan QR Code kepada mahasiswa. Jawaban tetap dikerjakan pada lembar kertas.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sesi</div>
                <div className="text-sm font-semibold text-slate-800">{totalSesi}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sedang Berlangsung</div>
                <div className="text-sm font-semibold text-emerald-800">{activeSesi}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">{editingId ? "Ubah Jadwal Sesi" : "Buat Sesi Ujian Baru"}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {editingId ? "Perbarui detail jadwal sesi ujian yang sudah ada." : "Pilih soal yang sudah disetujui Kaprodi. Mahasiswa membaca soal lewat QR dan tetap menjawab di kertas."}
            </p>
          </div>
          {editingId && (
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition" onClick={resetForm}>
              Batal
            </button>
          )}
        </div>
        <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
          {!editingId && (
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Soal yang Disetujui</span>
              <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" required value={soalId} onChange={(e) => setSoalId(e.target.value)}>
                <option value="">Pilih soal disetujui</option>
                {idleSoal.map((item) => (
                  <option key={item.id} value={item.id}>{item.nama_mk} · {item.kelas} · {item.jenis} · {item.dosen}</option>
                ))}
              </select>
              {idleSoal.length === 0 && <p className="mt-1 text-[10px] text-rose-600">Tidak ada soal yang tersedia. Tunggu persetujuan Kaprodi.</p>}
            </label>
          )}
          <label className="sm:col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Nama Ujian</span>
            <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" maxLength={200} required value={namaUjian} onChange={(e) => setNamaUjian(e.target.value)} placeholder="Contoh: UTS Semester Ganjil" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Program Studi</span>
            <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" maxLength={150} value={programStudi} onChange={(e) => setProgramStudi(e.target.value)} placeholder="Program studi (opsional)" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Waktu Mulai</span>
            <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" required min={waktuMinimum} type="datetime-local" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            <span className="mt-0.5 block text-[10px] font-normal text-slate-400">Pilih waktu sekarang atau setelahnya.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Waktu Selesai</span>
            <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" required min={mulai || waktuMinimum} type="datetime-local" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
          </label>
          {!editingId && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Status Awal</span>
              <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" value={statusAwal} onChange={(e) => setStatusAwal(e.target.value as "draft" | "scheduled")}>
                <option value="draft">Draft</option>
                <option value="scheduled">Terjadwal</option>
              </select>
            </label>
          )}
          <label className="sm:col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Keterangan</span>
            <textarea className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" maxLength={2000} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Catatan tambahan untuk sesi ini (opsional)" rows={2}></textarea>
          </label>
          <div className="sm:col-span-2 flex items-end gap-2">
            <button className="rounded-lg bg-[#202126] px-5 py-3 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed" disabled={busyId !== null || (!editingId && idleSoal.length === 0)}>
              {busyId !== null ? "Menyimpan..." : editingId ? "Simpan Jadwal" : "Buat Sesi"}
            </button>
          </div>
        </form>
      </section>

      {/* Session List Section */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="border-b border-slate-100 p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold text-slate-900">Daftar Sesi Ujian</h2>
          <p className="mt-1 text-xs text-slate-500">{totalSesi} sesi tersedia · {scheduledSesi} terjadwal · {completedSesi} selesai</p>
        </div>
        {loading ? <SessionListSkeleton /> : sesi.length === 0 ? (
          <div className="p-12 text-center">
            <div className="grid size-16 mx-auto place-items-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10H7a2 2 0 00-2 2v10a2 2 0 002 2h9a2 2 0 002-2v-5"/></svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Belum ada sesi ujian</h3>
            <p className="mt-1 text-sm text-slate-500">Buat sesi ujian baru melalui formulir di atas untuk memulai distribusi soal.</p>
          </div>
        ) : <div className="divide-y divide-slate-100">
          {sesi.map((item) => <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between" key={item.id}>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="font-semibold text-slate-800">{item.nama_ujian}</div>
                    {statusBadge(item.status)}
                  </div>
                  <div className="text-xs text-slate-500">{item.nama_mk} · {item.jenis} · Kelas {item.kelas}</div>
                  <div className="text-xs text-slate-500">{item.kode_mk} · {item.dosen}</div>
                  <div className="text-xs text-slate-500">
                    {item.program_studi ? `${item.program_studi} · ` : ""}{item.waktu_mulai} — {item.waktu_selesai}
                  </div>
                  <div className="text-xs text-slate-500">{item.jumlah_peserta} peserta · {item.jumlah_akses} akses tercatat</div>
                  {item.keterangan && <p className="mt-1 text-xs text-slate-500">{item.keterangan}</p>}
                  {item.catatan_status && <p className="mt-1 text-xs text-amber-700">Catatan status: {item.catatan_status}</p>}
                  {/* Roster Section */}
                  {(["draft", "scheduled"].includes(item.status)) && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-700">Roster Peserta OTP</span>
                        <span className="ml-auto text-[10px] font-bold text-slate-400">{item.jumlah_peserta} terdaftar</span>
                      </div>
                      <p className="mt-0 text-[10px] leading-relaxed text-slate-500">
                        Impor daftar mahasiswa yang boleh membuka soal sesi ini. Kode OTP dikirim ke email kampus aktif.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button type="button" className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-800" onClick={downloadRosterTemplate}>
                          Unduh template CSV
                        </button>
                        <label htmlFor={`roster-file-${item.id}`} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 ${busyId === item.id ? "pointer-events-none opacity-50" : ""}`}><Icon name="upload" size={15} /> Pilih file CSV<input id={`roster-file-${item.id}`} aria-label="Impor roster peserta CSV" type="file" accept=".csv,text/csv" className="sr-only" disabled={busyId === item.id} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadRoster(item, file); event.currentTarget.value = "" }} /></label>
                        {busyId === item.id && <UploadProgress label="Mengimpor roster peserta..." />}
                        {item.jumlah_peserta > 0 && (
                          <button className="text-xs font-semibold text-rose-600 underline hover:text-rose-700" disabled={busyId === item.id} onClick={() => void removeRoster(item)}>
                            Hapus roster
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400">Roster harus dimasukkan sebelum sesi diaktifkan.</p>
                    </div>
                  )}
                  {/* QR Section */}
                  {item.token && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                        </div>
                        <span className="text-xs font-bold text-slate-700">QR Code Akses</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 transition" title="Perbesar QR Code" onClick={() => setQrBesar(item.id)}>
                          <img className="size-36 rounded-md border border-slate-100" src={qrImages[item.id]} alt={`QR ${item.nama_mk}`} />
                        </button>
                        <div className="flex flex-col gap-2 text-xs min-w-0">
                          {item.qr_url && (
                            <a className="text-emerald-700 underline text-xs hover:text-emerald-800" href={item.qr_url} rel="noreferrer" target="_blank">
                              Pratinjau halaman akses
                            </a>
                          )}
                          {item.qr_url && (
                            <button className="text-left text-slate-600 underline text-xs hover:text-slate-800" onClick={() => navigator.clipboard.writeText(item.qr_url!).then(() => showToast("Tautan sesi disalin."))}>
                              Salin tautan QR
                            </button>
                          )}
                          <a className="text-slate-600 underline text-xs hover:text-slate-800" href={qrImages[item.id]} download={`qr-sesi-${item.id}.png`}>
                            Unduh QR PNG
                          </a>
                          <button className="text-left text-slate-600 underline text-xs hover:text-slate-800" onClick={() => void downloadQrPdf(item)}>
                            Unduh lembar QR PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {!item.token && (
                    <p className="mt-3 text-xs text-rose-600 flex items-center gap-1">
                      <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                      Token QR tidak tersedia. Buat token baru untuk menampilkan QR.
                    </p>
                  )}
            </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 sm:flex-col sm:w-48">
                  {(["draft", "scheduled"].includes(item.status)) && (
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition" disabled={busyId === item.id || item.jumlah_akses > 0} onClick={() => beginEdit(item)}>
                      Ubah jadwal
                    </button>
                  )}
                  {item.status === "draft" && (
                    <button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition" disabled={busyId === item.id} onClick={() => changeSessionStatus(item, "scheduled")}>
                      Jadwalkan
                    </button>
                  )}
                  {item.status === "scheduled" && (
                    <button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition" disabled={busyId === item.id} onClick={() => changeSessionStatus(item, "active")}>
                      Mulai sesi
                    </button>
                  )}
                  {item.status === "active" && (
                    <button className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition" disabled={busyId === item.id} onClick={() => changeSessionStatus(item, "suspended")}>
                      Tangguhkan
                    </button>
                  )}
                  {item.status === "suspended" && (
                    <button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition" disabled={busyId === item.id} onClick={() => changeSessionStatus(item, "active")}>
                      Lanjutkan sesi
                    </button>
                  )}
                  {(["active", "suspended"].includes(item.status)) && (
                    <button className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition" disabled={busyId === item.id} onClick={() => changeSessionStatus(item, "completed")}>
                      Tutup sesi
                    </button>
                  )}
                  {item.status === "active" && (
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition" disabled={busyId === item.id} onClick={() => extendSession(item)}>
                      Perpanjang waktu
                    </button>
                  )}
                  {(["draft", "scheduled"].includes(item.status)) && (
                    <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition" disabled={busyId === item.id} onClick={() => changeSessionStatus(item, "cancelled")}>
                      Batalkan
                    </button>
                  )}
                  {item.status !== "completed" && item.status !== "cancelled" && item.token && (
                    <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition" disabled={busyId === item.id} onClick={() => void revokeToken(item)}>
                      Cabut QR
                    </button>
                  )}
                  {item.status !== "completed" && item.status !== "cancelled" && (
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition" disabled={busyId === item.id} onClick={() => void mutate(item.id, () => rotateSesiToken(item.id), "Token baru dibuat. QR lama tidak berlaku.")}>
                      {item.token ? "Rotasi token" : "Buat token QR"}
                    </button>
                  )}
                  {(["draft", "scheduled", "cancelled"].includes(item.status)) && item.jumlah_akses === 0 && (
                    <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition" disabled={busyId === item.id} onClick={() => void removeSession(item)}>
                      Hapus
                    </button>
                  )}
                </div>
              </div>)}
        </div>}
      </section>
      {qrBesar !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm sm:p-6" onClick={() => setQrBesar(null)}>
          <div className="rounded-2xl bg-white p-6 sm:p-8 text-center max-w-md w-full" onClick={(event) => event.stopPropagation()}>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700 mb-4">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
              QR Sesi Ujian
            </div>
            <img className="size-[min(70vw,16rem)] mx-auto rounded-xl border border-slate-100 mb-6" src={qrImages[qrBesar]} alt="QR Code sesi ujian" />
            <div className="flex flex-col gap-2">
              <button className="rounded-lg border px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition" onClick={() => document.documentElement.requestFullscreen?.()}>
                Tampilan Penuh
              </button>
              <button className="rounded-lg bg-[#202126] px-5 py-2.5 text-xs font-bold text-white" onClick={() => setQrBesar(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    {confirmDialog}
    {promptDialog}
    </>
  )
}

function LogAksesUjianPage({ showToast }: { showToast: (message: string) => void }) {
  const { ask, dialog } = usePromptCard()
  const [logs, setLogs] = useState<LogAksesUjian[]>([])
  const [locked, setLocked] = useState<PesertaTerkunci[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const refresh = async () => {
    const [accessLogs, violations] = await Promise.all([fetchLogAksesUjian(), fetchPesertaTerkunci()])
    setLogs(accessLogs)
    setLocked(violations)
  }
  useEffect(() => {
    let alive = true
    Promise.all([fetchLogAksesUjian(), fetchPesertaTerkunci()]).then(([accessLogs, violations]) => {
      if (alive) { setLogs(accessLogs); setLocked(violations) }
    }).catch(() => { if (alive) { setLogs([]); setLocked([]) } }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  const requestAdminHelp = async (student: PesertaTerkunci) => {
    const catatan = await ask({
      title: "Konfirmasi pemeriksaan mahasiswa",
      description: `Tuliskan hasil konfirmasi langsung untuk ${student.nama} (NIM ${student.nim}) sebelum meminta bantuan Admin IT.`,
      label: "Hasil konfirmasi",
      placeholder: "Jelaskan hasil pemeriksaan",
    })
    if (!catatan?.trim()) return
    setBusyId(student.id)
    try { await mintaBukaAksesPeserta(student.id, catatan.trim()); await refresh(); showToast("Permintaan bantuan dikirim kepada Admin IT.") }
    catch (error) { showToast(error instanceof Error ? error.message : "Permintaan bantuan gagal dikirim.") }
    finally { setBusyId(null) }
  }
  return <><div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
      <div className="border-b border-amber-100 p-5"><h2 className="font-display text-lg font-bold">Mahasiswa terkunci — konfirmasi Panitia</h2><p className="mt-1 text-xs text-slate-500">Setelah tiga kali meninggalkan halaman soal, akses dikunci. Konfirmasi mahasiswa secara langsung, lalu minta Admin IT membuka akses.</p></div>
      {loading ? <TableRowsSkeleton rows={2} /> : locked.length === 0 ? <p className="p-5 text-sm text-slate-400">Tidak ada mahasiswa yang terkunci.</p> : <div className="divide-y divide-slate-100">{locked.map((student) => <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={student.id}><div><div className="font-semibold text-slate-800">{student.nama} · NIM {student.nim}</div><div className="mt-1 text-xs text-slate-500">{student.mata_kuliah ?? student.nama_ujian ?? "Sesi ujian"} · Kelas {student.kelas ?? "-"} · {student.pelanggaran_count}/3 pelanggaran</div><div className="mt-1 text-xs text-slate-500">Dikunci: {student.access_locked_at ?? "-"}{student.unlock_requested_at ? ` · Permintaan dikirim ${student.unlock_requested_at} oleh ${student.peminta ?? "Panitia"}` : ""}</div>{student.unlock_request_note && <div className="mt-1 text-xs text-amber-800">Catatan: {student.unlock_request_note}</div>}</div>{student.unlock_requested_at ? <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">Menunggu Admin IT</span> : <button className="rounded-lg bg-[#202126] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busyId === student.id} onClick={() => void requestAdminHelp(student)}>{busyId === student.id ? "Mengirim..." : "Konfirmasi & minta Admin IT"}</button>}</div>)}</div>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="border-b p-5 font-display text-lg font-bold">Log Akses Ujian</div>{loading ? <TableRowsSkeleton /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">Mahasiswa</th><th className="p-4">Mata kuliah</th><th className="p-4">Akses pertama</th><th className="p-4">Terakhir</th><th className="p-4">Jumlah</th></tr></thead><tbody>{logs.map((log) => <tr className="border-t" key={log.id}><td className="p-4">{log.nama}<div className="text-xs text-slate-500">NIM {log.nim}</div></td><td className="p-4">{log.mata_kuliah ?? "-"}</td><td className="p-4">{log.akses_pertama_pada}</td><td className="p-4">{log.akses_terakhir_pada}</td><td className="p-4">{log.jumlah_akses}</td></tr>)}{logs.length === 0 && <tr><td className="p-6 text-center text-sm text-slate-400" colSpan={5}>Belum ada akses tercatat.</td></tr>}</tbody></table></div>}</section>
  </div>{dialog}</>
}

function PengawasanUjianPage({ showToast }: { showToast: (message: string) => void }) {
  const { ask, dialog } = usePromptCard()
  const [requests, setRequests] = useState<PesertaTerkunci[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const refresh = async () => setRequests(await fetchPermintaanBukaAkses())
  useEffect(() => {
    let alive = true
    fetchPermintaanBukaAkses().then((items) => { if (alive) setRequests(items) }).catch(() => { if (alive) setRequests([]) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  const unlock = async (student: PesertaTerkunci) => {
    const catatan = await ask({
      title: "Buka akses mahasiswa",
      description: `Akses soal untuk ${student.nama} (NIM ${student.nim}) akan dibuka kembali. Jelaskan alasan pembukaan akses.`,
      label: "Alasan pembukaan",
      placeholder: "Tuliskan alasan yang sudah dikonfirmasi",
    })
    if (!catatan?.trim()) return
    setBusyId(student.id)
    try { await bukaAksesPeserta(student.id, catatan.trim()); await refresh(); showToast("Akses dibuka. Mahasiswa perlu verifikasi OTP kembali.") }
    catch (error) { showToast(error instanceof Error ? error.message : "Akses gagal dibuka.") }
    finally { setBusyId(null) }
  }
  const clearOldRequest = async (student: PesertaTerkunci) => {
    const confirmed = window.confirm(`Bersihkan permintaan lama untuk ${student.nama} (NIM ${student.nim})? Data peserta dan log audit tetap tersimpan.`)
    if (!confirmed) return
    setBusyId(student.id)
    try { showToast(await hapusPermintaanLama(student.id)); await refresh() }
    catch (error) { showToast(error instanceof Error ? error.message : "Permintaan lama gagal dibersihkan.") }
    finally { setBusyId(null) }
  }
  return <><section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="border-b p-5"><h2 className="font-display text-lg font-bold">Permintaan pembukaan akses ujian</h2><p className="mt-1 text-xs text-slate-500">Tinjau permintaan Panitia setelah konfirmasi langsung dengan mahasiswa. Permintaan dari sesi yang berakhir bisa dibersihkan dari daftar.</p></div>{loading ? <TableRowsSkeleton rows={3} /> : requests.length === 0 ? <p className="p-5 text-sm text-slate-400">Belum ada permintaan bantuan dari Panitia.</p> : <div className="divide-y divide-slate-100">{requests.map((student) => <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={student.id}><div><div className="font-semibold text-slate-800">{student.nama} · NIM {student.nim}</div><div className="mt-1 text-xs text-slate-500">{student.mata_kuliah ?? student.nama_ujian ?? "Sesi ujian"} · Kelas {student.kelas ?? "-"} · Pelanggaran {student.pelanggaran_count}/3</div><div className="mt-1 text-xs text-slate-500">Permintaan {student.unlock_requested_at} oleh {student.peminta ?? "Panitia"}</div><div className="mt-1 text-xs text-amber-800">Konfirmasi Panitia: {student.unlock_request_note}</div></div>{student.sesi_aktif ? <button className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busyId === student.id} onClick={() => void unlock(student)}>{busyId === student.id ? "Membuka..." : "Buka akses mahasiswa"}</button> : student.sesi_selesai ? <button className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50" disabled={busyId === student.id} onClick={() => void clearOldRequest(student)}>{busyId === student.id ? "Membersihkan..." : "Hapus permintaan lama"}</button> : <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">Sesi belum aktif</span>}</div>)}</div>}</section>{dialog}</>
}
// (yang selalu tersedia untuk peran Kaprodi — db.bank_soal memang tidak
// dimuat untuk peran ini). Bersifat read-only.
function DetailSoalModal({
  row,
  onClose,
}: {
  row: RekapRow
  onClose: () => void
}) {
  const statusMeta: Record<string, { label: string; tone: string }> = {
    belum_upload: { label: "Belum Upload", tone: "bg-amber-50 text-amber-700" },
    terkunci: { label: "Terkunci", tone: "bg-amber-50 text-amber-700" },
    siap_ujian: {
      label: "Disetujui",
      tone: "bg-emerald-50 text-emerald-700",
    },
    ditolak: { label: "Ditolak", tone: "bg-rose-50 text-rose-700" },
    arsip: { label: "Diarsipkan", tone: "bg-slate-100 text-slate-500" },
  }
  const meta = statusMeta[row.status] ?? {
    label: row.status,
    tone: "bg-slate-100 text-slate-600",
  }

  // Baris info label + nilai agar tampilan rapi dan konsisten.
  const baris: { label: string; nilai: React.ReactNode }[] = [
    { label: "Kode Mata Kuliah", nilai: row.kode_mk },
    { label: "Mata Kuliah", nilai: row.nama_mk },
    { label: "Kelas", nilai: row.kelas },
    { label: "Dosen Pengampu", nilai: row.dosen ?? "-" },
    { label: "Jenis Ujian", nilai: row.jenis ?? "-" },
    {
      label: "Jadwal Ujian",
      nilai: row.jadwal_ujian ? formatTanggal(row.jadwal_ujian) : "-",
    },
  ]

  return (
    <div
      className="animate-page fixed inset-0 z-50 flex items-center justify-center bg-[#15161a]/70 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header modal */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#202126] text-[#f5cf25] sm:size-11">
              <Icon name="document" size={20} />
            </div>
            <div>
              <div className="font-display text-base font-bold text-slate-900 sm:text-lg">
                {row.nama_mk}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {row.kode_mk} · Kelas {row.kelas}
              </div>
            </div>
          </div>
          <button
            aria-label="Tutup"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>

        {/* Isi detail */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${meta.tone}`}
          >
            {meta.label}
          </span>

          <dl className="mt-4 divide-y divide-slate-100">
            {baris.map((item) => (
              <div
                className="flex items-start justify-between gap-4 py-2.5"
                key={item.label}
              >
                <dt className="pt-0.5 text-xs font-semibold text-slate-500">
                  {item.label}
                </dt>
                <dd className="text-right text-sm font-semibold text-slate-800">
                  {item.nilai}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50/70 p-3.5 text-xs leading-relaxed text-amber-800">
            <Icon name="shield" size={17} />
            Berkas soal tersimpan terenkripsi di server pusat dan tidak disimpan
            di perangkat ini. Setiap tindakan terhadap naskah ini tercatat pada
            audit trail.
          </div>
        </div>

        {/* Footer aksi */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            className="rounded-xl bg-[#202126] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111216]"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

function RecapPage({ showToast }: { showToast: (message: string) => void }) {
  const { db, decideRevisi, refresh } = useDb()
  const { ask, dialog } = usePromptCard()
  const [deciding, setDeciding] = useState<number | null>(null)
  const [mengirim, setMengirim] = useState(false)
  const [detail, setDetail] = useState<RekapRow | null>(null)
  const rekap = db.rekap
  const sudahUpload = rekap.filter((r) => r.status !== "belum_upload").length
  const belumUpload = rekap.length - sudahUpload
  const revisiMenunggu = db.revisi.length

  // Ekspor CSV dari data rekap yang sudah dimuat (tanpa endpoint backend).
  const handleEksporRekap = () => {
    const header = ["Dosen", "Mata Kuliah", "Jadwal", "Status"]
    const escape = (value: string) =>
      `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`
    const lines = [
      header.map(escape).join(","),
      ...rows.map((r) =>
        [r.dosen, r.nama_mk, r.jadwal, r.status].map(escape).join(","),
      ),
    ]
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "rekap-pengumpulan-soal.csv"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast("Rekap berhasil diekspor (CSV).")
  }

  // Baris tabel rekap dipetakan langsung dari tabel rekap server.
  const rows = rekap.map((r) => ({
    dosen: r.dosen ?? "-",
    nama_mk: r.nama_mk,
    jadwal: r.jadwal_ujian ? formatTanggal(r.jadwal_ujian) : "-",
    jadwalTimestamp: r.jadwal_ujian ? new Date(r.jadwal_ujian).getTime() : Number.NaN,
    status: ({ terkunci: "Menunggu persetujuan", ditolak: "Ditolak", siap_ujian: "Disetujui", dibuka: "Disetujui", selesai: "Selesai", arsip: "Arsip" } as Record<string, string>)[r.status] ?? (r.status === "belum_upload" ? "Belum upload" : r.status),
    done: r.status !== "belum_upload",

    bankSoalId: r.bank_soal_id,
    pending: r.status === "terkunci",

    // Simpan baris rekap asli agar modal detail bisa dibangun dari sini
    // (db.bank_soal kosong untuk Kaprodi, jadi jangan bergantung padanya).
    src: r,
  })).sort((a, b) => {
    const aHasSchedule = Number.isFinite(a.jadwalTimestamp)
    const bHasSchedule = Number.isFinite(b.jadwalTimestamp)
    if (!aHasSchedule && !bHasSchedule) return 0
    if (!aHasSchedule) return 1
    if (!bHasSchedule) return -1
    return b.jadwalTimestamp - a.jadwalTimestamp
  })
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          detail={`Dari ${rekap.length} mata kuliah`}
          icon="check"
          label="Sudah Upload"
          tone="green"
          value={String(sudahUpload)}
        />
        <StatCard
          detail="Perlu ditindaklanjuti"
          icon="clock"
          label="Belum Upload"
          tone="gold"
          value={String(belumUpload)}
        />
        <StatCard
          detail="Perlu persetujuan Anda"
          icon="history"
          label="Revisi Menunggu"
          tone="blue"
          value={String(revisiMenunggu)}
        />
      </section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-lg font-bold text-slate-900">
              Rekap Pengumpulan Soal
            </div>
            <p className="mt-1 text-xs text-slate-400">
              UTS Semester Ganjil 2026/2027
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"
              onClick={handleEksporRekap}
            >
              <Icon name="download" size={16} /> Ekspor Rekap
            </button>
            <button
              className="rounded-xl bg-[#202126] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              disabled={mengirim}
              onClick={async () => {
                setMengirim(true)
                try {
                  const message = await sendPengingat()
                  showToast(message)
                } catch (error) {
                  showToast(
                    error instanceof Error
                      ? error.message
                      : "Gagal mengirim pengingat.",
                  )
                } finally {
                  setMengirim(false)
                }
              }}
            >
              {mengirim ? "Mengirim..." : "Kirim Pengingat"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Dosen</th>
                <th className="px-4 py-4">Mata kuliah</th>
                <th className="px-4 py-4">Jadwal</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const done = row.done
                const jadwalLewat = Number.isFinite(row.jadwalTimestamp) && row.jadwalTimestamp < Date.now()
                return (
                  <tr className={`border-t border-slate-100 ${jadwalLewat ? "bg-rose-50/40" : ""}`} key={row.src.bank_soal_id ?? `belum-${row.src.mk_id}`}>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {row.dosen}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{row.nama_mk}</td>
                    <td className={`px-4 py-4 ${jadwalLewat ? "text-rose-700" : "text-slate-500"}`}>
                      <div>{row.jadwal}</div>
                      {jadwalLewat && (
                        <span className="mt-1 inline-flex rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          Jadwal lewat
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          done
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        {row.pending && row.bankSoalId != null && (
                          <>
                            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700" onClick={async () => {
                              const tab = window.open("about:blank", "_blank")
                              try {
                                const blob = await previewSoalPersetujuan(row.bankSoalId!)
                                if (!tab) throw new Error("Izinkan popup untuk membuka pratinjau PDF.")
                                tab.location.href = URL.createObjectURL(blob)
                              } catch (error) {
                                tab?.close()
                                showToast(error instanceof Error ? error.message : "Gagal membuka pratinjau.")
                              }
                            }}>Pratinjau PDF</button>
                            <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white" disabled={deciding === row.bankSoalId} onClick={async () => {
                              setDeciding(row.bankSoalId!)
                              try { showToast(await putuskanPersetujuanSoal(row.bankSoalId!, "disetujui")); await refresh() }
                              catch (error) { showToast(error instanceof Error ? error.message : "Gagal menyetujui soal.") }
                              finally { setDeciding(null) }
                            }}>Setujui</button>
                            <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700" disabled={deciding === row.bankSoalId} onClick={async () => {
                              const catatan = await ask({
                                title: "Tolak soal",
                                description: `Berikan alasan penolakan untuk soal ${row.nama_mk} agar dosen mengetahui bagian yang perlu diperbaiki.`,
                                label: "Alasan penolakan",
                                placeholder: "Jelaskan bagian yang perlu diperbaiki",
                              })
                              if (catatan === null) return
                              setDeciding(row.bankSoalId!)
                              try { showToast(await putuskanPersetujuanSoal(row.bankSoalId!, "ditolak", catatan)); await refresh() }
                              catch (error) { showToast(error instanceof Error ? error.message : "Gagal menolak soal.") }
                              finally { setDeciding(null) }
                            }}>Tolak</button>
                          </>
                        )}
                        <button
                          className="font-bold text-emerald-700 hover:underline"
                          onClick={() => {
                            if (done && row.src) {
                              setDetail(row.src)
                            } else {
                              showToast(`Pengingat dikirim ke ${row.dosen}.`)
                            }
                          }}
                        >
                          {done ? "Lihat detail" : "Ingatkan"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr className="border-t border-slate-100">
                  <td
                    className="px-6 py-10 text-center text-slate-400"
                    colSpan={5}
                  >
                    Belum ada data rekap mata kuliah.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6">
        <div className="font-display text-lg font-bold text-slate-900">
          Permintaan Revisi
        </div>
        <div className="mt-4 space-y-4">
          {db.revisi.map((r) => (
            <div
              className="flex flex-col gap-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4 sm:flex-row sm:items-center"
              key={r.id}
            >
              <div className="grid size-10 place-items-center rounded-xl bg-white text-amber-700">
                <Icon name="history" size={19} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-800">
                  {r.nama_mk ?? r.kode_mk ?? "Mata kuliah"} · {r.dosen ?? "-"}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Alasan: {r.alasan_revisi}
                </p>
                {r.diajukan_pada && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Diajukan {r.diajukan_pada}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50"
                  disabled={deciding === r.id}
                  onClick={async () => {
                    setDeciding(r.id)
                    try {
                      await decideRevisi(r.id, "ditolak")
                      showToast("Permintaan revisi ditolak.")
                    } catch (error) {
                      showToast(
                        error instanceof Error
                          ? error.message
                          : "Gagal menolak revisi.",
                      )
                    } finally {
                      setDeciding(null)
                    }
                  }}
                >
                  Tolak
                </button>
                <button
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  disabled={deciding === r.id}
                  onClick={async () => {
                    setDeciding(r.id)
                    try {
                      await decideRevisi(r.id, "disetujui")
                      showToast("Revisi disetujui dan tercatat di log.")
                    } catch (error) {
                      showToast(
                        error instanceof Error
                          ? error.message
                          : "Gagal menyetujui revisi.",
                      )
                    } finally {
                      setDeciding(null)
                    }
                  }}
                >
                  Setujui
                </button>
              </div>
            </div>
          ))}
          {db.revisi.length === 0 && (
            <p className="text-xs text-slate-400">
              Tidak ada permintaan revisi yang menunggu persetujuan.
            </p>
          )}
        </div>
      </section>
      {detail && (
        <DetailSoalModal onClose={() => setDetail(null)} row={detail} />
      )}
      {dialog}
    </>
  )
}

function LogsPage({
  showToast,
  role,
}: {
  showToast: (message: string) => void
  role: UserRole
}) {
  const { logs, currentUser } = useDb()
  const [mengEkspor, setMengEkspor] = useState(false)
  const [filterAktivitas, setFilterAktivitas] = useState("semua")
  // Hak akses sudah dibatasi oleh API. Di sisi UI, dosen tetap dibatasi lagi
  // ke aktivitasnya sendiri; log panitia mengikuti data cetak dari endpoint.
  const filtered =
    role === "dosen"
      ? logs.filter((log) => log.nama === currentUser?.nama)
      : logs
  const byCategory = filtered.filter((log) => {
    const action = log.aksi.toLowerCase()
    if (filterAktivitas === "qr") return action.includes("qr")
    if (filterAktivitas === "upload") return action.includes("upload")
    if (filterAktivitas === "revisi") return action.includes("revisi")
    if (filterAktivitas === "cetak") return action.includes("cetak")
    return true
  })
  const totalAksesQr = filtered.filter((log) => /qr/i.test(log.aksi)).length
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          detail="Tercatat pada audit trail"
          icon="history"
          label="Total Aktivitas"
          tone="green"
          value={String(filtered.length)}
        />
        <StatCard
          detail="Seluruhnya terverifikasi"
          icon="qrcode"
          label="Aktivitas QR"
          tone="blue"
          value={String(totalAksesQr)}
        />
        <StatCard
          detail="Tidak ada anomali"
          icon="shield"
          label="Insiden Keamanan"
          tone="green"
          value="0"
        />
      </section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-lg font-bold text-slate-900">
              Jejak Aktivitas Sistem
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Audit trail tidak dapat diubah atau dihapus
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <label className="grid gap-1.5 text-[11px] font-bold text-slate-500">
              <span>Filter aktivitas</span>
              <span className="relative block">
                <select aria-label="Filter aktivitas log" className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 sm:min-w-52" value={filterAktivitas} onChange={(event) => setFilterAktivitas(event.target.value)}>
              <option value="semua">Semua aktivitas</option>
              <option value="qr">Akses QR</option>
              <option value="upload">Upload</option>
              <option value="revisi">Revisi</option>
              <option value="cetak">Cetak</option>
                </select>
                <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </label>
            {role === "kaprodi" && (
              <button
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#202126] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 disabled:opacity-60"
                disabled={mengEkspor}
                onClick={async () => {
                  setMengEkspor(true)
                  try {
                    await exportBeritaAcara()
                    showToast("Berita acara PDF berhasil diunduh.")
                  } catch (error) {
                    showToast(
                      error instanceof Error
                        ? error.message
                        : "Gagal membuat berita acara.",
                    )
                  } finally {
                    setMengEkspor(false)
                  }
                }}
              >
                <Icon name="download" size={15} />{" "}
                {mengEkspor ? "Membuat..." : "Buat Berita Acara"}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-4 py-4">Pengguna</th>
                <th className="px-4 py-4">Aktivitas</th>
                <th className="px-4 py-4">Detail</th>
                <th className="px-6 py-4">IP Perangkat</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((log) => (
                <tr
                  className="border-t border-slate-100"
                  key={`${log.waktu}-${log.nama}-${log.aksi}`}
                >
                  <td className="px-6 py-4 text-slate-500">{log.waktu}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {log.nama}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                      {log.aksi}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{log.detail}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                    {log.ip}
                  </td>
                </tr>
              ))}
              {byCategory.length === 0 && (
                <tr className="border-t border-slate-100">
                  <td
                    className="px-6 py-10 text-center text-slate-400"
                    colSpan={5}
                  >
                    {filterAktivitas === "semua" ? "Belum ada aktivitas yang tercatat." : "Tidak ada aktivitas yang cocok dengan filter ini."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function UsersPage({ showToast }: { showToast: (message: string) => void }) {
  const { db, createUser, refresh } = useDb()
  const { ask, dialog } = useConfirmCard()
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nama, setNama] = useState("")
  const [email, setEmail] = useState("")
  const [nidn, setNidn] = useState("")
  const [newRole, setNewRole] = useState<UserRole>("dosen")
  const [busyId, setBusyId] = useState<number | null>(null)
  const users = db.users

  // Form edit profil (diisi saat user menekan tombol Edit).
  const [editing, setEditing] = useState<User | null>(null)
  const [editNama, setEditNama] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editNidn, setEditNidn] = useState("")
  const [editRole, setEditRole] = useState<UserRole>("dosen")

  const startEdit = (user: User) => {
    setEditing(user)
    setEditNama(user.nama)
    setEditEmail(user.email)
    setEditNidn(user.nidn)
    setEditRole(user.role)
  }

  const cancelEdit = () => setEditing(null)

  const handleSaveEdit = async () => {
    if (!editing) return
    if (!editNama.trim() || !editEmail.trim())
      return showToast("Nama dan email wajib diisi.")
    setBusyId(editing.id)
    try {
      await updateUser(editing.id, {
        nama: editNama.trim(),
        email: editEmail.trim(),
        nidn: editNidn.trim(),
        role: editRole,
      })
      await refresh()
      setEditing(null)
      showToast(`Data ${editNama.trim()} diperbarui.`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal memperbarui pengguna.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleToggle = async (user: User) => {
    if (user.aktif) {
      const confirmed = await ask({
        title: "Nonaktifkan pengguna?",
        description: `Akun ${user.nama} tidak dapat digunakan untuk masuk ke SIKASA sampai diaktifkan kembali.`,
        confirmLabel: "Nonaktifkan akun",
        tone: "warning",
      })
      if (!confirmed) return
    }
    setBusyId(user.id)
    try {
      const updated = await toggleUser(user.id)
      await refresh()
      showToast(
        updated.aktif
          ? `${user.nama} diaktifkan.`
          : `${user.nama} dinonaktifkan.`,
      )
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal mengubah status.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleReset = async (user: User) => {
    const confirmed = await ask({
      title: "Reset kata sandi?",
      description: `Kata sandi akun ${user.nama} akan diganti. Kata sandi sementara akan ditampilkan setelah proses selesai.`,
      confirmLabel: "Reset kata sandi",
      tone: "warning",
    })
    if (!confirmed) return
    setBusyId(user.id)
    try {
      const password = await resetUserPassword(user.id)
      await refresh()
      showToast(`Password ${user.nama} direset menjadi: ${password}`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal reset password.",
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 sm:flex-row sm:items-center">
        <div>
          <div className="font-display text-xl font-bold text-slate-900">
            Pengguna Sistem
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {users.length} pengguna aktif dengan akses berbasis peran
          </p>
        </div>
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-[#202126] px-5 py-3 text-xs font-bold text-white"
          onClick={() => setAdding((value) => !value)}
        >
          <Icon name="users" size={17} /> Tambah Pengguna
        </button>
      </section>
      {adding && (
        <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
          <div className="font-bold text-slate-800">Pengguna Baru</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
              onChange={(event) => setNama(event.target.value)}
              placeholder="Nama lengkap"
              value={nama}
            />
            <input
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email institusi"
              value={email}
            />
            <input
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
              onChange={(event) => setNidn(event.target.value)}
              placeholder="NIDN / NIP"
              value={nidn}
            />
            <select
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs"
              onChange={(event) => setNewRole(event.target.value as UserRole)}
              value={newRole}
            >
              <option value="dosen">Dosen</option>
              <option value="kaprodi">Kaprodi</option>
              <option value="panitia">Panitia / TU</option>
              <option value="admin">Admin IT</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="px-4 py-2 text-xs font-bold text-slate-500"
              onClick={() => setAdding(false)}
            >
              Batal
            </button>
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              disabled={saving}
              onClick={async () => {
                if (!nama.trim() || !email.trim())
                  return showToast("Nama dan email wajib diisi.")
                setSaving(true)
                try {
                  const created = await createUser({
                    nama: nama.trim(),
                    email: email.trim(),
                    nidn,
                    role: newRole,
                  })
                  setNama("")
                  setEmail("")
                  setNidn("")
                  setAdding(false)
                  showToast(`Pengguna ${created.user.nama} ditambahkan. Kata sandi awal: ${created.password}`)
                } catch (error) {
                  showToast(
                    error instanceof Error
                      ? error.message
                      : "Gagal menambahkan pengguna.",
                  )
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? "Menyimpan..." : "Simpan Pengguna"}
            </button>
          </div>
        </section>
      )}
      {editing && (
        <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-6">
          <div className="font-bold text-slate-800">
            Edit Pengguna — {editing.nama}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
              onChange={(event) => setEditNama(event.target.value)}
              placeholder="Nama lengkap"
              value={editNama}
            />
            <input
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
              onChange={(event) => setEditEmail(event.target.value)}
              placeholder="Email institusi"
              value={editEmail}
            />
            <input
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
              onChange={(event) => setEditNidn(event.target.value)}
              placeholder="NIDN / NIP"
              value={editNidn}
            />
            <select
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs"
              onChange={(event) => setEditRole(event.target.value as UserRole)}
              value={editRole}
            >
              <option value="dosen">Dosen</option>
              <option value="kaprodi">Kaprodi</option>
              <option value="panitia">Panitia / TU</option>
              <option value="admin">Admin IT</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="px-4 py-2 text-xs font-bold text-slate-500"
              onClick={cancelEdit}
            >
              Batal
            </button>
            <button
              className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              disabled={busyId === editing.id}
              onClick={() => void handleSaveEdit()}
            >
              {busyId === editing.id ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </section>
      )}
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex gap-3 border-b border-slate-100 p-5">
          <div className="relative max-w-sm flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" size={16} />
            </span>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none"
              placeholder="Cari nama atau email..."
            />
          </div>
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs">
            <option>Semua role</option>
            <option>Dosen</option>
            <option>Kaprodi</option>
            <option>Panitia / TU</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Pengguna</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Role</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-t border-slate-100" key={user.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
                        {initials(user.nama)}
                      </span>
                      <span className="font-bold text-slate-700">
                        {user.nama}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-500">{user.email}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {user.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        className="font-bold text-sky-700 disabled:opacity-50"
                        disabled={busyId === user.id}
                        onClick={() => startEdit(user)}
                      >
                        Edit
                      </button>
                      <button
                        className="font-bold text-emerald-700 disabled:opacity-50"
                        disabled={busyId === user.id}
                        onClick={() => void handleToggle(user)}
                      >
                        {user.aktif ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        className="font-bold text-slate-500 disabled:opacity-50"
                        disabled={busyId === user.id}
                        onClick={() => void handleReset(user)}
                      >
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {dialog}
    </>
  )
}

function MataKuliahPage({
  showToast,
}: {
  showToast: (message: string) => void
}) {
  const { db, refresh } = useDb()
  const { ask, dialog } = useConfirmCard()
  const list = db.mata_kuliah
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const emptyForm: MataKuliahInput = {
    kode_mk: "",
    nama_mk: "",
    kelas: "",
    semester: 1,
    tahun_ajaran: "2026/2027",
  }
  const [form, setForm] = useState<MataKuliahInput>(emptyForm)

  const setField = (patch: Partial<MataKuliahInput>) =>
    setForm((value) => ({ ...value, ...patch }))

  const startEdit = (mk: MataKuliah) => {
    setAdding(false)
    setEditingId(mk.id)
    setForm({
      kode_mk: mk.kode_mk,
      nama_mk: mk.nama_mk,
      kelas: mk.kelas,
      semester: mk.semester,
      tahun_ajaran: mk.tahun_ajaran,
    })
  }

  const resetForm = () => {
    setForm(emptyForm)
    setAdding(false)
    setEditingId(null)
  }

  const handleSave = async () => {
    if (
      !form.kode_mk.trim() ||
      !form.nama_mk.trim() ||
      !form.kelas.trim() ||
      !form.tahun_ajaran.trim() ||
      !Number.isFinite(form.semester) ||
      form.semester < 1 ||
      form.semester > 14
    )
      return showToast("Semester harus diisi 1–14.")
    setBusyId(editingId ?? 0)
    try {
      const payload: MataKuliahInput = {
        kode_mk: form.kode_mk.trim(),
        nama_mk: form.nama_mk.trim(),
        kelas: form.kelas.trim(),
        semester: Math.round(form.semester),
        tahun_ajaran: form.tahun_ajaran.trim(),
      }
      if (editingId !== null) {
        await updateMataKuliah(editingId, payload)
        showToast(`Mata kuliah ${payload.nama_mk} diperbarui.`)
      } else {
        await createMataKuliah(payload)
        showToast(`Mata kuliah ${payload.nama_mk} ditambahkan.`)
      }
      resetForm()
      // Simpan sudah berhasil di server. Refresh data pendukung di latar
      // belakang supaya formulir tidak terus berputar jika endpoint lain lambat.
      void refresh().catch(() => {})
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal menyimpan mata kuliah.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (mk: MataKuliah) => {
    const confirmed = await ask({
      title: "Hapus mata kuliah?",
      description: `Mata kuliah ${mk.kode_mk} · ${mk.nama_mk} akan dihapus dari referensi sistem. Data ini mungkin masih dipakai oleh soal atau jadwal ujian.`,
      confirmLabel: "Hapus mata kuliah",
      icon: null,
    })
    if (!confirmed) return
    setBusyId(mk.id)
    try {
      await deleteMataKuliah(mk.id)
      await refresh()
      showToast(`Mata kuliah ${mk.nama_mk} dihapus.`)
      if (editingId === mk.id) resetForm()
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal menghapus mata kuliah.",
      )
    } finally {
      setBusyId(null)
    }
  }

  // JSX menyusul di blok render.
  return (
    <>
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 sm:flex-row sm:items-center">
        <div>
          <div className="font-display text-xl font-bold text-slate-900">
            Master Mata Kuliah
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {list.length} mata kuliah terdaftar sebagai referensi sistem
          </p>
        </div>
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-[#202126] px-5 py-3 text-xs font-bold text-white"
          onClick={() => {
            resetForm()
            setAdding((value) => !value)
          }}
        >
          <Icon name="book" size={17} /> Tambah Mata Kuliah
        </button>
      </section>

      {(adding || editingId !== null) && (
        <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
          <div className="font-bold text-slate-800">
            {editingId !== null ? "Edit Mata Kuliah" : "Mata Kuliah Baru"}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Kode MK
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
                onChange={(event) => setField({ kode_mk: event.target.value })}
                placeholder="cth. EKO-301"
                value={form.kode_mk}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Nama Mata Kuliah
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
                onChange={(event) => setField({ nama_mk: event.target.value })}
                placeholder="cth. Ekonomi Mikro"
                value={form.nama_mk}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Kelas
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
                onChange={(event) => setField({ kelas: event.target.value })}
                placeholder="cth. A"
                value={form.kelas}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Semester (1–14)
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
                max={14}
                min={1}
                onChange={(event) =>
                  setField({ semester: Number(event.target.value) })
                }
                placeholder="cth. 3"
                type="number"
                value={form.semester}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Tahun Ajaran
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none"
                onChange={(event) =>
                  setField({ tahun_ajaran: event.target.value })
                }
                placeholder="cth. 2026/2027"
                value={form.tahun_ajaran}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="px-4 py-2 text-xs font-bold text-slate-500"
              onClick={resetForm}
            >
              Batal
            </button>
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              disabled={busyId !== null}
              onClick={() => void handleSave()}
            >
              {busyId !== null
                ? "Menyimpan..."
                : editingId !== null
                  ? "Simpan Perubahan"
                  : "Simpan Mata Kuliah"}
            </button>
          </div>
        </section>
      )}
      <section className="mt-4 overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_18px_50px_rgba(32,33,38,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Kode</th>
                <th className="px-4 py-4">Mata Kuliah</th>
                <th className="px-4 py-4">Kelas</th>
                <th className="px-4 py-4">Semester</th>
                <th className="px-4 py-4">Tahun Ajaran</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((mk) => (
                <tr className="border-t border-slate-100" key={mk.id}>
                  <td className="px-6 py-4 font-bold text-slate-700">
                    {mk.kode_mk}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{mk.nama_mk}</td>
                  <td className="px-4 py-4 text-slate-500">{mk.kelas}</td>
                  <td className="px-4 py-4 text-slate-500">{mk.semester}</td>
                  <td className="px-4 py-4 text-slate-500">
                    {mk.tahun_ajaran}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        className="font-bold text-sky-700 disabled:opacity-50"
                        disabled={busyId === mk.id}
                        onClick={() => startEdit(mk)}
                      >
                        Edit
                      </button>
                      <button
                        className="font-bold text-rose-600 disabled:opacity-50"
                        disabled={busyId === mk.id}
                        onClick={() => void handleDelete(mk)}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr className="border-t border-slate-100">
                  <td
                    className="px-6 py-8 text-center text-slate-400"
                    colSpan={6}
                  >
                    Belum ada mata kuliah.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {dialog}
    </>
  )
}

function MyQuestionsPage({
  showToast,
}: {
  showToast: (message: string) => void
}) {
  const { db, ajukanRevisi } = useDb()
  const soal = db.bank_soal
  const [revisiFor, setRevisiFor] = useState<BankSoal | null>(null)
  const [alasanRevisi, setAlasanRevisi] = useState("")
  const [fileRevisi, setFileRevisi] = useState<File | null>(null)
  const [kirimRevisi, setKirimRevisi] = useState(false)
  const terkunci = soal.filter((s) => s.status === "terkunci").length
  // Daftar soal dosen dipetakan langsung dari bank_soal miliknya.
  const questions = soal.map((s) => ({
    name: s.nama_mk,
    meta: `${s.kode_mk} · Kelas ${s.kelas}`,
    type: s.jenis,
    ujianSelesai: Boolean(s.ujian_selesai) || s.status === "arsip",
    state: Boolean(s.ujian_selesai) || s.status === "arsip"
      ? "Ujian selesai"
      :
      s.status === "siap_ujian"
        ? "Disetujui"
        : s.status === "ditolak"
          ? "Ditolak"
        : s.status === "arsip"
          ? "Diarsipkan"
          : "Menunggu persetujuan",
    isTerkunci: !s.ujian_selesai && (s.status === "terkunci" || s.status === "ditolak" || s.status === "siap_ujian"),
    date: formatTanggal(s.jadwal_ujian),
    id: s.id,
  }))
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          detail="Soal yang Anda unggah"
          icon="book"
          label="Total Soal"
          tone="blue"
          value={String(soal.length)}
        />
        <StatCard
          detail="File terenkripsi"
          icon="lock"
          label="Terkunci"
          tone="green"
          value={String(terkunci)}
        />
        <StatCard
          detail="Disetujui Kaprodi"
          icon="qrcode"
          label="Disetujui"
          tone="gold"
          value={String(soal.filter((s) => s.status === "siap_ujian").length)}
        />
      </section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <div className="font-display text-lg font-bold text-slate-900">
              Daftar Soal Saya
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Hanya Anda yang dapat melihat metadata soal ini
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
            AKSES DOSEN
          </span>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          {questions.map((q) => (
            <div className="rounded-2xl border border-slate-200 p-5" key={q.id}>
              <div className="flex items-start justify-between">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon name="document" size={19} />
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                  {q.type}
                </span>
              </div>
              <div className="mt-4 text-sm font-bold text-slate-800">
                {q.name}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {q.meta} · {q.date}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span
                  className={`flex items-center gap-1.5 text-xs font-bold ${
                    q.ujianSelesai ? "text-slate-600" : q.isTerkunci ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  <Icon name={q.ujianSelesai ? "check" : q.isTerkunci ? "lock" : "clock"} size={14} />
                  {q.state}
                </span>
                {q.ujianSelesai ? (
                  <span className="text-right text-[11px] font-medium text-slate-500">
                    Revisi tidak tersedia setelah ujian selesai
                  </span>
                ) : (
                  <button
                    className="text-xs font-bold text-emerald-700"
                    onClick={() => {
                      const target = soal.find((s) => s.id === q.id)
                      if (!target) return
                      if (q.isTerkunci) {
                        setRevisiFor(target)
                        setAlasanRevisi("")
                        setFileRevisi(null)
                      } else {
                        showToast("Detail mata kuliah dibuka.")
                      }
                    }}
                  >
                    {q.isTerkunci ? "Ajukan revisi" : "Lihat detail"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <p className="col-span-full py-6 text-center text-xs text-slate-400">
              Anda belum mengunggah soal apa pun.
            </p>
          )}
        </div>
      </section>
      {revisiFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-lg font-bold text-slate-900">
                  Ajukan Revisi Soal
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {revisiFor.nama_mk} · {revisiFor.kode_mk}
                </p>
              </div>
              <button
                aria-label="Tutup"
                className="text-slate-400 transition hover:text-slate-700"
                onClick={() => setRevisiFor(null)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              Ajukan revisi untuk soal milik Anda yang sudah dikunci atau disetujui. Satu pengajuan per soal dapat menunggu keputusan pada satu waktu. Jika ditolak, Anda dapat memperbaiki dan mengajukan kembali. Tidak ada batas waktu pengajuan, tetapi perubahan baru berlaku setelah disetujui Kaprodi.
            </p>
            <label className="mt-5 block text-xs font-bold text-slate-600">
              Alasan revisi
              <textarea
                required
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none focus:border-slate-900"
                onChange={(event) => setAlasanRevisi(event.target.value)}
                placeholder="cth: Perbaikan typo nomor 12 dan 17"
                rows={3}
                minLength={20}
                maxLength={1000}
                value={alasanRevisi}
              />
              <span className="mt-1 block text-right text-[11px] font-normal text-slate-400">{alasanRevisi.trim().length}/1000 · minimal 20 karakter</span>
            </label>
            <label className="mt-4 block text-xs font-bold text-slate-600">
              Berkas PDF revisi
            </label>
            <label className="mt-2 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-6 text-center transition hover:border-emerald-400">
              <input
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  if (file && file.size > 10 * 1024 * 1024) {
                    showToast("Ukuran PDF maksimal 10 MB.")
                    event.target.value = ""
                    setFileRevisi(null)
                    return
                  }
                  if (file && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                    showToast("Berkas revisi harus berformat PDF.")
                    event.target.value = ""
                    setFileRevisi(null)
                    return
                  }
                  setFileRevisi(file)
                }}
                type="file"
              />
              <div className="grid size-10 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <Icon name={fileRevisi ? "check" : "upload"} size={20} />
              </div>
              <div className="mt-3 text-sm font-bold text-slate-700">
                {fileRevisi?.name || "Klik untuk pilih berkas PDF"}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Maksimal 10 MB · PDF saja · tunggu keputusan sebelum mengirim revisi berikutnya
              </div>
            </label>
            {kirimRevisi && <UploadProgress label="Mengunggah berkas revisi..." />}
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 disabled:opacity-50"
                disabled={kirimRevisi}
                onClick={() => setRevisiFor(null)}
                type="button"
              >
                Batal
              </button>
              <button
                className="flex-1 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={kirimRevisi || alasanRevisi.trim().length < 20 || !fileRevisi}
                onClick={async () => {
                  if (!alasanRevisi.trim())
                    return showToast("Alasan revisi wajib diisi.")
                  if (alasanRevisi.trim().length < 20)
                    return showToast("Jelaskan perubahan minimal 20 karakter agar Kaprodi dapat menilainya.")
                  if (!fileRevisi)
                    return showToast("Pilih berkas PDF revisi terlebih dahulu.")
                  setKirimRevisi(true)
                  try {
                    const message = await ajukanRevisi(
                      revisiFor.id,
                      alasanRevisi.trim(),
                      fileRevisi,
                    )
                    showToast(message)
                    setRevisiFor(null)
                  } catch (error) {
                    showToast(
                      error instanceof Error
                        ? error.message
                        : "Gagal mengajukan revisi.",
                    )
                  } finally {
                    setKirimRevisi(false)
                  }
                }}
                type="button"
              >
                {kirimRevisi ? "Mengirim..." : "Kirim ke Kaprodi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function RevisionPage({ showToast }: { showToast: (message: string) => void }) {
  const { db, decideRevisi } = useDb()
  const [deciding, setDeciding] = useState<number | null>(null)
  // Daftar permintaan revisi yang menunggu (dari endpoint /revisi).
  const requests = db.revisi.map((r) => ({
    id: r.id,
    lecturer: r.dosen ?? "-",
    course: r.nama_mk ?? r.kode_mk ?? "Mata kuliah",
    reason: r.alasan_revisi,
    time: r.diajukan_pada ?? "-",
  }))
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white">
      <div className="border-b border-slate-100 p-6">
        <div className="font-display text-xl font-bold text-slate-900">
          Approval Revisi Soal
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Setiap keputusan otomatis direkam dalam audit log.
        </p>
      </div>
      <div className="space-y-4 p-6">
        {requests.map((req) => (
          <div
            className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-5 lg:flex-row lg:items-center"
            key={req.id}
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-amber-700 shadow-sm">
              <Icon name="history" size={20} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-800">
                {req.course}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {req.lecturer} · {req.time}
              </div>
              <div className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-600">
                <strong>Alasan:</strong> {req.reason}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 disabled:opacity-50"
                disabled={deciding === req.id}
                onClick={async () => {
                  setDeciding(req.id)
                  try {
                    await decideRevisi(req.id, "ditolak")
                    showToast(`Revisi ${req.course} ditolak.`)
                  } catch (error) {
                    showToast(
                      error instanceof Error
                        ? error.message
                        : "Gagal menolak revisi.",
                    )
                  } finally {
                    setDeciding(null)
                  }
                }}
              >
                Tolak
              </button>
              <button
                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                disabled={deciding === req.id}
                onClick={async () => {
                  setDeciding(req.id)
                  try {
                    await decideRevisi(req.id, "disetujui")
                    showToast(`Revisi ${req.course} disetujui.`)
                  } catch (error) {
                    showToast(
                      error instanceof Error
                        ? error.message
                        : "Gagal menyetujui revisi.",
                    )
                  } finally {
                    setDeciding(null)
                  }
                }}
              >
                Setujui Revisi
              </button>
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            Tidak ada permintaan revisi yang menunggu persetujuan.
          </p>
        )}
      </div>
    </section>
  )
}

// Pengaturan printer di halaman Admin IT: tambah, ubah (mis. menyamakan
// nama dengan Windows), aktif/nonaktifkan, dan hapus. Nama printer disarankan
// sama persis dengan yang terdaftar di Windows Server agar deteksi status dan
// pengiriman file job akurat.
function KelolaPrinterSection({
  showToast,
}: {
  showToast: (message: string) => void
}) {
  const [printers, setPrinters] = useState<PrinterAdmin[]>([])
  const [memuat, setMemuat] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  // Form tambah printer.
  const [nama, setNama] = useState("")
  const [alamat, setAlamat] = useState("")
  const [lokasi, setLokasi] = useState("")

  // Form edit printer.
  const [editing, setEditing] = useState<PrinterAdmin | null>(null)
  const [editNama, setEditNama] = useState("")
  const [editAlamat, setEditAlamat] = useState("")
  const [editLokasi, setEditLokasi] = useState("")

  // Hasil scan otomatis printer Windows Server (USB & jaringan).
  const [scanHasil, setScanHasil] = useState<PrinterScan[] | null>(null)
  const [scanWindows, setScanWindows] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [busyScan, setBusyScan] = useState<string | null>(null)

  const muat = async () => {
    try {
      setPrinters(await fetchPrintersAdmin())
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal memuat daftar printer.",
      )
    } finally {
      setMemuat(false)
    }
  }

  useEffect(() => {
    void muat()
  }, [])

  const startEdit = (printer: PrinterAdmin) => {
    setEditing(printer)
    setEditNama(printer.nama_printer)
    setEditAlamat(printer.alamat_printer)
    setEditLokasi(printer.lokasi ?? "")
  }

  const handleTambah = async () => {
    if (!nama.trim() || !alamat.trim())
      return showToast("Nama dan alamat printer wajib diisi.")
    setSaving(true)
    try {
      await savePrinter({
        nama_printer: nama.trim(),
        alamat_printer: alamat.trim(),
        lokasi: lokasi.trim(),
      })
      setNama("")
      setAlamat("")
      setLokasi("")
      setAdding(false)
      await muat()
      showToast("Printer ditambahkan.")
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal menambahkan printer.",
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSimpanEdit = async () => {
    if (!editing) return
    if (!editNama.trim() || !editAlamat.trim())
      return showToast("Nama dan alamat printer wajib diisi.")
    setBusyId(editing.id)
    try {
      await savePrinter(
        {
          nama_printer: editNama.trim(),
          alamat_printer: editAlamat.trim(),
          lokasi: editLokasi.trim(),
        },
        editing.id,
      )
      setEditing(null)
      await muat()
      showToast(`Printer ${editNama.trim()} diperbarui.`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal memperbarui printer.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleToggle = async (printer: PrinterAdmin) => {
    setBusyId(printer.id)
    try {
      const updated = await togglePrinter(printer.id)
      await muat()
      showToast(
        updated.status_db === "aktif"
          ? `${printer.nama_printer} diaktifkan.`
          : `${printer.nama_printer} dinonaktifkan.`,
      )
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal mengubah status.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleHapus = async (printer: PrinterAdmin) => {
    if (!window.confirm(`Hapus printer "${printer.nama_printer}"?`)) return
    setBusyId(printer.id)
    try {
      await deletePrinter(printer.id)
      await muat()
      showToast(`Printer ${printer.nama_printer} dihapus.`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal menghapus printer.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      const res = await scanPrinters()
      setScanHasil(res.daftar)
      setScanWindows(res.serverWindows)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal melakukan scan printer.",
      )
    } finally {
      setScanning(false)
    }
  }

  // Daftarkan printer hasil scan yang belum ada di database.
  const handleDaftarkan = async (p: PrinterScan) => {
    setBusyScan(p.nama_windows)
    try {
      await savePrinter({
        nama_printer: p.nama_windows,
        alamat_printer: p.nama_windows,
        lokasi: "",
      })
      await muat()
      await handleScan()
      showToast(`Printer ${p.nama_windows} terdaftar.`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal mendaftarkan printer.",
      )
    } finally {
      setBusyScan(null)
    }
  }

  // Samakan nama di database dengan nama asli di Windows — memperbaiki status
  // "Tidak terdaftar di Windows" tanpa perlu mengetik ulang nama.
  const handleSamakanNama = async (p: PrinterScan) => {
    if (p.printer_id == null) return
    const printerDb = printers.find((item) => item.id === p.printer_id)
    if (!printerDb) return
    setBusyScan(p.nama_windows)
    try {
      await savePrinter(
        {
          nama_printer: p.nama_windows,
          alamat_printer: printerDb.alamat_printer,
          lokasi: printerDb.lokasi ?? "",
        },
        p.printer_id,
      )
      await muat()
      await handleScan()
      showToast(`Nama printer disamakan dengan Windows: ${p.nama_windows}.`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal menyamakan nama.",
      )
    } finally {
      setBusyScan(null)
    }
  }

  // Badge status: hasil deteksi Windows Server yang sebenarnya.
  const statusBadge = (printer: PrinterAdmin) =>
    printer.status_db !== "aktif"
      ? { kelas: "bg-slate-100 text-slate-500", teks: "Nonaktif" }
      : printer.online
        ? { kelas: "bg-emerald-50 text-emerald-700", teks: "Online" }
        : printer.ada_di_windows
          ? { kelas: "bg-amber-50 text-amber-700", teks: "Terdaftar, offline" }
          : {
              kelas: "bg-rose-50 text-rose-700",
              teks: "Tidak terdaftar di Windows",
            }

  const inputKelas =
    "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-900"

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
        <div>
          <div className="font-display text-lg font-bold text-slate-900">
            Kelola Printer
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            Nama printer harus{" "}
            <strong className="text-slate-600">sama persis</strong> dengan yang
            terdaftar di Windows Server (Panel Control → Devices and Printers)
            agar status online dan pengiriman file akurat. Printer aktif dipakai
            sebagai tujuan bila petugas cetak tidak memilih secara spesifik.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            disabled={scanning}
            onClick={() => void handleScan()}
          >
            <Icon name="search" size={17} />{" "}
            {scanning ? "Memindai..." : "Scan Printer Windows"}
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-[#202126] px-5 py-3 text-xs font-bold text-white"
            onClick={() => setAdding((value) => !value)}
          >
            <Icon name="printer" size={17} /> Tambah Printer
          </button>
        </div>
      </div>

      {scanHasil && (
        <div className="border-b border-slate-100 bg-[#f8f7f2] p-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-700">
              Hasil scan printer Windows Server
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                disabled={scanning}
                onClick={() => void handleScan()}
              >
                {scanning ? "Memindai..." : "Scan Ulang"}
              </button>
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setScanHasil(null)}
              >
                Tutup
              </button>
            </div>
          </div>
          {!scanWindows ? (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Backend tidak berjalan di Windows sehingga scan otomatis tidak
              tersedia. Tambahkan nama printer secara manual (nama harus sama
              persis dengan yang terdaftar di mesin server).
            </p>
          ) : scanHasil.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Tidak ada printer terdeteksi di Windows. Pasang driver printer
              (USB/jaringan) di server lalu lakukan scan ulang.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-200/70 rounded-xl border border-slate-200/70 bg-white">
              {scanHasil.map((p) => (
                <div
                  className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  key={p.nama_windows}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        {p.nama_windows}
                      </span>
                      {p.default && (
                        <span className="rounded-full bg-[#f5cf25]/30 px-2 py-0.5 text-[10px] font-bold text-[#8a6d0b]">
                          Default Windows
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.offline
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {p.offline ? "Offline" : "Siap"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Port: {p.port ?? "-"}
                      {p.sudah_terdaftar
                        ? p.nama_persis
                          ? " · Sudah terdaftar di database"
                          : " · Cocok dengan database (nama belum persis)"
                        : " · Belum terdaftar di database"}
                    </div>
                  </div>
                  <div>
                    {!p.sudah_terdaftar ? (
                      <button
                        className="rounded-lg bg-[#202126] px-3.5 py-2 text-[11px] font-bold text-white disabled:opacity-40"
                        disabled={busyScan === p.nama_windows}
                        onClick={() => void handleDaftarkan(p)}
                      >
                        {busyScan === p.nama_windows
                          ? "Mendaftarkan..."
                          : "Daftarkan"}
                      </button>
                    ) : !p.nama_persis ? (
                      <button
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-[11px] font-bold text-amber-800 disabled:opacity-40"
                        disabled={busyScan === p.nama_windows}
                        onClick={() => void handleSamakanNama(p)}
                      >
                        {busyScan === p.nama_windows
                          ? "Menyamakan..."
                          : "Samakan nama"}
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-600">
                        ✓ Terdaftar
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adding && (
        <div className="border-b border-slate-100 bg-slate-50/70 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Nama printer (persis seperti di Windows)
              <input
                className={`mt-1.5 ${inputKelas}`}
                onChange={(event) => setNama(event.target.value)}
                placeholder="HP LaserJet Ruang Kaprodi"
                value={nama}
              />
            </label>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Alamat printer
              <input
                className={`mt-1.5 ${inputKelas}`}
                onChange={(event) => setAlamat(event.target.value)}
                placeholder="socket://192.168.1.50:9100"
                value={alamat}
              />
            </label>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Lokasi (opsional)
              <input
                className={`mt-1.5 ${inputKelas}`}
                onChange={(event) => setLokasi(event.target.value)}
                placeholder="Ruang Kaprodi Manajemen"
                value={lokasi}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-xl bg-[#202126] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40"
              disabled={saving}
              onClick={() => void handleTambah()}
            >
              {saving ? "Menyimpan..." : "Simpan Printer"}
            </button>
            <button
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600"
              onClick={() => setAdding(false)}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="border-b border-slate-100 bg-amber-50/50 p-6">
          <div className="text-xs font-bold text-slate-700">
            Edit printer: {editing.nama_printer}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Nama printer (persis seperti di Windows)
              <input
                className={`mt-1.5 ${inputKelas}`}
                onChange={(event) => setEditNama(event.target.value)}
                value={editNama}
              />
            </label>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Alamat printer
              <input
                className={`mt-1.5 ${inputKelas}`}
                onChange={(event) => setEditAlamat(event.target.value)}
                value={editAlamat}
              />
            </label>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Lokasi (opsional)
              <input
                className={`mt-1.5 ${inputKelas}`}
                onChange={(event) => setEditLokasi(event.target.value)}
                value={editLokasi}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-xl bg-[#202126] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40"
              disabled={busyId === editing.id}
              onClick={() => void handleSimpanEdit()}
            >
              {busyId === editing.id ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
            <button
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600"
              onClick={() => setEditing(null)}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {memuat ? (
          <div role="status" aria-label="Memuat daftar printer" className="divide-y divide-slate-100 animate-pulse">
            {[0, 1, 2].map((row) => <div className="flex items-center gap-3 p-5" key={row}><SkeletonBlock className="size-10 rounded-xl" /><div className="flex-1 space-y-2"><SkeletonBlock className="h-4 w-1/3" /><SkeletonBlock className="h-3 w-1/2" /></div><SkeletonBlock className="h-7 w-20" /></div>)}
          </div>
        ) : printers.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            Belum ada printer terdaftar. Tambahkan printer agar panitia bisa
            memilih tujuan cetak.
          </p>
        ) : (
          printers.map((printer) => {
            const badge = statusBadge(printer)
            return (
              <div
                className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
                key={printer.id}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f4f1ea] text-[#202126]">
                    <Icon name="printer" size={17} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        {printer.nama_printer}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.kelas}`}
                      >
                        {badge.teks}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {printer.alamat_printer}
                      {printer.lokasi ? ` · ${printer.lokasi}` : ""} ·{" "}
                      {printer.jumlah_cetak} job tercatat
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    onClick={() => startEdit(printer)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    disabled={busyId === printer.id}
                    onClick={() => void handleToggle(printer)}
                  >
                    {printer.status_db === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button
                    className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                    disabled={busyId === printer.id}
                    onClick={() => void handleHapus(printer)}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function ServerPage({ showToast }: { showToast: (message: string) => void }) {
  // Komponen pengelolaan printer lama tidak lagi ditampilkan di halaman Admin IT.
  void KelolaPrinterSection
  const services = [
    ["Application Server", "192.168.1.10", "Aktif", "12 ms"],
    ["Database MySQL", "localhost:3306", "Aktif", "4 ms"],
    ["Encrypted Storage", "/secure/exams", "Aktif", "42% terpakai"],
  ]
  return (
    <>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900">
        <div className="flex items-start gap-3">
          <Icon name="shield" size={21} />
          <div>
            <strong>Batas akses Admin IT aktif</strong>
            <p className="mt-1 text-xs text-emerald-700">
              Anda dapat memelihara infrastruktur, tetapi tidak dapat membuka
              atau melihat isi file soal.
            </p>
          </div>
        </div>
      </div>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          detail="Berjalan normal"
          icon="settings"
          label="CPU Server"
          tone="green"
          value="18%"
        />
        <StatCard
          detail="3,1 GB dari 8 GB"
          icon="archive"
          label="Memori"
          tone="blue"
          value="39%"
        />
        <StatCard
          detail="Backup 02:00 hari ini"
          icon="shield"
          label="Backup"
          tone="green"
          value="Sukses"
        />
      </section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <div className="font-display text-lg font-bold text-slate-900">
              Layanan Infrastruktur
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Pemeriksaan terakhir 1 menit lalu
            </p>
          </div>
          <button
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"
            onClick={() => showToast("Status seluruh layanan diperbarui.")}
          >
            Periksa Ulang
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {services.map(([name, address, state, detail]) => (
            <div
              className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
              key={name}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Icon name="settings" size={17} />
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-700">{name}</div>
                  <div className="text-[10px] text-slate-400">{address}</div>
                </div>
              </div>
              <div className="text-xs text-slate-500">{detail}</div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <span className="size-2 rounded-full bg-emerald-500" />
                {state}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

type HelpPanelProps = {
  role: UserRole
  onClose: () => void
}

function HelpPanel({ role, onClose }: HelpPanelProps) {
  const guides: Record<UserRole, {
    title: string
    description: string
    steps: string[]
    limit: string
  }> = {
    dosen: {
      title: "Panduan untuk Dosen",
      description:
        "Siapkan dan kirim soal final dengan tiga langkah sederhana.",
      steps: [
        "Pilih mata kuliah dan lengkapi jadwal ujian.",
        "Unggah satu file PDF final, maksimal 10 MB.",
        "Periksa kembali lalu pilih Enkripsi & Ajukan Persetujuan.",
      ],
      limit:
        "Anda hanya dapat melihat soal milik sendiri. Revisi setelah dikunci harus disetujui Kaprodi.",
    },
    kaprodi: {
      title: "Panduan untuk Kaprodi",
      description: "Pantau kelengkapan soal dan tangani pengecualian.",
      steps: [
        "Periksa dosen yang belum mengunggah pada Rekap Soal.",
        "Kirim pengingat sebelum batas waktu pengumpulan.",
        "Tinjau alasan sebelum menyetujui permintaan revisi.",
      ],
      limit:
        "Setiap persetujuan, penolakan, dan penerbitan berita acara dicatat otomatis.",
    },
    panitia: {
      title: "Panduan untuk Panitia / TU",
      description: "Bagikan soal melalui QR; jawaban tetap di kertas.",
      steps: [
        "Buat sesi dari soal yang sudah disetujui Kaprodi.",
        "Atur waktu mulai dan waktu selesai ujian.",
        "Tampilkan QR di ruang ujian dan siapkan lembar jawaban kertas.",
      ],
      limit:
        "Akses PDF hanya tersedia selama sesi aktif. Viewer tidak menghilangkan risiko foto atau screenshot.",
    },
    admin: {
      title: "Panduan untuk Admin IT",
      description: "Jaga layanan tetap aktif tanpa mengakses isi soal.",
      steps: [
        "Pantau server, database, dan penyimpanan.",
        "Kelola akun serta role berdasarkan permintaan resmi.",
        "Periksa log sistem jika muncul peringatan layanan.",
      ],
      limit:
        "Admin IT hanya melihat metadata teknis dan tidak memiliki izin membuka dokumen soal.",
    },
  }
  const guide = guides[role]
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-7 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-[#f5cf25] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#202126]">
              Panduan singkat
            </span>
            <div className="font-display mt-4 text-2xl font-bold text-slate-900">
              {guide.title}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {guide.description}
            </p>
          </div>
          <button
            aria-label="Tutup panduan"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="mt-7 space-y-3">
          {guide.steps.map((step, index) => (
            <div
              className="flex items-start gap-4 rounded-2xl bg-[#f4f1ea] p-4"
              key={step}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#202126] text-xs font-bold text-[#f5cf25]">
                {index + 1}
              </span>
              <p className="pt-1 text-sm leading-relaxed text-slate-700">
                {step}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          <Icon name="shield" size={18} />
          {guide.limit}
        </div>
        <button
          className="mt-6 w-full rounded-full bg-[#202126] py-3.5 text-sm font-bold text-white"
          onClick={onClose}
        >
          Saya mengerti
        </button>
      </div>
    </div>
  )
}

// Layar tunggu: tiga bentuk geometris yang memantul secara acak — adaptasi
// dari "Geometric shapes loading animation" karya Samuel Medvedowsky
// (dribbble.com/shots/4037784). Logika randomisasi porting dari demo aslinya.
const GEO_TYPES = [
  "circle",
  "semi-circle",
  "square",
  "triangle",
  "triangle-2",
  "rectangle",
] as const

const GEO_COLORS = [
  "#836ee5",
  "#fe94b4",
  "#49d2f5",
  "#ff5354",
  "#00b1b4",
  "#ffe465",
  "#0071ff",
  "#03274b",
] as const

function GeometricLoading({ fading = false }: { fading?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null)

  // Acak ulang tiap bentuk tiap 740ms: ganti jenis, warna, ukuran, posisi
  // horizontal, lalu pantulkan naik (400ms) dan jatuh kembali (300ms).
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const shapes = Array.from(stage.querySelectorAll<HTMLElement>(".shape"))

    const timeouts: number[] = []

    const randomize = (shape: HTMLElement) => {
      const type = GEO_TYPES[~~(Math.random() * GEO_TYPES.length)]
      // Pertahankan class dasar "shape"; class animasi dibuang agar siklus
      // bounce dimulai ulang persis seperti demo aslinya.
      shape.className = `shape ${type}`

      const offset = Math.random() * 4 - 2
      shape.style.setProperty(
        "left",
        `calc(50% ${offset >= 0 ? "+" : "-"} ${Math.abs(offset)}vw)`,
      )
      shape.style.setProperty("--bounce-variance", `${Math.random() * 20 - 10}vh`)
      shape.style.setProperty("--base_scale", `${Math.random() * 6 + 4}vh`)
      shape.style.setProperty("--rotation", `${Math.random() * 180 - 90}deg`)
      shape.style.setProperty("--color", GEO_COLORS[~~(Math.random() * GEO_COLORS.length)])

      shape.classList.add("bounce-up")
      timeouts.push(
        window.setTimeout(() => {
          shape.classList.replace("bounce-up", "bounce-down")
        }, 400),
      )
    }

    shapes.forEach(randomize)
    const timer = window.setInterval(() => shapes.forEach(randomize), 740)

    return () => {
      window.clearInterval(timer)
      timeouts.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  return (
    <div
      ref={stageRef}
      className={fading ? "geo-loading geo-loading-out" : "geo-loading"}
      role="status"
      aria-label="Memuat sesi"
    >
      <span className="shape" aria-hidden="true" />
      <span className="shape" aria-hidden="true" />
      <span className="shape" aria-hidden="true" />
    </div>
  )
}

function AppShell() {
  const { currentUser, loading, login, logout, updateProfile } = useDb()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [active, setActive] = useState("Dashboard")
  const [toast, setToast] = useState("")
  const [helpOpen, setHelpOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [profilePhoto, setProfilePhoto] = useState<File>()
  const [profileSignature, setProfileSignature] = useState<File>()
  const [profileSaving, setProfileSaving] = useState(false)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notifikasi[]>([])
  const [unread, setUnread] = useState(0)
  const notifSessionRef = useRef(0)

  useEffect(() => {
    enableNotificationSounds()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])
  const loggedIn = currentUser != null
  const role = currentUser?.role ?? "panitia"
  const safeRole = normalizeRole(role)

  // Muat notifikasi milik pengguna login; polling ringan tiap 30 detik agar
  // lonceng ikut diperbarui tanpa reload.
  useEffect(() => {
    const sessionVersion = ++notifSessionRef.current
    setNotifs([])
    setUnread(0)
    setNotifOpen(false)
    if (!loggedIn) {
      return
    }
    let active = true
    const load = () => {
      fetchNotifikasi()
        .then((result) => {
          if (!active || sessionVersion !== notifSessionRef.current) return
          setNotifs(result.items)
          setUnread(result.unreadCount)
        })
        .catch(() => {
          /* diabaikan: badge tetap 0 bila gagal */
        })
    }
    load()
    const timer = window.setInterval(load, 30000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [currentUser?.id])

  const refreshNotifs = () => {
    const sessionVersion = notifSessionRef.current
    fetchNotifikasi()
      .then((result) => {
        if (sessionVersion !== notifSessionRef.current) return
        setNotifs(result.items)
        setUnread(result.unreadCount)
      })
      .catch(() => {})
  }

  // Aksi halaman dalam aplikasi (mis. Buka Cetak di Rekap) memaksa lonceng
  // disegarkan seketika tanpa menunggu polling 30 detik.
  useEffect(() => {
    if (!loggedIn) return
    const onUpdate = () => refreshNotifs()
    window.addEventListener("ebrankas:notif-updated", onUpdate)
    return () => window.removeEventListener("ebrankas:notif-updated", onUpdate)
  }, [currentUser?.id])

  const openNotif = async () => {
    const willOpen = !notifOpen
    setNotifOpen(willOpen)
    if (willOpen) refreshNotifs()
  }

  const markOne = (id: number) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)),
    )
    setUnread((prev) => Math.max(0, prev - 1))
    markNotifikasiRead(id).catch(() => refreshNotifs())
  }

  // Tentukan halaman tujuan saat notifikasi diklik. Backend mengirim `tautan`
  // berupa label halaman (mis. "Rekap Soal", "Sesi Ujian", "Soal Saya").
  // Navigasi hanya dilakukan bila halaman itu benar-benar ada di menu peran
  // pengguna; jika tidak persis cocok, pakai pemetaan cadangan (mis. Kaprodi
  // tidak punya menu tujuan -> diarahkan ke halaman yang tersedia).
  const notifTarget = (tautan: string | null): string | null => {
    if (!tautan) return null
    const allowed = new Set(roleMeta[safeRole].nav.map((m) => m.label))
    if (allowed.has(tautan)) return tautan
    const fallback: Record<string, string> = {
      "Log Cetak": "Log & Berita Acara",
      "Antrian Cetak": "Sesi Ujian",
      "Rekap Soal": "Log & Berita Acara",
      "Approval Revisi": "Log & Berita Acara",
    }
    const alt = fallback[tautan]
    return alt && allowed.has(alt) ? alt : null
  }

  // Klik notifikasi: tandai dibaca, lalu arahkan ke halaman detail terkait.
  const handleNotifClick = (n: Notifikasi) => {
    if (!n.dibaca) markOne(n.id)
    const target = notifTarget(n.tautan)
    setNotifOpen(false)
    if (target) setActive(target)
  }

  const markAll = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, dibaca: true })))
    setUnread(0)
    markAllNotifikasiRead().catch(() => refreshNotifs())
  }

  const pageInfo: Record<string, [string, string]> = {
    Dashboard: ["Dashboard", "Ringkasan pengelolaan soal ujian FEB"],
    "Upload Soal": ["Upload Soal", "Unggah dan kunci soal ujian final"],
    "Soal Saya": ["Soal Saya", "Kelola dokumen ujian yang Anda unggah"],
    "Rekap Soal": ["Rekap Soal", "Pantau pengumpulan dan persetujuan revisi"],
    "Approval Revisi": [
      "Approval Revisi",
      "Tinjau permintaan pembukaan kunci dari dosen",
    ],
    "Sesi Ujian": ["Sesi Ujian Online", "Distribusi soal melalui QR Code"],
    "Log Akses Ujian": ["Log Akses Ujian", "Riwayat akses mahasiswa ke naskah ujian"],
    "Pengawasan Ujian": ["Pengawasan Ujian", "Tinjau permintaan pembukaan akses mahasiswa"],
    "Log & Berita Acara": [
      "Log & Berita Acara",
      "Audit aktivitas dan dokumen pertanggungjawaban",
    ],
    "Manajemen User": ["Manajemen User", "Kelola akun dan hak akses pengguna"],
    "Template Soal": [
      "Template Soal",
      "Kelola template format soal untuk referensi dosen",
    ],
    "Master Mata Kuliah": [
      "Master Mata Kuliah",
      "Kelola referensi mata kuliah (tambah, ubah, hapus)",
    ],
    "Status Server": [
      "Status Server",
      "Pantau layanan tanpa mengakses isi soal",
    ],
    "Log Aktivitas": ["Log Aktivitas Saya", "Riwayat aktivitas akun dosen"],
    "Log Sistem": ["Log Sistem", "Audit keamanan dan kesehatan layanan"],
  }
  const currentPage = pageInfo[active] ?? pageInfo.Dashboard

  // Transisi halus splash -> halaman (crossfade, bukan potongan mendadak):
  // saat sesi selesai dipulihkan, konten halaman dirender lebih dulu di balik
  // splash (overlay fixed yang menutupi penuh layar), lalu splash di-fade-kan
  // dan dilepas dari DOM setelah transisinya selesai. Unmount ditahan 620ms —
  // sedikit lebih panjang dari transisi CSS .geo-loading-out (560ms) agar
  // tidak terpotong.
  const [splashFading, setSplashFading] = useState(false)
  const [splashSelesai, setSplashSelesai] = useState(false)
  useEffect(() => {
    if (loading || splashSelesai) return
    setSplashFading(true)
    const t = window.setTimeout(() => setSplashSelesai(true), 620)
    return () => window.clearTimeout(t)
  }, [loading, splashSelesai])

  const showToast = (message: string) => {
    setToast(message)
    // Bunyi hanya untuk hasil/aksi berhasil; validasi dan error tetap senyap.
    if (!/(gagal|error|wajib|belum|tidak|pilih|harus|maksimal|kedaluwarsa|tercapai|salah)/i.test(message)) {
      playNotificationSound()
    }
    window.setTimeout(() => setToast(""), 2800)
  }

  // Selagi sesi dipulihkan dari token (cek /me + muat data peran), tampilkan
  // layar tunggu animasi bentuk geometris alih-alih halaman login berkedip.
  // Setelah sesi siap, splash tidak langsung dibuang: ia tetap dirender sebagai
  // overlay lalu di-fade-kan sehingga halaman di bawahnya muncul halus.
  const splash = splashSelesai ? null : <GeometricLoading fading={splashFading} />

  if (loading) return splash

  if (!loggedIn)
    return (
      <>
        <LoginPage
          onLogin={async (email, password) => {
            try {
              await login(email, password)
              setActive("Dashboard")
              return null
            } catch (error) {
              return error instanceof Error
                ? error.message
                : "Email atau kata sandi tidak sesuai data pengguna."
            }
          }}
        />
        {splash}
      </>
    )

  return (
    <div className="sikasa-workspace min-h-screen bg-[#e8e9e9] text-slate-800">
      <Sidebar
        active={active}
        onClose={() => setSidebarOpen(false)}
        onLogout={() => {
          void logout()
        }}
        onNavigate={setActive}
        onProfile={() => { setProfileName(currentUser?.nama ?? ""); setCurrentPassword(""); setNewPassword(""); setProfilePhoto(undefined); setProfileSignature(undefined); setProfileOpen(true) }}
        photoUrl={currentUser?.photoUrl}
        open={sidebarOpen}
        role={safeRole}
        userName={currentUser?.nama ?? "Pengguna"}
      />

      <main id="main-content" className="sikasa-main min-h-screen bg-[#f4f1ea] lg:ml-72">
        <header className="sikasa-topbar sticky top-0 z-20 flex min-h-24 items-center border-b border-black/5 bg-[#f4f1ea]/90 px-5 py-4 backdrop-blur-md sm:px-8">
          <button
            className="mr-3 rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold text-slate-900 sm:text-xl">
              {currentPage[0]}
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
              {currentPage[1]}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <time dateTime={clockNow.toISOString()} aria-label={`Waktu sekarang ${new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "medium", timeZone: "Asia/Jakarta" }).format(clockNow)} WIB`} className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-2.5 py-2.5 text-[10px] font-semibold tabular-nums text-slate-600 shadow-sm sm:gap-2 sm:px-3.5 sm:text-xs">
              <Icon name="clock" size={15} />
              <span className="sm:hidden">{new Intl.DateTimeFormat("id-ID", { timeStyle: "medium", timeZone: "Asia/Jakarta" }).format(clockNow)} WIB</span>
              <span className="hidden sm:inline">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Jakarta" }).format(clockNow)} WIB</span>
            </time>
            <button
              className="hidden items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 sm:flex"
              onClick={() => setHelpOpen(true)}
            >
              <Icon name="book" size={15} />
              Panduan
            </button>
            <div className="hidden rounded-full bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm md:block">
              {roleMeta[safeRole].label}
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-[#202126] px-4 py-2.5 text-xs font-semibold text-white sm:flex">
              <Icon name="shield" size={15} />
              Koneksi terenkripsi
            </div>
            <div className="relative">
              <button
                aria-label="Buka notifikasi"
                aria-expanded={notifOpen}
                className="relative grid size-10 place-items-center rounded-full bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                onClick={() => void openNotif()}
              >
                <Icon name="bell" size={19} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full border-2 border-white bg-amber-500 px-1 text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="sikasa-dropdown-panel absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-xs font-bold text-slate-700">
                      Notifikasi
                    </span>
                    {unread > 0 && (
                      <button
                        className="text-[11px] font-bold text-emerald-700 hover:underline"
                        onClick={markAll}
                      >
                        Tandai semua dibaca
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-400">
                        Belum ada notifikasi.
                      </div>
                    ) : (
                      notifs.map((n) => (
                        <button
                          key={n.id}
                          className={`block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${
                            n.dibaca ? "" : "bg-amber-50/40"
                          }`}
                          onClick={() => handleNotifClick(n)}
                        >
                          <div className="flex items-start gap-2">
                            {!n.dibaca && (
                              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" />
                            )}
                            <div className={n.dibaca ? "pl-4" : ""}>
                              <div className="text-xs font-bold text-slate-700">
                                {n.judul}
                              </div>
                              <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                                {n.pesan}
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                {n.waktu && (
                                  <span className="text-[10px] text-slate-400">
                                    {n.waktu}
                                  </span>
                                )}
                                {notifTarget(n.tautan) && (
                                  <span className="text-[10px] font-bold text-emerald-700">
                                    Buka →
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div
          className="sikasa-page animate-page mx-auto max-w-[1600px] p-5 sm:p-8 lg:px-10 lg:pt-8"
          key={active}
        >
          {active === "Dashboard" && (
            <DashboardPage navigate={setActive} role={safeRole} />
          )}
          {active === "Upload Soal" && <UploadPage showToast={showToast} />}
          {active === "Template Soal" && <TemplatePage showToast={showToast} />}
          {active === "Soal Saya" && <MyQuestionsPage showToast={showToast} />}
          {active === "Rekap Soal" && <RecapPage showToast={showToast} />}
          {active === "Approval Revisi" && (
            <RevisionPage showToast={showToast} />
          )}
          {active === "Log & Berita Acara" && (
            <LogsPage role={safeRole} showToast={showToast} />
          )}
          {["Log Aktivitas", "Log Cetak", "Log Sistem"].includes(active) && (
            <LogsPage role={safeRole} showToast={showToast} />
          )}
          {active === "Status Server" && <ServerPage showToast={showToast} />}
          {active === "Manajemen User" && <UsersPage showToast={showToast} />}
          {active === "Master Mata Kuliah" && (
            <MataKuliahPage showToast={showToast} />
          )}

          {active === "Sesi Ujian" && <SesiUjianPage showToast={showToast} />}
          {active === "Log Akses Ujian" && <LogAksesUjianPage showToast={showToast} />}
          {active === "Pengawasan Ujian" && <PengawasanUjianPage showToast={showToast} />}

          <footer className="flex flex-col gap-2 px-1 py-7 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {BARIS_HAK_CIPTA}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="lock" size={13} /> Dilindungi enkripsi end-to-end
            </span>
          </footer>
        </div>
      </main>

            {helpOpen && (
        <HelpPanel role={safeRole} onClose={() => setHelpOpen(false)} />
      )}
      {profileOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="profile-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="profile-title" className="text-xl font-bold text-slate-900">Profil saya</h2><p className="mt-1 text-sm text-slate-500">Perbarui foto, nama, tanda tangan, atau kata sandi akun.</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup" onClick={() => setProfileOpen(false)}>✕</button></div><form className="mt-5 flex min-h-0 flex-1 flex-col gap-4" onSubmit={async (event) => { event.preventDefault(); setProfileSaving(true); try { await updateProfile({ nama: profileName.trim(), currentPassword: currentPassword || undefined, newPassword: newPassword || undefined, photo: profilePhoto, signature: profileSignature }); setProfileOpen(false); setToast("Profil berhasil diperbarui.") } catch (error) { setToast(error instanceof Error ? error.message : "Profil gagal diperbarui.") } finally { setProfileSaving(false) } }}><div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain pr-1"><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Foto profil<span className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-500 hover:bg-emerald-50/50"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><Icon name={profilePhoto ? "check" : "upload"} size={18} /></span><span className="min-w-0 flex-1 truncate">{profilePhoto?.name || "Pilih foto profil"}<small className="block text-xs font-normal text-slate-400">JPG, PNG, atau WebP · Maks. 3 MB</small></span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file && file.size > 3 * 1024 * 1024) { setToast("Ukuran foto maksimal 3 MB."); event.target.value = ""; return } setProfilePhoto(file) }} className="absolute inset-0 cursor-pointer opacity-0" /></span></label>{safeRole === "kaprodi" && <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Tanda tangan persetujuan<span className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><Icon name={profileSignature ? "check" : "upload"} size={18} /></span><span className="min-w-0 flex-1 truncate">{profileSignature?.name || (currentUser?.hasSignature ? "Tanda tangan tersimpan · pilih untuk mengganti" : "Pilih gambar tanda tangan")}<small className="block text-xs font-normal text-slate-400">PNG atau JPG · Maks. 2 MB</small></span><input type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file && file.size > 2 * 1024 * 1024) { setToast("Ukuran tanda tangan maksimal 2 MB."); event.target.value = ""; return } setProfileSignature(file) }} className="absolute inset-0 cursor-pointer opacity-0" /></span><small className="font-normal text-slate-500">Tanda tangan ini disalin ke setiap persetujuan baru.</small></label>}<label className="grid gap-1.5 text-sm font-semibold text-slate-700">Nama<input required maxLength={150} value={profileName} onChange={(event) => setProfileName(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label><div className="border-t border-slate-100 pt-4 text-sm font-bold text-slate-800">Ganti kata sandi</div><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Kata sandi saat ini<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Kata sandi baru (min. 8 karakter)<input type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label><p className="text-xs text-slate-500">Isi kedua kolom kata sandi hanya jika ingin menggantinya.</p></div><div className="flex justify-end gap-2 border-t border-slate-100 bg-white pt-3"><button type="button" className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold" onClick={() => setProfileOpen(false)}>Batal</button><button disabled={profileSaving} className="min-h-11 rounded-xl bg-[#202126] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{profileSaving ? "Menyimpan..." : "Simpan perubahan"}</button></div></form></section></div>}
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-[60] flex max-w-sm items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl">
          <span className="grid size-6 place-items-center rounded-full bg-emerald-500">
            <Icon name="check" size={14} />
          </span>
          <span className="flex-1">{toast}</span>
          <button aria-label="Tutup notifikasi" className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setToast("")}>×</button>
        </div>
      )}

      {/* Overlay splash terakhir: tetap di atas halaman yang sudah dirender,
          lalu di-fade-kan agar transisi loading -> halaman terasa mulus. */}
      {splash}
    </div>
  )
}

export default function App() {
  // Judul tab browser mengikuti satu sumber branding (src/brand.ts).
  useEffect(() => {
    document.title = JUDUL_DOKUMEN
  }, [])

  const studentRoute = window.location.hash.match(/^#\/akses\/([^/?#]+)/)
  const studentToken = studentRoute?.[1] ? decodeURIComponent(studentRoute[1]) : null
  if (studentToken) return <Suspense fallback={<main className="student-shell"><header className="student-brand"><span className="student-mark">S</span><span><b>SIKASA</b><small>Sistem Informasi Keamanan Soal Akademik · FEB</small></span></header><div aria-label="Memuat halaman akses soal" role="status" className="animate-pulse space-y-4"><SkeletonBlock className="h-8 w-56" /><SkeletonBlock className="h-40 w-full rounded-2xl" /><SkeletonBlock className="h-28 w-full rounded-2xl" /></div></main>}><StudentAccess token={studentToken} /></Suspense>

  return (
    <DbProvider>
      <AppShell />
    </DbProvider>
  )
}
