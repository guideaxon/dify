<#
.SYNOPSIS
  Starts (or stops) the local llama-server instances Dify uses: chat on :8080, embeddings on :8081.

.DESCRIPTION
  Servers bind to 0.0.0.0 so Docker containers reach them via host.docker.internal.
  Chat runs with --jinja (tool calling templates) and --reasoning off by default: with thinking on,
  reasoning models spend thousands of tokens per call and can exhaust the output limit.
  Paths come from parameters, then environment variables, then (for the server binary) PATH.

.PARAMETER LlamaServer  llama-server executable.        Env: LLAMA_SERVER_EXE   (else `llama-server` on PATH)
.PARAMETER ChatModel    Chat model .gguf.                Env: LLAMA_CHAT_MODEL
.PARAMETER EmbedModel   Embedding model .gguf.           Env: LLAMA_EMBED_MODEL
.PARAMETER ChatAlias    Model name the chat server reports (use the same name in Dify). Default qwen3.5-9b
.PARAMETER EmbedAlias   Same for embeddings. Default nomic-embed-text
.PARAMETER Reasoning    off | on | auto for the chat server. Default off.
.PARAMETER Stop         Stop the servers on the two ports instead of starting them.

.EXAMPLE
  .\start-llama.ps1 -LlamaServer C:\tools\llama\llama-server.exe -ChatModel D:\models\Qwen3.5-9B-Q4_K_M.gguf -EmbedModel D:\models\nomic-embed-text-v1.5.Q4_K_M.gguf
.EXAMPLE
  .\start-llama.ps1 -Stop
#>
[CmdletBinding()]
param(
    [string]$LlamaServer = $env:LLAMA_SERVER_EXE,
    [string]$ChatModel   = $env:LLAMA_CHAT_MODEL,
    [string]$EmbedModel  = $env:LLAMA_EMBED_MODEL,
    [string]$ChatAlias   = 'qwen3.5-9b',
    [string]$EmbedAlias  = 'nomic-embed-text',
    [int]$ChatPort       = 8080,
    [int]$EmbedPort      = 8081,
    [int]$ChatContext    = 16384,
    [int]$EmbedContext   = 8192,
    [ValidateSet('off', 'on', 'auto')][string]$Reasoning = 'off',
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

function Stop-Llama([int[]]$ports) {
    foreach ($p in $ports) {
        Get-CimInstance Win32_Process -Filter "Name like 'llama-server%'" |
            Where-Object { $_.CommandLine -match "--port\s+$p(\s|$)" } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Stopped llama-server on :$p (pid $($_.ProcessId))" }
    }
}

if ($Stop) { Stop-Llama @($ChatPort, $EmbedPort); return }

if (-not $LlamaServer) {
    $cmd = Get-Command llama-server -ErrorAction SilentlyContinue
    if ($cmd) { $LlamaServer = $cmd.Source }
}
foreach ($item in @(@('LlamaServer', $LlamaServer), @('ChatModel', $ChatModel), @('EmbedModel', $EmbedModel))) {
    if (-not $item[1]) { throw "Missing -$($item[0]) (or its environment variable). See the script help: Get-Help .\start-llama.ps1 -Full" }
    if (-not (Test-Path $item[1])) { throw "$($item[0]) not found: $($item[1])" }
}

$logs = Join-Path $scriptDir 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null

function Test-Healthy([int]$port) {
    try { return (Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 2).status -eq 'ok' } catch { return $false }
}
function Start-One([string]$name, [int]$port, [string[]]$serverArgs) {
    if (Test-Healthy $port) { Write-Host "$name already healthy on :$port (left running; use -Stop first to restart)"; return }
    Start-Process $LlamaServer -WindowStyle Hidden `
        -RedirectStandardError (Join-Path $logs "$name.err.log") -RedirectStandardOutput (Join-Path $logs "$name.out.log") `
        -ArgumentList $serverArgs
}

Start-One 'chat' $ChatPort @('-m', $ChatModel, '--host', '0.0.0.0', '--port', "$ChatPort", '--jinja',
    '--reasoning', $Reasoning, '-ngl', '99', '-c', "$ChatContext", '--alias', $ChatAlias)
Start-One 'embed' $EmbedPort @('-m', $EmbedModel, '--host', '0.0.0.0', '--port', "$EmbedPort", '--embeddings',
    '-ngl', '99', '-c', "$EmbedContext", '-b', '2048', '-ub', '2048', '--alias', $EmbedAlias)

foreach ($s in @(@('chat', $ChatPort), @('embed', $EmbedPort))) {
    $deadline = (Get-Date).AddSeconds(180)
    while (-not (Test-Healthy $s[1]) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
    if (Test-Healthy $s[1]) { Write-Host "$($s[0]) ready on :$($s[1])" }
    else { Write-Warning "$($s[0]) did not become healthy on :$($s[1]); see $logs\$($s[0]).err.log" }
}
Write-Host "In Dify use http://host.docker.internal:$ChatPort/v1 (model '$ChatAlias') and http://host.docker.internal:$EmbedPort/v1 (model '$EmbedAlias')."
