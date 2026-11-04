# Start local full-stack development (shared watch + backend + frontend).
#
# Usage:
#   .\scripts\dev.ps1
#   .\scripts\dev.ps1 -Install     # npm install in shared, backend, frontend first
#   .\scripts\dev.ps1 -NoWatch     # build shared once; skip tsc --watch
#   .\scripts\dev.ps1 --install    # bash-style flags also accepted
#   .\scripts\dev.ps1 --no-watch
#
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
#
# Prerequisites:
#   backend/.env       (copy from backend/.env.example)
#   frontend/.env.local (copy from frontend/.env.example)

[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$NoWatch,
  [switch]$Help,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Remaining
)

$ErrorActionPreference = "Stop"

foreach ($arg in $Remaining) {
  switch ($arg) {
    "--install" { $Install = $true }
    "--no-watch" { $NoWatch = $true }
    "-h" { $Help = $true }
    "--help" { $Help = $true }
    default {
      Write-Error "Unknown option: $arg`nRun .\scripts\dev.ps1 -Help for usage."
      exit 1
    }
  }
}

if ($Help) {
  Get-Content -Path $PSCommandPath -TotalCount 15 | Select-Object -Skip 1
  exit 0
}

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not (Test-Path "backend/.env")) {
  Write-Error "Missing backend/.env — copy backend/.env.example and set Supabase credentials."
  exit 1
}

if (-not (Test-Path "frontend/.env.local") -and -not (Test-Path "frontend/.env")) {
  Write-Error "Missing frontend/.env.local — copy frontend/.env.example and set Supabase credentials."
  exit 1
}

function Get-NpmCommand {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "npm not found on PATH. Install Node.js 22+ and retry."
}

function Invoke-Npm {
  param([Parameter(Mandatory = $true)][string[]]$NpmArgs)
  $npm = Get-NpmCommand
  & $npm @NpmArgs
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Start-NpmProcess {
  param([Parameter(Mandatory = $true)][string[]]$NpmArgs)
  $npm = Get-NpmCommand
  return Start-Process -FilePath $npm -ArgumentList $NpmArgs -WorkingDirectory $Root -PassThru -NoNewWindow
}

function Stop-ProcessTree {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  & taskkill.exe /T /F /PID $ProcessId 2>$null | Out-Null
}

$script:ChildProcesses = @()

function Register-ChildProcess {
  param([System.Diagnostics.Process]$Process)
  if ($null -ne $Process) {
    $script:ChildProcesses += $Process
  }
}

function Stop-ChildProcesses {
  foreach ($proc in $script:ChildProcesses) {
    if ($null -eq $proc) { continue }
    try {
      if (-not $proc.HasExited) {
        Stop-ProcessTree -ProcessId $proc.Id
      }
    } catch {
      # Process may already be gone.
    }
  }
  $script:ChildProcesses = @()
}

try {
  if ($Install) {
    Write-Host "Installing dependencies..."
    Invoke-Npm -NpmArgs @("install", "--prefix", "shared")
    Invoke-Npm -NpmArgs @("install", "--prefix", "backend")
    Invoke-Npm -NpmArgs @("install", "--prefix", "frontend")
  }

  Write-Host "Building shared..."
  Invoke-Npm -NpmArgs @("run", "build", "--prefix", "shared")

  # Turbopack root is the monorepo (so shared/dist resolves). Next lives under
  # frontend/node_modules — without this link HMR panics: "Next.js package not found".
  $repoNodeModules = Join-Path $Root "node_modules"
  $frontendNext = Join-Path $Root "frontend/node_modules/next"
  New-Item -ItemType Directory -Force -Path $repoNodeModules | Out-Null
  $repoNext = Join-Path $repoNodeModules "next"
  if (Test-Path $repoNext) {
    Remove-Item -Force $repoNext
  }
  New-Item -ItemType SymbolicLink -Path $repoNext -Target $frontendNext | Out-Null

  if (-not $NoWatch) {
    Write-Host "Watching shared for changes..."
    Register-ChildProcess (Start-NpmProcess -NpmArgs @("run", "watch", "--prefix", "shared"))
  }

  Write-Host "Starting backend (port 3001)..."
  Register-ChildProcess (Start-NpmProcess -NpmArgs @("run", "dev", "--prefix", "backend"))

  Write-Host "Starting frontend (port 3000)..."
  Register-ChildProcess (Start-NpmProcess -NpmArgs @("run", "dev", "--prefix", "frontend"))

  Write-Host ""
  Write-Host "Dev stack running:"
  Write-Host "  Frontend  http://localhost:3000"
  Write-Host "  Backend   http://localhost:3001"
  Write-Host ""
  Write-Host "Press Ctrl+C to stop."
  Write-Host ""

  $ids = @($script:ChildProcesses | ForEach-Object { $_.Id })
  Wait-Process -Id $ids
} finally {
  Stop-ChildProcesses
}
