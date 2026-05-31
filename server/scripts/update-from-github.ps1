# BilldDesk Server 更新脚本（拉最新代码 + 重建表 + 重启 PM2）
# 用法：在服务端管理员 PowerShell 跑：
#   powershell -NoExit -ExecutionPolicy Bypass -File C:\update-server.ps1

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
} catch {}
Add-Type -AssemblyName System.IO.Compression.FileSystem

$log = "C:\billd-update.txt"
try { Stop-Transcript | Out-Null } catch {}
Start-Transcript -Path $log -Force | Out-Null

function Log($msg) { Write-Output $msg }
Log "===== BilldDesk Server 更新 ====="
Log "时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$projRoot = "C:\www\BilldDesk"
$serverDir = "$projRoot\server"
$secretBackup = "$env:TEMP\billd-secret-backup.ts"

# 备份 secret.ts（很重要，gitignored 不会被覆盖，但保险起见）
if (Test-Path "$serverDir\src\secret\secret.ts") {
    Copy-Item "$serverDir\src\secret\secret.ts" $secretBackup -Force
    Log "[OK] secret.ts 已备份到 $secretBackup"
}

# PATH
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

# 下载最新代码（用 GitHub 镜像）
$zip = "C:\www\billd-new.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

$urls = @(
    "https://gh-proxy.com/https://github.com/GSDPGIT/BilldDesk/archive/refs/heads/main.zip",
    "https://mirror.ghproxy.com/https://github.com/GSDPGIT/BilldDesk/archive/refs/heads/main.zip",
    "https://ghproxy.net/https://github.com/GSDPGIT/BilldDesk/archive/refs/heads/main.zip",
    "https://github.com/GSDPGIT/BilldDesk/archive/refs/heads/main.zip"
)
$ok = $false
Log ""
Log "===== 1. 下载最新代码 ====="
foreach ($u in $urls) {
    Log "  尝试: $u"
    try {
        Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing -TimeoutSec 120
        if ((Get-Item $zip).Length -gt 10000) {
            $ok = $true
            Log "  [OK] 下载成功"
            break
        }
    } catch {
        Log "  [FAIL] $($_.Exception.Message)"
    }
}
if (-not $ok) {
    Log "[FATAL] 所有源都失败"
    Stop-Transcript | Out-Null
    Start-Process notepad.exe $log
    return
}

# 解压到 temp，再覆盖 server/
Log ""
Log "===== 2. 解压 + 覆盖 ====="
$tempExtract = "C:\www\billd-new"
if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
[System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $tempExtract)
# 拷贝 server/ 内容（不删 node_modules / dist / secret.ts）
$newServer = Get-ChildItem $tempExtract -Directory | Select-Object -First 1
$newServer = "$($newServer.FullName)\server"
# 只覆盖源码 + 配置，不动 node_modules / dist
robocopy $newServer $serverDir /E /MT:8 /NFL /NDL /NJH /NJS /NC /NS /XD node_modules dist /XF secret.ts | Out-Null
Log "  [OK] 代码覆盖完成"
Remove-Item $zip -Force
Remove-Item $tempExtract -Recurse -Force

# 恢复 secret.ts（如果意外被覆盖）
if ((Test-Path $secretBackup) -and -not (Test-Path "$serverDir\src\secret\secret.ts")) {
    Copy-Item $secretBackup "$serverDir\src\secret\secret.ts" -Force
    Log "[OK] secret.ts 已恢复"
}

Set-Location $serverDir

# 装新增的依赖（如果有）
Log ""
Log "===== 3. pnpm install (增量) ====="
$inst = & pnpm install --ignore-scripts 2>&1
$inst | Select-Object -Last 10 | ForEach-Object { Log "  $_" }

# 重新编译
Log ""
Log "===== 4. pnpm build ====="
$bd = & pnpm run build 2>&1
$bd | Select-Object -Last 10 | ForEach-Object { Log "  $_" }
if (-not (Test-Path "$serverDir\dist\index.js")) {
    Log "[FATAL] 构建失败"
    Stop-Transcript | Out-Null
    Start-Process notepad.exe $log
    return
}
Log "  [OK] 编译完成"

# 重新建表（包括新增的 agents 表）
Log ""
Log "===== 5. 同步数据库表 (sync alter) ====="
if (Test-Path "$serverDir\init-db.js") {
    $initProc = Start-Process node -ArgumentList "init-db.js" -WorkingDirectory $serverDir -PassThru -NoNewWindow -RedirectStandardOutput "$serverDir\init.out.log" -RedirectStandardError "$serverDir\init.err.log"
    if (-not $initProc.WaitForExit(180000)) {
        try { $initProc.Kill() } catch {}
    }
    Get-Content "$serverDir\init.out.log" -ErrorAction SilentlyContinue | Select-Object -Last 20 | ForEach-Object { Log "    $_" }
} else {
    Log "  [WARN] init-db.js 不存在，手动建表"
}

# 重启 PM2
Log ""
Log "===== 6. 重启 PM2 ====="
& pm2 reload billd-desk-server 2>&1 | ForEach-Object { Log "  $_" }
& pm2 save 2>&1 | Out-Null
Start-Sleep -Seconds 3
$port = Get-NetTCPConnection -LocalPort 4200 -ErrorAction SilentlyContinue | Where-Object State -eq Listen
if ($port) {
    Log "  [OK] 4200 监听中"
    try {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:4200/" -UseBasicParsing -TimeoutSec 5
        Log "  [OK] 响应: $($resp.Content)"
    } catch {
        Log "  [WARN] 本地自测失败: $_"
    }
} else {
    Log "  [FAIL] 4200 没起来"
    & pm2 logs billd-desk-server --lines 20 --nostream 2>&1 | ForEach-Object { Log "    $_" }
}

Log ""
Log "===== 完成 ====="
Log "测试 agent API:"
Log "  Invoke-WebRequest -Uri https://api.xx10086.com:8443/agent/list -Headers @{'X-Agent-Key'='c6aed1f8702016f298c7bb3dda70269379a663e97f1d0c8e3e15a2825a6fa1a5'} -SkipCertificateCheck | Select-Object -ExpandProperty Content"
Log ""
Log "日志: $log"

Stop-Transcript | Out-Null
Start-Process notepad.exe $log
