# PowerShell build script for Discord Cloner Hybrid

Write-Host "Building Discord Cloner Hybrid..." -ForegroundColor Cyan

# Build Rust components
Write-Host "`n[1/2] Building Rust components..." -ForegroundColor Yellow
Set-Location rust
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    cargo build --release
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Rust build failed!" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Write-Host "Rust build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Cargo not found. Please install Rust: https://rustup.rs/" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

# Build TypeScript components
Write-Host "`n[2/2] Building TypeScript components..." -ForegroundColor Yellow
Set-Location ts
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install failed!" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    
    Write-Host "Building TypeScript..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "TypeScript build failed!" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Write-Host "TypeScript build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "npm not found. Please install Node.js: https://nodejs.org/" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

Write-Host "`nBuild completed successfully!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy .env.example to .env and configure it" -ForegroundColor White
Write-Host "2. Run: cd ts; npm start" -ForegroundColor White

