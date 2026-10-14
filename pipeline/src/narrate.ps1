param([Parameter(Mandatory=$true)][string]$JobsPath)
$ErrorActionPreference = 'Stop'
$taskVoice = New-Object -ComObject SAPI.SpVoice
$taskVoices = $taskVoice.GetVoices()
$taskSelectedVoice = @($taskVoices | Where-Object { $_.GetDescription() -like '*Zira*' })[0]
if (-not $taskSelectedVoice) { throw 'The prepared narrator needs Microsoft Zira Desktop installed locally.' }
$taskVoice.Voice = $taskSelectedVoice
$taskVoice.Rate = 0
$taskJobs = Get-Content -LiteralPath $JobsPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($taskJob in $taskJobs) {
  $taskStream = New-Object -ComObject SAPI.SpFileStream
  try {
    $taskStream.Open($taskJob.wav, 3, $false)
    $taskVoice.AudioOutputStream = $taskStream
    [void]$taskVoice.Speak($taskJob.text)
  } finally { $taskStream.Close() }
}
Write-Output $taskSelectedVoice.GetDescription()
