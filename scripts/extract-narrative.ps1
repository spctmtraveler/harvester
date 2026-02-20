$resp = Invoke-RestMethod 'https://happydo.xyz/api_auto_db/sql_proxy.php?key=z3Do9mKf8Q_autoDB_2025' -Method Post -ContentType 'application/json' -Body (@{app='HWIE_v2';sql="SELECT payload FROM app_output WHERE app_stage='reporter' ORDER BY output_id DESC LIMIT 1";params=@{}} | ConvertTo-Json)
$p = $resp.rows[0].payload | ConvertFrom-Json
$preview = $p.report_preview
$outPath = "transcripts/app output/reporter/narrative-report-output.md"
$preview | Set-Content -Path $outPath -Encoding utf8
$len = $preview.Length
Write-Host "Saved: $len chars to $outPath"
