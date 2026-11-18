<?php

namespace App\Services;

use App\Models\BankSoal;
use Illuminate\Support\Facades\Storage;
use setasign\Fpdi\Fpdi;

class ApprovalSignatureService
{
    public function __construct(private readonly FileProtectionService $files) {}

    /** Stamp the kaprodi signature and name in Template 2's existing approval box. */
    public function stamp(BankSoal $soal, string $signaturePath, string $name, \DateTimeInterface $approvedAt): void
    {
        $original = $this->files->readDecrypted($soal->file_path);
        if (! is_string($original) || ! str_starts_with(ltrim($original), '%PDF')) {
            throw new \RuntimeException('PDF soal tidak dapat dibuka untuk diberi pengesahan.');
        }
        if (! Storage::disk('local')->exists($signaturePath)) {
            throw new \RuntimeException('Salinan tanda tangan persetujuan tidak ditemukan.');
        }

        $pdfTmp = tempnam(sys_get_temp_dir(), 'ebrankas_approved_');
        $signatureTmp = tempnam(sys_get_temp_dir(), 'ebrankas_signature_');
        try {
            file_put_contents($pdfTmp, $original);
            file_put_contents($signatureTmp, Storage::disk('local')->get($signaturePath));

            $pdf = new Fpdi();
            $pdf->SetCompression(true);
            $pageCount = $pdf->setSourceFile($pdfTmp);
            $savedLayoutIsValid = $soal->signature_page !== null
                && $soal->signature_page <= $pageCount
                && $soal->signature_x !== null
                && $soal->signature_y !== null
                && $soal->signature_width !== null
                && $soal->signature_height !== null
                && $soal->signature_name_y !== null;
            $stampPage = $savedLayoutIsValid ? $soal->signature_page : 1;
            for ($page = 1; $page <= $pageCount; $page++) {
                $template = $pdf->importPage($page);
                $size = $pdf->getTemplateSize($template);
                $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $pdf->useTemplate($template);

                if ($page === $stampPage) {
                    $pageWidth = $size['width'];
                    $pageHeight = $size['height'];
                    $imageType = str_ends_with(strtolower($signaturePath), '.png') ? 'PNG' : 'JPG';
                    if ($savedLayoutIsValid
                        && $soal->signature_x + $soal->signature_width <= $pageWidth
                        && $soal->signature_y + $soal->signature_height <= $pageHeight
                        && $soal->signature_name_y + 4 <= $pageHeight) {
                        $signatureX = $soal->signature_x;
                        $signatureY = $soal->signature_y;
                        $signatureWidth = $soal->signature_width;
                        $signatureHeight = $soal->signature_height;
                        $cellLeft = max(0, $signatureX - 8);
                        $cellWidth = min($pageWidth - $cellLeft, $signatureWidth + 16);
                        $nameY = $soal->signature_name_y;
                    } else {
                        // Fallback for PDFs where the Kaprodi label could not be
                        // detected during upload.
                        $signatureWidth = min(34, $pageWidth * 0.162);
                        $signatureHeight = min(10, $pageHeight * 0.034);
                        $cellLeft = $pageWidth * 0.476;
                        $cellWidth = $pageWidth * 0.248;
                        $signatureX = $cellLeft + ($cellWidth - $signatureWidth) / 2;
                        $signatureY = $pageHeight - 40;
                        $nameY = $pageHeight - 27;
                    }
                    $pdf->Image($signatureTmp, $signatureX, $signatureY, $signatureWidth, $signatureHeight, $imageType);

                    $printableName = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name) ?: $name;
                    $pdf->SetFont('Helvetica', 'B', 9);
                    $pdf->SetTextColor(31, 41, 55);
                    $pdf->SetXY($cellLeft, $nameY);
                    $pdf->Cell($cellWidth, 4, $printableName, 0, 0, 'C');
                }
            }

            $signedPdf = $pdf->Output('S');
            $this->files->replaceEncrypted($soal->file_path, $signedPdf);
            $soal->file_hash = hash('sha256', $signedPdf);
        } finally {
            if (is_file($pdfTmp)) @unlink($pdfTmp);
            if (is_file($signatureTmp)) @unlink($signatureTmp);
        }
    }
}
