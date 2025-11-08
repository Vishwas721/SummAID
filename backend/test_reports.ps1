$patient = 'patient_abdomen-mri-with-contrast-sample-report-1'
$uri = "http://localhost:8001/reports/$patient"

try {
    $result = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 30
    Write-Output "SUCCESS:"
    $count = ($result | Measure-Object).Count
    Write-Output ("reports: {0}" -f $count)
    $result | ConvertTo-Json -Depth 10
} catch {
    Write-Output "ERROR:"
    Write-Output $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Output $_.ErrorDetails.Message
    }
}
