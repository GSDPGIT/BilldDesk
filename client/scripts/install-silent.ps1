# BilldDesk 静默被控端 一键安装脚本（自用，单机部署）
# 用法（管理员 PowerShell 推荐；普通用户也可，区别在于 Task Scheduler 触发器范围）：
#   powershell -ExecutionPolicy Bypass -File .\install-silent.ps1 -ExePath "C:\Program Files\BilldDesk\BilldDesk.exe"
#
# 做了什么：
#   1. HKCU\...\Run 写入一条 BilldDeskSilent 启动项（用户登录时拉起主程序 --silent）
#   2. 创建 Task Scheduler 任务 "BilldDeskWatchdog"，登录触发 + 每 5 分钟兜底重跑
#      (执行 electron.exe ELECTRON_RUN_AS_NODE=1 watchdog.cjs)
#   3. 创建心跳目录
#
# 卸载用 uninstall-silent.ps1

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ExePath,

    [string]$WatchdogScript = "$PSScriptRoot\watchdog.cjs",

    [string]$TaskName = 'BilldDeskWatchdog',

    [string]$RunKeyName = 'BilldDeskSilent'
)

$ErrorActionPreference = 'Stop'

# 1. 基础校验
if (-not (Test-Path -LiteralPath $ExePath)) {
    Write-Error "ExePath 不存在: $ExePath"
    exit 1
}
if (-not (Test-Path -LiteralPath $WatchdogScript)) {
    Write-Error "watchdog.cjs 不存在: $WatchdogScript"
    exit 1
}

$ExePath        = (Resolve-Path -LiteralPath $ExePath).Path
$WatchdogScript = (Resolve-Path -LiteralPath $WatchdogScript).Path
$HeartbeatDir   = Join-Path $env:APPDATA 'BilldDesk\silent'

Write-Host "[install] ExePath        = $ExePath"
Write-Host "[install] WatchdogScript = $WatchdogScript"
Write-Host "[install] HeartbeatDir   = $HeartbeatDir"

# 2. 创建心跳目录
if (-not (Test-Path -LiteralPath $HeartbeatDir)) {
    New-Item -ItemType Directory -Path $HeartbeatDir -Force | Out-Null
}

# 3. 写 HKCU Run 项（开机登录自启主程序）
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunValue = "`"$ExePath`" --silent"
Set-ItemProperty -Path $RunKey -Name $RunKeyName -Value $RunValue -Type String
Write-Host "[install] HKCU Run 已写入：$RunKeyName = $RunValue"

# 4. 写一个 wrapper .cmd 来设置环境变量并启动 watchdog
# 比 cmd /c set X=Y && ... 的字符串拼接更安全（不受路径中的空格 / & / % 影响）
$WrapperCmd = Join-Path $HeartbeatDir 'run-watchdog.cmd'
# 用 PowerShell 的 here-string 生成 .cmd 内容；路径全部加双引号，cmd 的 set 接受
$wrapperContent = @"
@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
set "BILLD_APP_EXE=$ExePath"
set "BILLD_SILENT_FLAG=--silent"
set "BILLD_HEARTBEAT_DIR=$HeartbeatDir"
set "BILLD_APP_HEARTBEAT=$HeartbeatDir\app.hb"
set "BILLD_RENDERER_HEARTBEAT=$HeartbeatDir\renderer.hb"
set "BILLD_WATCHDOG_HEARTBEAT=$HeartbeatDir\watchdog.hb"
set "BILLD_WATCHDOG_PID_FILE=$HeartbeatDir\watchdog.pid"
"$ExePath" "$WatchdogScript"
endlocal
"@
Set-Content -LiteralPath $WrapperCmd -Value $wrapperContent -Encoding ASCII
Write-Host "[install] 生成 wrapper：$WrapperCmd"

# 登录触发 + 每 5 分钟兜底（防止 watchdog 自己崩了）
$trigger1 = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 365)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

$wdAction = New-ScheduledTaskAction -Execute $WrapperCmd `
    -WorkingDirectory (Split-Path -Parent $WrapperCmd)

# 先注销已存在同名任务
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $wdAction `
    -Trigger @($trigger1, $trigger2) `
    -Settings $settings `
    -Principal $principal `
    -Description 'BilldDesk 静默被控端守护进程（自用）' | Out-Null

Write-Host "[install] Task Scheduler 已注册任务：$TaskName"

# 5. 立刻启一次主程序（不等到下次登录）
Start-Process -FilePath $ExePath -ArgumentList '--silent' -WindowStyle Hidden
Write-Host "[install] 已启动主程序（静默）"

# 6. 立刻启一次 watchdog
Start-ScheduledTask -TaskName $TaskName
Write-Host "[install] 已启动 watchdog"

Write-Host ""
Write-Host "===== 安装完成 ====="
Write-Host "查看心跳：           Get-ChildItem '$HeartbeatDir'"
Write-Host "查看 watchdog 日志： Get-Content '$HeartbeatDir\watchdog.log' -Tail 30"
Write-Host "卸载：               powershell -ExecutionPolicy Bypass -File .\uninstall-silent.ps1"
