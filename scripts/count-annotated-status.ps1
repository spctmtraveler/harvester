$p = "transcripts/app output/reporter/chair-elt-research-report-2024-annotated-against-2026.md"
$lines = Get-Content -Path $p
$supported = ($lines | Where-Object { $_ -like "> **2026 Check:** ✅*" }).Count
$partial = ($lines | Where-Object { $_ -like "> **2026 Check:** 🟡*" }).Count
$notSupported = ($lines | Where-Object { $_ -like "> **2026 Check:** ❌*" }).Count
$total = $supported + $partial + $notSupported
Write-Host "Supported=$supported Partial=$partial NotSupportedOrComparable=$notSupported Total=$total"
