# ============================================
# Script Push ERP App ke GitHub
# CV Altro Service - diandakumala-ai
# ============================================

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Push ERP App ke GitHub" -ForegroundColor Cyan
Write-Host "  Repo: erp-altro-service" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Hapus .git lama yang mungkin corrupt
if (Test-Path ".git") {
    Write-Host "Menghapus .git lama..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".git" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Git init fresh
Write-Host "Inisialisasi repository baru..." -ForegroundColor Green
git init -b main
git config user.email "diandakumala@gmail.com"
git config user.name "Gilang"

# Pastikan workflow file ada
Write-Host "Mengecek GitHub Actions workflow..." -ForegroundColor Green
if (Test-Path ".github/workflows/deploy.yml") {
    Write-Host "  OK: .github/workflows/deploy.yml ditemukan" -ForegroundColor Green
} else {
    Write-Host "  PERINGATAN: workflow file tidak ditemukan!" -ForegroundColor Red
}

# Add semua file (kecuali yang di .gitignore)
Write-Host "Menambahkan semua file..." -ForegroundColor Green
git add .

# Tampilkan ringkasan
Write-Host ""
Write-Host "File yang akan di-commit:" -ForegroundColor Cyan
git status --short
Write-Host ""

# Commit
Write-Host "Membuat commit..." -ForegroundColor Green
git commit -m "feat: ERP Altro Service + GitHub Actions auto-deploy

- Aplikasi ERP lengkap (job management, finance, customer)
- Integrasi Supabase database
- Data dari 26 file Excel pelanggan
- GitHub Actions workflow untuk auto-deploy ke altroservice.com/erp
- .htaccess untuk routing React SPA"

# Set remote (gunakan HTTPS biasa, autentikasi via Git Credential Manager)
$repoUrl = "https://github.com/diandakumala-ai/erp-altro-service.git"

Write-Host "Menghubungkan ke GitHub..." -ForegroundColor Green
git remote add origin $repoUrl

# Push
Write-Host ""
Write-Host "Push ke GitHub..." -ForegroundColor Yellow
git push -u origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  BERHASIL! Kode sudah di GitHub:" -ForegroundColor Green
    Write-Host "  https://github.com/diandakumala-ai/erp-altro-service" -ForegroundColor Green
    Write-Host ""
    Write-Host "  LANGKAH SELANJUTNYA - Tambahkan GitHub Secrets:" -ForegroundColor Yellow
    Write-Host "  Buka: github.com/diandakumala-ai/erp-altro-service/settings/secrets/actions" -ForegroundColor White
    Write-Host ""
    Write-Host "  Secrets yang perlu ditambahkan:" -ForegroundColor Cyan
    Write-Host "  - VITE_SUPABASE_URL      (dari Supabase project settings)" -ForegroundColor White
    Write-Host "  - VITE_SUPABASE_ANON_KEY (dari Supabase project settings)" -ForegroundColor White
    Write-Host "  - FTP_HOST               (hostname FTP cPanel Anda)" -ForegroundColor White
    Write-Host "  - FTP_USERNAME           (username FTP cPanel)" -ForegroundColor White
    Write-Host "  - FTP_PASSWORD           (password FTP cPanel)" -ForegroundColor White
    Write-Host ""
    Write-Host "  Setelah secrets diisi, setiap push ke main" -ForegroundColor White
    Write-Host "  akan auto-deploy ke altroservice.com/erp" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "GAGAL push ke GitHub. Cek pesan error di atas." -ForegroundColor Red
    Write-Host "Kemungkinan: repo belum dibuat atau token sudah expired." -ForegroundColor Yellow
    Write-Host "Buat repo baru di: https://github.com/new" -ForegroundColor Yellow
    Write-Host "Nama repo: erp-altro-service (pastikan Public)" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Tekan Enter untuk menutup"
