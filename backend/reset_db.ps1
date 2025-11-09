# Reset Database with New Multi-Report Schema
# WARNING: This will DELETE all existing data!

Write-Host "=== SummAID Database Reset ===" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    exit 1
}

$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    Write-Host "ERROR: DATABASE_URL not found in .env!" -ForegroundColor Red
    exit 1
}

# Parse database URL to extract connection details
# Format: postgresql://user:password@host:port/database
if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
} else {
    Write-Host "ERROR: Could not parse DATABASE_URL!" -ForegroundColor Red
    exit 1
}

Write-Host "Database: $dbName" -ForegroundColor Yellow
Write-Host "Host: $dbHost" -ForegroundColor Yellow
Write-Host ""
Write-Host "[WARNING] This will DELETE ALL existing data!" -ForegroundColor Red
$confirm = Read-Host "Type 'yes' to continue"

if ($confirm -ne 'yes') {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Resetting database schema..." -ForegroundColor Cyan

# Set password environment variable for psql
$env:PGPASSWORD = $dbPassword

# Drop existing tables (in reverse dependency order)
Write-Host "  - Dropping existing tables..."
psql -U $dbUser -h $dbHost -p $dbPort -d $dbName -c "DROP TABLE IF EXISTS report_chunks CASCADE;" 2>&1 | Out-Null
psql -U $dbUser -h $dbHost -p $dbPort -d $dbName -c "DROP TABLE IF EXISTS reports CASCADE;" 2>&1 | Out-Null
psql -U $dbUser -h $dbHost -p $dbPort -d $dbName -c "DROP TABLE IF EXISTS patients CASCADE;" 2>&1 | Out-Null

# Create new schema
Write-Host "  - Creating new schema..."
psql -U $dbUser -h $dbHost -p $dbPort -d $dbName -f schema.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] Database schema reset complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Add PDF files to ./demo_reports/"
    Write-Host "     - Use naming like: jane_mri.pdf, jane_pathology.pdf"
    Write-Host "     - Files with same prefix will be grouped under one patient"
    Write-Host ""
    Write-Host "  2. Run seeding script:"
    Write-Host "     python seed.py"
    Write-Host ""
    Write-Host "  3. Verify multi-report setup:"
    Write-Host "     python test_schema.py"
} else {
    Write-Host ""
    Write-Host "[ERROR] Error resetting database!" -ForegroundColor Red
    exit 1
}
