<?php

namespace App\Services;

/**
 * Pembaca metrik sistem operasi tempat backend berjalan.
 *
 * Cross-platform: Linux (via /proc) dan Windows (via wmic, dengan fallback
 * PowerShell). Semua metode menelan kegagalan dan mengembalikan null —
 * pemanggil (controller) memutuskan tampilan "tidak terukur" agar UI jujur,
 * bukan angka palsu.
 */
class SystemMetrics
{
    /** Beban CPU persen (0-100) atau null bila tak terukur. */
    public static function cpuPersen(): ?int
    {
        if (PHP_OS_FAMILY === 'Windows') {
            $nilai = self::cpuWindows();

            return $nilai === null ? null : (int) round(min(100, max(0, $nilai)));
        }

        return self::cpuLinux();
    }

    private static function cpuWindows(): ?float
    {
        $out = [];
        @exec('wmic cpu get loadpercentage /value 2>&1', $out);
        $maks = null;
        foreach ($out as $baris) {
            if (preg_match('/LoadPercentage\s*=\s*(\d+)/i', (string) $baris, $m)) {
                $maks = max($maks ?? 0, (float) $m[1]);
            }
        }
        if ($maks !== null) {
            return $maks;
        }

        // wmic deprecated di Windows 11 baru — fallback CIM.
        $out = [];
        @exec('powershell -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average" 2>&1', $out);
        foreach ($out as $baris) {
            if (is_numeric(trim((string) $baris))) {
                return (float) trim((string) $baris);
            }
        }

        return null;
    }

    /**
     * Sampel ganda /proc/stat (selang 0,3 dtk) — rasio CPU sibuk yang akurat.
     */
    private static function cpuLinux(): ?int
    {
        $baca = static function (): ?array {
            $isi = @file('/proc/stat');
            if (! $isi || ! isset($isi[0])) {
                return null;
            }
            $bagian = preg_split('/\s+/', trim((string) $isi[0]));
            if (! $bagian || $bagian[0] !== 'cpu' || count($bagian) < 5) {
                return null;
            }
            $angka = array_map('floatval', array_slice($bagian, 1));
            $idle = ($angka[3] ?? 0) + ($angka[4] ?? 0);

            return ['total' => array_sum($angka), 'idle' => $idle];
        };

        $a = $baca();
        if (! $a) {
            return null;
        }
        usleep(300000);
        $b = $baca();
        if (! $b) {
            return null;
        }

        $dTotal = $b['total'] - $a['total'];
        $dIdle = $b['idle'] - $a['idle'];
        if ($dTotal <= 0) {
            return null;
        }

        return (int) round(min(100, max(0, (1 - $dIdle / $dTotal) * 100)));
    }

    /**
     * Memori fisik server (byte). @return array{total:int|null, tersedia:int|null}
     */
    public static function memori(): array
    {
        if (PHP_OS_FAMILY === 'Windows') {
            return self::memoriWindows();
        }

        $info = @file_get_contents('/proc/meminfo');
        if (! is_string($info)) {
            return ['total' => null, 'tersedia' => null];
        }
        $ambil = static function (string $kunci) use ($info): ?int {
            if (! preg_match('/^'.$kunci.':\s+(\d+)\s*kB$/m', $info, $m)) {
                return null;
            }

            return (int) $m[1] * 1024;
        };
        $total = $ambil('MemTotal');
        $tersedia = $ambil('MemAvailable') ?? $ambil('MemFree');
        if ($total === null || $tersedia === null) {
            return ['total' => null, 'tersedia' => null];
        }

        return ['total' => $total, 'tersedia' => $tersedia];
    }

    private static function memoriWindows(): array
    {
        $out = [];
        @exec('wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value 2>&1', $out);
        $total = null;
        $bebas = null;
        foreach ($out as $baris) {
            if (preg_match('/TotalVisibleMemorySize\s*=\s*(\d+)/i', (string) $baris, $m)) {
                $total = (int) $m[1] * 1024;
            }
            if (preg_match('/FreePhysicalMemory\s*=\s*(\d+)/i', (string) $baris, $m)) {
                $bebas = (int) $m[1] * 1024;
            }
        }
        if ($total && $bebas !== null) {
            return ['total' => $total, 'tersedia' => $bebas];
        }

        $out = [];
        @exec('powershell -NoProfile -NonInteractive -Command "$os = Get-CimInstance Win32_OperatingSystem; $os.TotalVisibleMemorySize; $os.FreePhysicalMemory" 2>&1', $out);
        $angka = [];
        foreach ($out as $baris) {
            $b = trim((string) $baris);
            if (is_numeric($b)) {
                $angka[] = (int) $b * 1024;
            }
        }
        if (count($angka) >= 2 && $angka[0] > 0) {
            return ['total' => $angka[0], 'tersedia' => $angka[1]];
        }

        return ['total' => null, 'tersedia' => null];
    }

    /**
     * Disk tempat path berada (byte). Selalu tersedia (fungsi bawaan PHP).
     *
     * @return array{total:int, tersedia:int, terpakai:int, persen:int}
     */
    public static function disk(string $path): array
    {
        $total = @disk_total_space($path);
        $bebas = @disk_free_space($path);
        if (! $total || $total <= 0) {
            return ['total' => 0, 'tersedia' => 0, 'terpakai' => 0, 'persen' => 0];
        }
        $bebas = max(0, (int) $bebas);
        $terpakai = max(0, (int) $total - $bebas);

        return [
            'total' => (int) $total,
            'tersedia' => $bebas,
            'terpakai' => $terpakai,
            'persen' => (int) round($terpakai / $total * 100),
        ];
    }

    /** Waktu nyala OS (timestamp Unix) atau null bila tak terukur. */
    public static function bootTime(): ?int
    {
        if (PHP_OS_FAMILY === 'Windows') {
            $out = [];
            @exec('wmic os get lastbootuptime /value 2>&1', $out);
            foreach ($out as $baris) {
                if (preg_match('/LastBootUpTime\s*=\s*(\d{14})/i', (string) $baris, $m)) {
                    $w = \DateTime::createFromFormat('YmdHis', $m[1]);

                    return $w ? (int) $w->getTimestamp() : null;
                }
            }

            return null;
        }

        $uptime = @file_get_contents('/proc/uptime');
        if (is_string($uptime) && preg_match('/^([\d.]+)/', $uptime, $m)) {
            return time() - (int) ((float) $m[1]);
        }

        return null;
    }
}
