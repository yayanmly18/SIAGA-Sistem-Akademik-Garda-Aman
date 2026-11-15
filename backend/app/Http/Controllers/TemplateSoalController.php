<?php

namespace App\Http\Controllers;

use App\Models\TemplateSoal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class TemplateSoalController extends Controller
{
    /**
     * Daftar template soal yang tersedia (semua role terautentikasi).
     */
    public function index(Request $request): JsonResponse
    {
        $templates = TemplateSoal::with(['pembuat'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (TemplateSoal $t) => [
                'id' => $t->id,
                'nama_template' => $t->nama_template,
                'deskripsi' => $t->deskripsi,
                'file_path' => $t->file_path,
                'created_by' => $t->created_by,
                'pembuat_nama' => $t->pembuat?->nama ?? '-',
                'created_at' => $t->created_at?->format('Y-m-d H:i') ?? null,
            ]);

        return response()->json(['data' => $templates]);
    }

    /**
     * Admin IT upload template soal (file referensi format untuk dosen).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama_template' => ['required', 'string', 'max:200'],
            'deskripsi' => ['nullable', 'string'],
            'file' => ['required', 'file', 'max:10240'], // maks 10 MB
        ]);

        // Simpan file template di luar public path (storage/app/private/template)
        // tanpa enkripsi agar dosen bisa buka/download langsung sebagai acuan format.
        $file = $request->file('file');
        $randomName = Str::lower(Str::random(10)).'_'.Str::slug($data['nama_template']).'.'.$file->getClientOriginalExtension();
        $path = 'template/'.date('Y/m').'/'.$randomName;
        $storedPath = $file->storeAs(dirname($path), basename($path), 'local');

        if ($storedPath === false) {
            return response()->json([
                'message' => 'File gagal disimpan di server. Periksa ruang disk dan izin folder storage/app.',
            ], 500);
        }

        $template = TemplateSoal::create([
            'nama_template' => $data['nama_template'],
            'deskripsi' => $data['deskripsi'] ?? null,
            'file_path' => $path,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Template soal berhasil diunggah.',
            'data' => [
                'id' => $template->id,
                'nama_template' => $template->nama_template,
                'deskripsi' => $template->deskripsi,
                'file_path' => $template->file_path,
                'created_by' => $template->created_by,
                'created_at' => $template->created_at?->format('Y-m-d H:i') ?? null,
            ],
        ], 201);
    }

    /**
     * Unduh file template soal (semua role terautentikasi).
     */
    public function download(Request $request, int $id): SymfonyResponse
    {
        $template = TemplateSoal::findOrFail($id);

        if (! $template->file_path || ! Storage::disk('local')->exists($template->file_path)) {
            return response()->json([
                'message' => 'File template tidak ditemukan di server.',
            ], 404);
        }

        $content = Storage::disk('local')->get($template->file_path);
        $mime = Storage::disk('local')->mimeType($template->file_path);

        return response($content)
            ->header('Content-Type', $mime ?? 'application/octet-stream')
            ->header('Content-Disposition', 'attachment; filename="'.basename($template->file_path).'"');
    }

    /**
     * Admin IT hapus template soal.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $template = TemplateSoal::findOrFail($id);

        // Hapus file fisik jika ada.
        if ($template->file_path && Storage::disk('local')->exists($template->file_path)) {
            Storage::disk('local')->delete($template->file_path);
        }

        $template->delete();

        return response()->json([
            'message' => 'Template soal berhasil dihapus.',
        ]);
    }
}
