# BilldDesk 静默被控端 一键卸载脚本
# 用法： powershell -ExecutionPolicy Bypass -File .\uninstall-silent.ps1
#
# 做了什么：
#   1. 删除 HKCU\...\Run 下的 BilldDeskSilent
#   2. 注销 Task Scheduler 任务 BilldDeskWatchdog
#   3. 杀掉跑着的 watchdog 进程（按 pid 文件）
#   4. 不删主程序，也不删 BilldDesk 自身的用户数据；只删心跳目录里的 pid / hb / log

[CmdletBinding()]
param(
    [string]$TaskName = 'BilldDeskWatchdog',
    [string]$RunKeyName = 'BilldDeskSilent',
    # 允许覆盖 exe 名；不传则从注册表自动推断（解决重命名 / 自定义 productName 的场景）
    [string]$ExeName = ''
)

$ErrorActionPreference = 'Continue'

$HeartbeatDir = Join-Path $env:APPDATA 'BilldDesk\silent'
$PidFile = Join-Path $HeartbeatDir 'watchdog.pid'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'

# 1. 先从注册表读 Run 项里的命令行，提取 exe basename
# 命令行形如：  "C:\Program Files\BilldDesk\BilldDesk.exe" --silent
if (-not $ExeName) {
    try {
        $runValue = (Get-ItemProperty -Path $RunKey -Name $RunKeyName -ErrorAction Stop).$RunKeyName
        if ($runValue -match '"?([^"]+\.exe)"?') {
            $ExeName = Split-Path -Leaf $Matches[1]
            Write-Host "[uninstall] 从注册表推断 ExeName=$ExeName"
        }
    } catch {
        # 注册表里读不到就回退到默认值
    }
}
if (-not $ExeName) {
    $ExeName = 'BilldDesk.exe'
    Write-Host "[uninstall] 注册表无 Run 项，回退默认 ExeName=$ExeName"
}

# 1. 杀 watchdog 进程
if (Test-Path -LiteralPath $PidFile) {
    try {
        $oldPid = [int](Get-Content -LiteralPath $PidFile -ErrorAction Stop)
        if ($oldPid -gt 0) {
            Write-Host "[uninstall] 停止 watchdog 进程 pid=$oldPid"
            Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Host "[uninstall] 读取 pid 失败：$_"
    }
}

# 2. 注销 Task Scheduler 任务
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[uninstall] 已注销任务：$TaskName"
}

# 3. 删 HKCU Run 项（$RunKey 已在脚本顶部定义）
if (Get-ItemProperty -Path $RunKey -Name $RunKeyName -ErrorAction SilentlyContinue) {
    Remove-ItemProperty -Path $RunKey -Name $RunKeyName -ErrorAction SilentlyContinue
    Write-Host "[uninstall] 已删除 HKCU Run 项：$RunKeyName"
}

# 4. 清心跳/日志文件（保留目录本身和用户其他数据）
if (Test-Path -LiteralPath $HeartbeatDir) {
    Get-ChildItem -LiteralPath $HeartbeatDir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '\.(hb|pid|log)$' } |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "[uninstall] 已清理心跳/日志：$HeartbeatDir"
}

Write-Host ""
Write-Host "===== 杀主程序进程 ====="
# 顺序：先杀 watchdog（防止它把主程序又拉起来），再杀主程序
# 上面已经按 pid 杀了 watchdog；这里按命令行特征兜底再扫一次
try {
    $escName = $ExeName.Replace("'", "''")
    Get-CimInstance Win32_Process -Filter "Name='$escName'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'watchdog\.cjs' } |
        ForEach-Object {
            Write-Host "[uninstall] 停 watchdog 进程 pid=$($_.ProcessId)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    Start-Sleep -Milliseconds 300
    Get-CimInstance Win32_Process -Filter "Name='$escName'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match '--silent' -and $_.CommandLine -notmatch 'watchdog' } |
        ForEach-Object {
            Write-Host "[uninstall] 停主程序进程 pid=$($_.ProcessId)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
} catch {
    Write-Host "[uninstall] 杀进程失败：$_"
}

Write-Host ""
Write-Host "===== 卸载完成 ====="
