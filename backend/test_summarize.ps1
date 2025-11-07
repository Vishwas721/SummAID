$body = '{}'
$uri = 'http://localhost:8001/summarize/patient_abdomen-mri-with-contrast-sample-report-1'

try {
    $result = Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -Body $body -TimeoutSec 90
    Write-Output "SUCCESS:"
    $result | ConvertTo-Json -Depth 10
} catch {
    Write-Output "ERROR:"
    Write-Output $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Output $_.ErrorDetails.Message
    }
}
