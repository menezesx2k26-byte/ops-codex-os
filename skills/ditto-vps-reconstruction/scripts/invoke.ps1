#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://[A-Za-z0-9.-]+(?:/[A-Za-z0-9._~/%-]*)?$')]
  [string]$Url
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ssh = (Get-Command 'ssh.exe' -ErrorAction Stop).Source
$key = Join-Path $HOME '.ssh\hostinger_vps_2135319_agent_ed25519'
if (-not (Test-Path -LiteralPath $key -PathType Leaf)) {
  throw "Required existing VPS SSH key is not available on this workstation."
}
$knownHostsFile = Join-Path $env:TEMP ("ditto-vps-hostkey-{0}.txt" -f $PID)
$hostRecord = '179.236.241.135 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPUajLihRZhcsbd08nhmOs9FVVPwpttrUGmS3PiWGdeg'
[System.IO.File]::WriteAllText($knownHostsFile, $hostRecord + "`n", (New-Object System.Text.UTF8Encoding($false)))
try {
  $sshArgs = @(
    '-i', $key,
    '-o', 'IdentitiesOnly=yes',
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', "UserKnownHostsFile=$knownHostsFile",
    '-o', 'GlobalKnownHostsFile=NUL',
    '-o', 'ConnectTimeout=10',
    'root@179.236.241.135',
    '/opt/ditto-vps/runner.sh',
    $Url
  )
  & $ssh @sshArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Ditto VPS runner failed with exit code $LASTEXITCODE. Check the printed preflight or job evidence."
  }
}
finally {
  Remove-Item -LiteralPath $knownHostsFile -Force -ErrorAction SilentlyContinue
}
