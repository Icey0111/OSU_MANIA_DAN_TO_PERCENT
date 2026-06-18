@echo off
chcp 65001 >nul
title osu!mania Dan Voting - 安装

echo ================================================
echo   osu!mania Dan Voting 覆盖层安装程序
echo ================================================
echo.

REM 检查 tosu 是否在运行
tasklist /fi "imagename eq tosu.exe" 2>nul | find /i "tosu.exe" >nul
if errorlevel 1 (
    echo [警告] 未检测到 tosu 在运行
    echo 请确保 tosu 已启动，否则覆盖层不会加载。
    echo.
)

REM 自动检测 tosu 路径
set "TOSU_PATH="

REM 尝试从注册表或常见路径检测
for %%d in (
    "%APPDATA%\tosu"
    "%LOCALAPPDATA%\tosu"
    "%USERPROFILE%\tosu"
    "D:\tosu"
    "C:\tosu"
) do (
    if exist "%%~d\tosu.exe" (
        set "TOSU_PATH=%%~d"
        goto :found_tosu
    )
)

REM 未自动检测到，让用户输入
echo 未自动检测到 tosu 安装目录。
echo 请输入 tosu 的安装路径（包含 tosu.exe 的文件夹）:
echo 例如: D:\tosu  或  C:\Users\你的用户名\tosu
echo.
set /p TOSU_PATH="tosu 路径: "
goto :check_path

:found_tosu
echo 检测到 tosu: %TOSU_PATH%
echo （按 Enter 确认，或输入新路径修改）
set /p NEW_PATH="tosu 路径 [%TOSU_PATH%]: "
if not "%NEW_PATH%"=="" set "TOSU_PATH=%NEW_PATH%"

:check_path
if not exist "%TOSU_PATH%\tosu.exe" (
    echo [错误] 在 %TOSU_PATH% 中未找到 tosu.exe
    echo 请确认路径正确后重试。
    pause
    exit /b 1
)

echo.
echo 正在安装覆盖层...

REM 创建目标目录
set "DEST=%TOSU_PATH%\static\dan-voting"
if not exist "%DEST%" mkdir "%DEST%"

REM 生成唯一安装 ID (64位十六进制 = 256-bit)
set "INSTALL_FILE=%DEST%\.installation-id"
set "NEED_NEW_ID=1"
if exist "%INSTALL_FILE%" (
    set /p OLD_ID=<"%INSTALL_FILE%"
    echo %OLD_ID% | findstr /r "^[a-f0-9]\{64\}$" >nul
    if not errorlevel 1 set "NEED_NEW_ID=0"
)
if "%NEED_NEW_ID%"=="1" (
    REM 使用 PowerShell 生成随机 hex
    powershell -NoProfile -Command "$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [System.BitConverter]::ToString($bytes).Replace('-','').ToLower()" > "%TEMP%\dan_voting_id.tmp"
    set /p NEW_ID=<"%TEMP%\dan_voting_id.tmp"
    echo %NEW_ID%> "%INSTALL_FILE%"
    del "%TEMP%\dan_voting_id.tmp" 2>nul
)

REM 读取安装 ID
set /p INSTALL_ID=<"%INSTALL_FILE%"

REM 复制 HTML 并替换安装 ID 占位符
powershell -NoProfile -Command "$html = Get-Content '%~dp0dan-voting\index.html' -Raw -Encoding UTF8; $html = $html.Replace('__DAN_VOTING_INSTALLATION_ID__', '%INSTALL_ID%'); Set-Content '%DEST%\index.html' -Value $html -Encoding UTF8 -NoNewline"

REM 复制 README（如果有）
if exist "%~dp0README.txt" copy /Y "%~dp0README.txt" "%DEST%\" >nul 2>&1

echo.
echo ================================================
echo   安装完成！
echo.
echo   覆盖层 URL: http://localhost:24050/dan-voting/
echo   （在 OBS 中添加"浏览器"源，粘贴上面地址）
echo ================================================
echo.

echo 按任意键退出...
pause >nul
