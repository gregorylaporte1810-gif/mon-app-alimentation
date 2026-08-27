$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
  throw "Lance ce script depuis la racine du dépôt Wellness."
}

$tracked = git ls-files "node_modules/*"
if (-not $tracked) {
  Write-Host "✅ node_modules n'est plus suivi par Git."
  exit 0
}

Write-Host "Suppression de node_modules de l'index Git (les fichiers locaux restent sur le PC)..."
git rm -r --cached --ignore-unmatch node_modules
Write-Host "✅ Terminé. Le dossier local node_modules est conservé grâce à --cached."
