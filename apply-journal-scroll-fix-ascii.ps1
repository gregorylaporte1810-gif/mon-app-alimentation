$ErrorActionPreference = "Stop"

$stylePath = Join-Path (Get-Location) "style.css"

if (-not (Test-Path $stylePath)) {
    throw "style.css introuvable. Lance ce script depuis la racine de mon-app-alimentation."
}

$marker = "WELLNESS V4.1.1 JOURNAL EDITOR IOS SCROLL FIX"
$current = Get-Content $stylePath -Raw

if ($current -match [regex]::Escape($marker)) {
    Write-Host "Le correctif est deja present." -ForegroundColor Yellow
}
else {
    $patch = @'

/* ======================================================
   WELLNESS V4.1.1 JOURNAL EDITOR IOS SCROLL FIX
====================================================== */

.mega-journal-edit-overlay {
  overscroll-behavior: contain;
}

.mega-journal-edit-modal {
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
}

@media (max-width: 760px) {
  .mega-journal-edit-modal {
    max-height: 89dvh !important;
    padding-bottom: max(18px, env(safe-area-inset-bottom));
  }
}

'@

    Add-Content -Path $stylePath -Value $patch -Encoding UTF8
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
