<#
.SYNOPSIS
  Prepares docker/.env for the Agentic CRM local stack. Safe to re-run.

.DESCRIPTION
  - Creates docker/.env from docker/.env.example if it does not exist.
  - Applies the settings in crm-local.env.example. On a freshly created .env every setting is applied.
    On an existing .env only missing or blank keys are filled, so your edits are kept
    (use -Force to apply all of them).
  - Generates SECRET_KEY and N8N_ENCRYPTION_KEY if they are blank (values are never printed).
  - Sets COMPOSE_FILE so plain `docker compose ...` from docker/ includes crm-local/docker-compose.crm.yaml.
  - Creates volumes/mcp-shared.

.PARAMETER EnvFile
  Target env file. Default: ..\.env (docker/.env).

.EXAMPLE
  cd docker\crm-local
  .\bootstrap.ps1
#>
[CmdletBinding()]
param(
    [string]$EnvFile,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$dockerDir = (Resolve-Path (Join-Path $scriptDir '..')).Path
if (-not $EnvFile) { $EnvFile = Join-Path $dockerDir '.env' }
$example   = Join-Path $dockerDir '.env.example'
$crmEnv    = Join-Path $scriptDir 'crm-local.env.example'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Lines($path) { [System.IO.File]::ReadAllText($path).Replace("`r`n", "`n").TrimEnd("`n").Split("`n") }

$created = $false
if (-not (Test-Path $EnvFile)) {
    Copy-Item $example $EnvFile
    $created = $true
    Write-Host "Created $EnvFile from .env.example"
} else {
    Write-Host "Using existing $EnvFile"
}
$lines = [System.Collections.Generic.List[string]]::new()
Read-Lines $EnvFile | ForEach-Object { $lines.Add($_) }

function Get-Value([string]$key) {
    foreach ($l in $lines) { if ($l -match "^$([regex]::Escape($key))=(.*)$") { return $Matches[1] } }
    return $null
}
function Set-Value([string]$key, [string]$value) {
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^$([regex]::Escape($key))=") { $lines[$i] = "$key=$value"; return }
    }
    $lines.Add("$key=$value")
}
function New-Secret([int]$bytes, [string]$format) {
    $buf = New-Object byte[] $bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buf); $rng.Dispose()
    if ($format -eq 'hex') { return ([System.BitConverter]::ToString($buf) -replace '-', '').ToLower() }
    return [Convert]::ToBase64String($buf)
}

# 1. CRM settings
$applied = @(); $kept = @()
foreach ($l in (Read-Lines $crmEnv)) {
    if ($l -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
        $key = $Matches[1]; $val = $Matches[2]
        $current = Get-Value $key
        if ($created -or $Force -or [string]::IsNullOrWhiteSpace($current)) {
            if ($current -ne $val) { Set-Value $key $val; $applied += $key }
        } elseif ($current -ne $val) {
            $kept += $key
        }
    }
}

# 2. Secrets (never printed)
$generated = @()
if ([string]::IsNullOrWhiteSpace((Get-Value 'SECRET_KEY'))) { Set-Value 'SECRET_KEY' (New-Secret 42 'base64'); $generated += 'SECRET_KEY' }
if ([string]::IsNullOrWhiteSpace((Get-Value 'N8N_ENCRYPTION_KEY'))) { Set-Value 'N8N_ENCRYPTION_KEY' (New-Secret 24 'hex'); $generated += 'N8N_ENCRYPTION_KEY' }

# 3. Compose layering. An existing COMPOSE_FILE is never replaced: our layer is appended to it,
#    using the separator already in use (COMPOSE_PATH_SEPARATOR, else ';' which is the Windows default).
$layer     = 'crm-local/docker-compose.crm.yaml'
$composeNote = ''
$cf  = Get-Value 'COMPOSE_FILE'
$sep = Get-Value 'COMPOSE_PATH_SEPARATOR'
if ([string]::IsNullOrWhiteSpace($cf)) {
    if ([string]::IsNullOrWhiteSpace($sep)) { $sep = ','; Set-Value 'COMPOSE_PATH_SEPARATOR' $sep }
    Set-Value 'COMPOSE_FILE' ("docker-compose.yaml$sep$layer")
    $composeNote = 'COMPOSE_FILE set (docker-compose.yaml + ' + $layer + ')'
} elseif ($cf -like "*docker-compose.crm.yaml*") {
    $composeNote = 'COMPOSE_FILE already includes the CRM layer (unchanged)'
} else {
    if ([string]::IsNullOrWhiteSpace($sep)) { $sep = ';' }
    Set-Value 'COMPOSE_FILE' ($cf + $sep + $layer)
    $composeNote = "Existing COMPOSE_FILE kept; appended $layer using separator '$sep'"
}

[System.IO.File]::WriteAllText($EnvFile, (($lines -join "`n") + "`n"), $utf8NoBom)

# 4. Shared folder for the MCP gateway
New-Item -ItemType Directory -Force (Join-Path $dockerDir 'volumes\mcp-shared') | Out-Null

Write-Host ''
Write-Host ("Applied from crm-local.env.example : " + $(if ($applied) { $applied -join ', ' } else { '(nothing new)' }))
if ($kept) { Write-Host ("Kept your existing values for       : " + ($kept -join ', ') + "  (use -Force to overwrite)") }
Write-Host ("Generated secrets                   : " + $(if ($generated) { $generated -join ', ' } else { '(none needed)' }))
Write-Host ("Compose layering                    : " + $composeNote)
Write-Host ''
Write-Host 'Next: start llama-server (crm-local\start-llama.ps1), then `docker compose up -d` from the docker folder.'
