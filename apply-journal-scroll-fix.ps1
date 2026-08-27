$ErrorActionPreference = "Stop"

$stylePath = Join-Path (Get-Location) "style.css"
if (-not (Test-Path $stylePath)) {
    throw "style.css introuvable. Lance ce script depuis la racine de mon-app-alimentation."
}

$marker = "WELLNESS V4.1.1 — JOURNAL EDITOR IOS SCROLL FIX"
$current = Get-Content $stylePath -Raw

if ($current -match [regex]::Escape($marker)) {
    Write-Host "Le correctif V4.1.1 est deja present." -ForegroundColor Yellow
} else {
    $patch = Get-Content (Join-Path $PSScriptRoot "journal-scroll-fix.css") -Raw
    Add-Content -Path $stylePath -Value ("`r`n`r`n" + $patch)
    Write-Host "Correctif de scroll ajoute a style.css." -ForegroundColor Green
}

Write-Host ""
Write-Host "Verification..." -ForegroundColor Cyan
npm run verify
if ($LASTEXITCODE -ne 0) {
    throw "npm run verify a echoue."
}

Write-Host ""
Write-Host "OK - le journal alimentaire peut maintenant defiler sur iPhone." -ForegroundColor Green
