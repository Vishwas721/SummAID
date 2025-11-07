# Verifies local Ollama embed and generate endpoints
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File ./verify_ollama.ps1

param(
  [string]$EmbedModel = "nomic-embed-text",
  [string]$GenModel = "llama3:8b",
  [string]$Prompt = "hello world"
)

Write-Host "=== Verifying Ollama Endpoints ===" -ForegroundColor Cyan
Write-Host "Embed model: $EmbedModel" -ForegroundColor Yellow
Write-Host "Gen model:   $GenModel" -ForegroundColor Yellow

# ---------- Embed Test ----------
$embedPayload = @{ model = $EmbedModel; input = $Prompt } | ConvertTo-Json
try {
  $embedResp = Invoke-RestMethod -Method Post -Uri http://localhost:11434/api/embed -Body $embedPayload -ContentType 'application/json'
} catch {
  Write-Error "Embed request failed: $($_.Exception.Message)"; exit 1
}

$dim = $null
if ($embedResp.PSObject.Properties.Name -contains 'embedding') {
  $dim = $embedResp.embedding.Count
} elseif ($embedResp.PSObject.Properties.Name -contains 'embeddings') {
  $dim = $embedResp.embeddings[0].Count
} else {
  Write-Error "Unexpected embed response keys: $($embedResp.PSObject.Properties.Name -join ', ')"; exit 1
}
Write-Host "Embed OK. Dimension: $dim" -ForegroundColor Green

# ---------- Generate Test ----------
$genPrompt = "Summarize: $Prompt"
$genPayload = @{ model = $GenModel; prompt = $genPrompt; stream = $false } | ConvertTo-Json
try {
  $genResp = Invoke-RestMethod -Method Post -Uri http://localhost:11434/api/generate -Body $genPayload -ContentType 'application/json'
} catch {
  Write-Error "Generate request failed: $($_.Exception.Message)"; exit 1
}

$responseText = $genResp.response
if (-not $responseText) { $responseText = $genResp.output }
if (-not $responseText) {
  Write-Error "Unexpected generate response keys: $($genResp.PSObject.Properties.Name -join ', ')"; exit 1
}

Write-Host "Generate OK. Sample output:" -ForegroundColor Green
$responseText.Substring(0, [Math]::Min($responseText.Length, 220))

Write-Host "\nAll checks passed." -ForegroundColor Cyan
