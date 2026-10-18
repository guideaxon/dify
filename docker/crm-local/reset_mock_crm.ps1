# Restores the mock CRM to its seed state (discards activities logged by workflows).
# Run before each recording take. Works whether or not the server is running.
$log = Join-Path $PSScriptRoot "mock_crm_log.jsonl"
Remove-Item $log -ErrorAction SilentlyContinue
try { Invoke-RestMethod -Method Post http://localhost:8090/crm/reset | Out-Null } catch {}
"Mock CRM reset to seed data."
