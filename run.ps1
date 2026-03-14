# PowerShell run script for Discord Cloner Hybrid

Write-Host "Starting Discord Cloner Hybrid..." -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure it." -ForegroundColor Yellow
    exit 1
}

# Check if TypeScript is built
if (-not (Test-Path "ts/dist")) {
    Write-Host "TypeScript not built. Building now..." -ForegroundColor Yellow
    Set-Location ts
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install
        npm run build
    } else {
        Write-Host "npm not found. Please install Node.js: https://nodejs.org/" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Set-Location ..
}

# Check if Rust binary exists
if (-not (Test-Path "rust/target/release/discord-cloner-hybrid.exe") -and -not (Test-Path "rust/target/release/discord-cloner-hybrid")) {
    Write-Host "Rust binary not found. Building now..." -ForegroundColor Yellow
    Set-Location rust
    if (Get-Command cargo -ErrorAction SilentlyContinue) {
        cargo build --release
    } else {
        Write-Host "Cargo not found. Please install Rust: https://rustup.rs/" -ForegroundColor Red
        Write-Host "Continuing without Rust binary (will use TypeScript fallback)..." -ForegroundColor Yellow
    }
    Set-Location ..
}

# Run the TypeScript application
Write-Host "`nStarting application..." -ForegroundColor Green
Set-Location ts
npm start
Set-Location ..

