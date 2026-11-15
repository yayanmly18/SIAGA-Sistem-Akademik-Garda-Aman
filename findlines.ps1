$content = Get-Content 'src\App.tsx'  
$start = \[array\]::IndexOf\($content, 'function SesiUjianPage('\`  
$end = \[array\]::IndexOf\($content, 'function LogAksesUjianPage('\`  
Write-Host (\"START:\" + $start + \" END:\" + $end)  
