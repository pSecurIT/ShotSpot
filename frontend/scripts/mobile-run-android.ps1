param(
  [string]$AvdName = "Medium_Phone_API_36.1",
  [switch]$NoSync
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -ge 7) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Test-JdkHome {
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $false
  }

  $javaExe = Join-Path $Path "bin\java.exe"
  $jvmCfg = Join-Path $Path "lib\jvm.cfg"
  return (Test-Path $javaExe) -and (Test-Path $jvmCfg)
}

function Add-PathPrefix {
  param([string]$Prefix)

  if ([string]::IsNullOrWhiteSpace($Prefix)) {
    return
  }

  $parts = @($env:PATH -split ';' | Where-Object { $_ -and $_.Trim().Length -gt 0 })
  if ($parts -contains $Prefix) {
    return
  }

  $env:PATH = "$Prefix;$env:PATH"
}

function Invoke-AdbCapture {
  param([string[]]$Args)

  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"

  try {
    $output = & adb @Args 2>$null
    return @{
      ExitCode = $LASTEXITCODE
      Output = $output
    }
  } finally {
    $ErrorActionPreference = $previousErrorPreference
  }
}

function Get-EmulatorSerial {
  $result = Invoke-AdbCapture -Args @('devices')
  if ($result.ExitCode -ne 0) {
    return $null
  }

  $deviceLines = $result.Output
  if (-not $deviceLines) {
    return $null
  }

  $serials = @()
  foreach ($line in $deviceLines) {
    if ($line -match '^(emulator-\d+)\s+(device|offline|authorizing)$') {
      $serials += $matches[1]
    }
  }

  if ($serials.Count -gt 0) {
    return $serials[0]
  }

  return $null
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Resolve-Path (Join-Path $scriptDir "..")

$sdkCandidates = @()
if ($env:ANDROID_HOME) { $sdkCandidates += $env:ANDROID_HOME }
if ($env:ANDROID_SDK_ROOT) { $sdkCandidates += $env:ANDROID_SDK_ROOT }
$sdkCandidates += @(
  (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
  "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
)

$androidSdk = $sdkCandidates | Where-Object { Test-Path (Join-Path $_ "platform-tools\adb.exe") } | Select-Object -First 1
if (-not $androidSdk) {
  throw "Unable to locate Android SDK with platform-tools. Set ANDROID_HOME first."
}

$jdkCandidates = @()
if ($env:JAVA_HOME) { $jdkCandidates += $env:JAVA_HOME }
$jdkCandidates += @(
  "C:\Program Files\Android\Android Studio1\jbr",
  "C:\Program Files\Android\Android Studio\jbr"
)

$javaHome = $jdkCandidates | Where-Object { Test-JdkHome $_ } | Select-Object -First 1
if (-not $javaHome) {
  throw "Unable to locate a valid Java runtime (jvm.cfg missing). Set JAVA_HOME first."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk

Add-PathPrefix (Join-Path $env:JAVA_HOME "bin")
Add-PathPrefix (Join-Path $env:ANDROID_HOME "platform-tools")

Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
Write-Host "Using ANDROID_HOME=$env:ANDROID_HOME"

adb start-server | Out-Null

$emulatorSerial = Get-EmulatorSerial
if (-not $emulatorSerial) {
  $existingEmulatorProcess = Get-Process -Name "emulator" -ErrorAction SilentlyContinue | Select-Object -First 1

  if ($existingEmulatorProcess) {
    Write-Host "Emulator process already running. Waiting for adb connection..."
  } else {
  $emulatorExe = Join-Path $env:ANDROID_HOME "emulator\emulator.exe"
  if (-not (Test-Path $emulatorExe)) {
    throw "Unable to locate emulator executable at $emulatorExe"
  }

  Write-Host "Starting emulator $AvdName..."
  Start-Process -FilePath $emulatorExe -ArgumentList "-avd $AvdName -no-snapshot-load -no-boot-anim -gpu host" | Out-Null
  }
}

$timeoutAt = (Get-Date).AddMinutes(3)
$emulatorReady = $false
while ((Get-Date) -lt $timeoutAt) {
  $emulatorSerial = Get-EmulatorSerial
  if (-not $emulatorSerial) {
    Start-Sleep -Seconds 3
    continue
  }

  $stateResult = Invoke-AdbCapture -Args @('-s', $emulatorSerial, 'get-state')
  $bootResult = Invoke-AdbCapture -Args @('-s', $emulatorSerial, 'shell', 'getprop', 'sys.boot_completed')
  if ($stateResult.ExitCode -ne 0 -or $bootResult.ExitCode -ne 0) {
    Start-Sleep -Seconds 3
    continue
  }

  $state = (($stateResult.Output | Select-Object -First 1) | Out-String).Trim()
  $boot = (($bootResult.Output | Select-Object -First 1) | Out-String).Trim()

  if ($state -eq "device" -and $boot -eq "1") {
    $emulatorReady = $true
    Write-Host "Emulator ready ($emulatorSerial)."
    break
  }

  Start-Sleep -Seconds 3
}

if (-not $emulatorReady) {
  throw "Emulator was detected but did not reach ready state within timeout."
}

if (-not $emulatorSerial) {
  $emulatorSerial = Get-EmulatorSerial
}

if (-not $emulatorSerial) {
  throw "No Android emulator detected after startup timeout."
}

Set-Location $frontendDir

if ($NoSync) {
  npx cap run android --no-sync --target $emulatorSerial
} else {
  npm run mobile:sync
  npx cap run android --no-sync --target $emulatorSerial
}
