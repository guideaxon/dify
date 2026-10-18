<#
.SYNOPSIS
  Text-to-speech with the built-in Windows voices (System.Speech / SAPI). Offline, no installs.

.DESCRIPTION
  Reads a JSON file of jobs ([{ "text": "...", "out": "path.wav" }, ...]) and writes one WAV per job.
  Existing output files are skipped, so re-running only synthesizes new or changed lines.

.PARAMETER Jobs   Path to the JSON job list.
.PARAMETER Voice  Installed voice name. Default 'Microsoft Zira Desktop'. List voices with -List.
.PARAMETER Rate   -10 (slow) .. 10 (fast). Default -1: slightly slower than normal, easier to follow.
.PARAMETER List   List installed voices and exit.
#>
[CmdletBinding()]
param(
    [string]$Jobs,
    [string]$Voice = 'Microsoft Zira Desktop',
    [int]$Rate = -1,
    [switch]$List
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

if ($List) {
    $synth.GetInstalledVoices() | ForEach-Object { $v = $_.VoiceInfo; "{0} | {1} | {2}" -f $v.Name, $v.Culture, $v.Gender }
    return
}
if (-not $Jobs) { throw 'Missing -Jobs' }

$installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if ($installed -notcontains $Voice) { throw "Voice '$Voice' not installed. Installed: $($installed -join ', ')" }
$synth.SelectVoice($Voice)
$synth.Rate = $Rate

$items = [System.IO.File]::ReadAllText($Jobs) | ConvertFrom-Json
$made = 0
foreach ($item in $items) {
    if (Test-Path $item.out) { continue }
    New-Item -ItemType Directory -Force (Split-Path -Parent $item.out) | Out-Null
    # Write to a temporary name and rename when finished, so an interrupted run never leaves a truncated
    # clip under the real name (it would be skipped as "already present" on every later run).
    $tmp = $item.out + '.part'
    Remove-Item $tmp -ErrorAction SilentlyContinue
    try {
        $synth.SetOutputToWaveFile($tmp)
        $synth.Speak([string]$item.text)
        $synth.SetOutputToNull()
        Move-Item -Force $tmp $item.out
        $made++
    } catch {
        try { $synth.SetOutputToNull() } catch {}
        Remove-Item $tmp -ErrorAction SilentlyContinue
        throw
    }
}
$synth.Dispose()
"synthesized $made clip(s), $(@($items).Count - $made) already present"
