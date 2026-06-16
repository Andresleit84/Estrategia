# Deploy frontend: build production bundle and restart PM2
# Usage: .\scripts\deploy-frontend.ps1

Write-Host "Building frontend..." -ForegroundColor Cyan
Set-Location "D:\estrategia\frontend"
$env:NODE_ENV = "production"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }

Write-Host "Restarting frontend process..." -ForegroundColor Cyan
pm2 restart okr-frontend-dev
pm2 save

Write-Host "Done. Frontend running at http://localhost:3001" -ForegroundColor Green
