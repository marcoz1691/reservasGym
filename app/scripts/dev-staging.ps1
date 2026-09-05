# Copia plantilla staging si no existe y arranca la app contra Supabase staging.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".env.staging")) {
  Copy-Item ".env.staging.example" ".env.staging"
  Write-Host "Creado .env.staging — edita VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY antes de continuar."
  Write-Host "Guia: docs/tecnico/staging-setup.md"
  exit 1
}

$url = (Get-Content ".env.staging" | Where-Object { $_ -match '^VITE_SUPABASE_URL=(.+)$' }) -replace '^VITE_SUPABASE_URL=',''
if ([string]::IsNullOrWhiteSpace($url) -or $url -match 'TU-PROJECT-REF') {
  Write-Host "Completa .env.staging con las credenciales del proyecto Supabase staging."
  exit 1
}

npm run dev:staging
