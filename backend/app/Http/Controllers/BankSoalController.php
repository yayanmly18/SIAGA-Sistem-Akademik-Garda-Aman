<?php

namespace App\Http\Controllers;

use App\Models\BankSoal;
use App\Services\ActivityLogger;
use App\Services\ApprovalSignatureService;
use App\Services\FileProtectionService;
use App\Services\NotifikasiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class BankSoalController extends Controller
{
    public function __construct(
        private readonly FileProtectionService $files,
        private readonly ApprovalSignatureService $approvalSignatures,
    ) {}

    /**
     * Daftar soal untuk Dosen: hanya miliknya sendiri.
     */
    public function index(Request $request): JsonResponse
    {
        $soal = BankSoal::with(['mataKuliah'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (BankSoal $s) => $this->transform($s));

        return response()->json(['data' => $soal]);
    }

    /**
     * Rekap untuk Kaprodi: siapa sudah/belum upload per mata kuliah.
     */
    public function rekap(Request $request): JsonResponse
    {
        $rekap = DB::table('mata_kuliah')
            ->leftJoin('bank_soal', 'bank_soal.mk_id', '=', 'mata_kuliah.id')
            ->leftJoin('users', 'users.id', '=', 'bank_soal.user_id')
            ->select(
                'mata_kuliah.id as mk_id',
                'mata_kuliah.kode_mk',
                'mata_kuliah.nama_mk',
                'mata_kuliah.kelas',
                'users.nama as dosen',
                'bank_soal.id as bank_soal_id',
                'bank_soal.status',
                'bank_soal.jenis',
                'bank_soal.judul',
                'bank_soal.catatan_persetujuan',
                'bank_soal.jadwal_ujian',
            )
            ->orderBy('mata_kuliah.kode_mk')
            ->get()
            ->map(fn ($row) => [
                'mk_id' => $row->mk_id,
                'kode_mk' => $row->kode_mk,
                'nama_mk' => $row->nama_mk,
                'kelas' => $row->kelas,
                'dosen' => $row->dosen,
                'bank_soal_id' => $row->bank_soal_id,
                'status' => $row->bank_soal_id ? ($row->status ?? 'terkunci') : 'belum_upload',
                'jenis' => $row->jenis,
                'judul' => $row->judul,
                'catatan_persetujuan' => $row->catatan_persetujuan,
                'jadwal_ujian' => $row->jadwal_ujian,
            ]);

        return response()->json(['data' => $rekap]);
    }

    /**
     * Langkah 1 — Dosen upload PDF final + isi data, lalu klik KUNCI.
     * File otomatis di-rename acak & dienkripsi (FileProtectionService).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mk_id' => ['required', 'integer', 'exists:mata_kuliah,id'],
            'jenis' => ['required', Rule::in(['UTS', 'UAS'])],
            'judul' => ['required', 'string', 'max:200'],
            'jumlah_mahasiswa' => ['required', 'integer', 'min:1', 'max:500'],
            'jadwal_ujian' => ['required', 'date'],
            'durasi_menit' => ['nullable', 'integer', 'min:1', 'max:480'],
            'template_soal_id' => ['nullable', 'integer', 'exists:template_soal,id'],
            'signature_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'signature_x' => ['nullable', 'numeric', 'min:0', 'max:1000', 'required_with:signature_page'],
            'signature_y' => ['nullable', 'numeric', 'min:0', 'max:1000', 'required_with:signature_page'],
            'signature_width' => ['nullable', 'numeric', 'gt:0', 'max:500', 'required_with:signature_page'],
            'signature_height' => ['nullable', 'numeric', 'gt:0', 'max:100', 'required_with:signature_page'],
            'signature_name_y' => ['nullable', 'numeric', 'min:0', 'max:1000', 'required_with:signature_page'],
            'file' => ['required', 'file', 'mimetypes:application/pdf', 'max:10240'],
        ]);

        $fileStored = $this->files->storeEncrypted($request->file('file'));
        $waktuMulai = new \DateTime($data['jadwal_ujian']);

        $soal = BankSoal::create([
            'user_id' => $request->user()->id,
            'mk_id' => $data['mk_id'],
            'jenis' => $data['jenis'],
            'judul' => $data['judul'],
            // FileProtectionService mengembalikan associative array, bukan object.
            // Array access di sini penting: nullsafe property access akan menghasilkan
            // null dan melanggar kolom original_filename yang wajib diisi.
            'file_path' => $fileStored['file_path'],
            'original_filename' => $fileStored['original_filename'],
            'file_hash' => $fileStored['file_hash'],
            'template_soal_id' => $data['template_soal_id'] ?? null,
            'signature_page' => $data['signature_page'] ?? null,
            'signature_x' => $data['signature_x'] ?? null,
            'signature_y' => $data['signature_y'] ?? null,
            'signature_width' => $data['signature_width'] ?? null,
            'signature_height' => $data['signature_height'] ?? null,
            'signature_name_y' => $data['signature_name_y'] ?? null,
            'status' => 'terkunci',
            'jumlah_mahasiswa' => $data['jumlah_mahasiswa'],
            'jadwal_ujian' => $data['jadwal_ujian'],
            'durasi_menit' => $data['durasi_menit'] ?? 120,
            'waktu_mulai_ujian' => $waktuMulai,
            'dikunci_pada' => now(),
        ]);

        ActivityLogger::log('upload', [
            'nama_file' => $fileStored['original_filename'],
            'mk_id' => $data['mk_id'],
            'jenis' => $data['jenis'],
        ], $soal->id, $request->user());

        $mk = $soal->mataKuliah;
        NotifikasiService::keRoles(
            ['kaprodi'],
            'Soal baru diunggah',
            "{$request->user()->nama} mengunggah soal {$data['jenis']} untuk {$mk?->nama_mk}. Menunggu pembukaan ujian.",
            'sukses',
            'Rekap Soal',
        );

        return response()->json([
            'message' => 'Soal berhasil dienkripsi dan dikunci.',
            'data' => $this->transform($soal->load('mataKuliah')),
        ], 201);
    }

    /**
     * Kaprodi membuka jendela ujian online sebuah soal (terkunci -> siap_ujian).
     */
    public function bukaCetak(Request $request, int $id): JsonResponse
    {
        $soal = BankSoal::findOrFail($id);

        if ($soal->status !== 'terkunci') {
            return response()->json([
                'message' => 'Hanya soal terkunci yang bisa dibuka untuk ujian online.',
            ], 422);
        }

        $soal->update(['status' => 'siap_ujian']);

        ActivityLogger::log('buka_ujian', ['bank_soal_id' => $soal->id], $soal->id, $request->user());

        // Beritahu panitia agar segera generate QR code untuk siswa.
        NotifikasiService::keRoles(
            ['panitia'],
            'Soal siap untuk ujian online',
            "{$request->user()->nama} membuka jendela ujian soal {$soal->mataKuliah?->nama_mk}. Silakan generate QR code untuk siswa.",
            'info',
            'Ujian Online',
        );

        // Beritahu dosen pemilik bahwa soalnya lolos dan siap untuk ujian.
        if ($soal->user_id) {
            NotifikasiService::keUser(
                $soal->user_id,
                'Soal disetujui untuk ujian online',
                "Soal {$soal->mataKuliah?->nama_mk} telah dibuka jendela ujiannya oleh Kaprodi dan siap untuk ujian online.",
                'sukses',
                'Soal Saya',
            );
        }

        return response()->json([
            'message' => 'Soal dibuka untuk ujian online.',
            'data' => $this->transform($soal->fresh('mataKuliah')),
        ]);
    }

    public function putuskanPersetujuan(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'keputusan' => ['required', Rule::in(['disetujui', 'ditolak'])],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ]);
        $soal = BankSoal::findOrFail($id);
        if ($soal->status !== 'terkunci' || ! $soal->file_path) {
            return response()->json(['message' => 'Hanya soal yang menunggu persetujuan dan memiliki file yang dapat diputuskan.'], 422);
        }

        $approved = $data['keputusan'] === 'disetujui';
        $approver = $request->user();
        if ($approved && ! $approver->signature_path) {
            return response()->json(['message' => 'Unggah tanda tangan di menu Profil sebelum menyetujui soal.'], 422);
        }
        if ($approved && ! \Illuminate\Support\Facades\Storage::disk('local')->exists($approver->signature_path)) {
            return response()->json(['message' => 'File tanda tangan tidak ditemukan. Unggah ulang melalui menu Profil.'], 422);
        }
        $approvalAt = now();
        $approvalSignaturePath = null;
        if ($approved) {
            $extension = pathinfo($approver->signature_path, PATHINFO_EXTENSION) ?: 'png';
            $approvalSignaturePath = 'approval-signatures/soal-'.$soal->id.'-'.$approvalAt->format('YmdHis').'.'.$extension;
            \Illuminate\Support\Facades\Storage::disk('local')->copy($approver->signature_path, $approvalSignaturePath);
            try {
                $this->approvalSignatures->stamp($soal, $approvalSignaturePath, $approver->nama, $approvalAt);
            } catch (\Throwable $error) {
                \Illuminate\Support\Facades\Storage::disk('local')->delete($approvalSignaturePath);
                report($error);
                return response()->json(['message' => 'PDF tidak dapat diberi tanda tangan otomatis. Periksa file PDF dan coba unggah ulang.'], 422);
            }
        }
        $soal->update([
            'status' => $approved ? 'siap_ujian' : 'ditolak',
            'catatan_persetujuan' => $data['catatan'] ?? null,
            'approved_by' => $approved ? $approver->id : null,
            'approval_name' => $approved ? $approver->nama : null,
            'approval_signature_path' => $approvalSignaturePath,
            'approved_at' => $approved ? $approvalAt : null,
            'file_hash' => $soal->file_hash,
        ]);
        ActivityLogger::log($approved ? 'soal_disetujui' : 'soal_ditolak', ['catatan' => $data['catatan'] ?? null], $soal->id, $request->user());
        if ($soal->user_id) {
            NotifikasiService::keUser(
                $soal->user_id,
                $approved ? 'Soal disetujui' : 'Soal ditolak',
                $approved
                    ? "Soal {$soal->judul} disetujui dan dapat dijadwalkan untuk sesi ujian."
                    : "Soal {$soal->judul} ditolak oleh Kaprodi. ".($data['catatan'] ?? ''),
                $approved ? 'sukses' : 'peringatan',
                'Soal Saya',
            );
        }
        if ($approved) {
            NotifikasiService::keRoles(['panitia'], 'Soal disetujui', "Soal {$soal->judul} siap dijadwalkan untuk sesi ujian.", 'info', 'Sesi Ujian');
        }
        return response()->json(['message' => $approved ? 'Soal disetujui.' : 'Soal ditolak.', 'data' => $this->transform($soal->fresh('mataKuliah'))]);
    }

    public function previewUntukPersetujuan(int $id): SymfonyResponse
    {
        $soal = BankSoal::findOrFail($id);
        if ($soal->status !== 'terkunci' || ! $soal->file_path) {
            return response()->json(['message' => 'Soal ini tidak sedang menunggu persetujuan.'], 422);
        }
        $pdf = $this->files->readDecrypted($soal->file_path);
        if ($pdf === null) return response()->json(['message' => 'File soal tidak ditemukan.'], 404);
        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="review-soal-'.$soal->id.'.pdf"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function transform(BankSoal $s): array
    {
        return [
            'id' => $s->id,
            'kode_mk' => $s->mataKuliah?->kode_mk,
            'nama_mk' => $s->mataKuliah?->nama_mk,
            'kelas' => $s->mataKuliah?->kelas,
            'jenis' => $s->jenis,
            'judul' => $s->judul,
            'status' => $s->status,
            'ujian_selesai' => $s->isUjianSelesai(),
            'jumlah_mahasiswa' => $s->jumlah_mahasiswa,
            'jadwal_ujian' => optional($s->jadwal_ujian)->format('Y-m-d H:i'),
            'waktu_mulai_ujian' => optional($s->waktu_mulai_ujian)->format('Y-m-d H:i'),
            'durasi_menit' => $s->durasi_menit,
            'file_tersedia' => (bool) $s->file_path,
        ];
    }
}
