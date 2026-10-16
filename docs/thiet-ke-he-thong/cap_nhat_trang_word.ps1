# Buoc hoan thien bang Microsoft Word (chay SAU tao_chuong3.py):
#   1) cap nhat Muc luc (TOC) de co cac de muc cua Chuong 3
#   2) dien so trang cho cac muc "Bang 3.x" / "Hinh 3.x" trong DANH MUC BANG / DANH MUC HINH (thay dau "...")
#   3) luu lai tep .docx va xuat them ban .pdf canh ben de xem truoc
# Chay:  powershell -ExecutionPolicy Bypass -File cap_nhat_trang_word.ps1 [duong_dan_tep.docx] [-CaptionFile tep.json]
# Tep chi chua ky tu ASCII; chu tieng Viet doc tu _chu_thich_chuong3.json (UTF-8) do tao_chuong3.py ghi ra.
# Sau sua_chuong12.py thi dung -CaptionFile _chu_thich_v3.json (moi chu thich bang/hinh cua chuong 1-3).
param(
    [string]$DocPath = (Join-Path $PSScriptRoot "..\bao-cao\Khoa_luan_NguyenVanKhanh_11236129_Chuong1-3.docx"),
    [string]$CaptionFile = ""
)
$ErrorActionPreference = "Stop"
$DocPath = (Resolve-Path $DocPath).Path
$capFile = Join-Path $PSScriptRoot "_chu_thich_chuong3.json"
if ($CaptionFile -ne "") { $capFile = (Resolve-Path $CaptionFile).Path }
if (-not (Test-Path $capFile)) { throw "Thieu $capFile - hay chay tao_chuong3.py truoc" }
$captions = (Get-Content -Raw -Encoding UTF8 $capFile | ConvertFrom-Json).captions
$ellipsis = [string][char]0x2026
$wdActiveEndAdjustedPageNumber = 1

$word = New-Object -ComObject Word.Application
# Chot an toan: neu COM bam vao phien Word nguoi dung dang mo (da co tai lieu) thi dung ngay,
# khong an cua so va khong Quit() - tranh dong Word cua nguoi dung.
if ($word.Documents.Count -gt 0) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    throw "Word dang mo tai lieu cua nguoi dung trong cung phien COM - hay dong Word roi chay lai"
}
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($DocPath, $false, $false)
    foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
    $doc.Repaginate()
    $missing = @()
    foreach ($cap in $captions) {
        # Lan tim 1: muc trong danh muc; lan tim 2: chu thich that trong than chuong -> so trang
        $r = $doc.Content
        $f = $r.Find
        $f.ClearFormatting()
        $found1 = $f.Execute($cap)
        if (-not $found1) { $missing += $cap; continue }
        $entryPara = $r.Paragraphs.Item(1).Range
        $r2 = $doc.Range($r.End, $doc.Content.End)
        $f2 = $r2.Find
        $f2.ClearFormatting()
        if (-not $f2.Execute($cap)) { $missing += $cap; continue }
        $page = $r2.Information($wdActiveEndAdjustedPageNumber)
        $fe = $entryPara.Find
        $fe.ClearFormatting()
        $fe.Replacement.ClearFormatting()
        # Execute(FindText, MatchCase, MatchWholeWord, MatchWildcards, MatchSoundsLike, MatchAllWordForms, Forward, Wrap, Format, ReplaceWith, Replace)
        [void]$fe.Execute($ellipsis, $false, $false, $false, $false, $false, $true, 0, $false, [string]$page, 1)
    }
    $doc.Save()
    $pdf = [System.IO.Path]::ChangeExtension($DocPath, ".pdf")
    $doc.ExportAsFixedFormat($pdf, 17)
    $pages = $doc.ComputeStatistics(2)
    $doc.Close($false)
    Write-Output ("Da cap nhat muc luc, dien so trang cho {0} muc; tong {1} trang; PDF: {2}" -f ($captions.Count - $missing.Count), $pages, $pdf)
    if ($missing.Count -gt 0) { Write-Output ("Khong tim thay {0} chu thich:" -f $missing.Count); $missing | ForEach-Object { Write-Output "  $_" } }
}
finally {
    $word.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
