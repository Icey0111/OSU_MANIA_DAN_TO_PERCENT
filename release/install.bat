@echo off
setlocal EnableExtensions
title osu!mania Dan Voting Installer

echo ================================================
echo   osu!mania Dan Voting Overlay Installer
echo ================================================
echo.

tasklist /fi "imagename eq tosu.exe" 2>nul | find /i "tosu.exe" >nul
if errorlevel 1 (
    echo [WARNING] tosu does not appear to be running.
    echo Start tosu before opening the installed overlay.
    echo.
)

set "TOSU_PATH="
for %%D in (
    "%APPDATA%\tosu"
    "%LOCALAPPDATA%\tosu"
    "%USERPROFILE%\tosu"
    "D:\tosu"
    "C:\tosu"
) do (
    if exist "%%~D\tosu.exe" (
        set "TOSU_PATH=%%~D"
        goto :found_tosu
    )
)

echo tosu was not detected automatically.
echo Enter the folder that contains tosu.exe.
echo Example: D:\tosu
echo.
set /p TOSU_PATH="tosu path: "
goto :check_path

:found_tosu
echo Detected tosu: %TOSU_PATH%
set "NEW_PATH="
set /p NEW_PATH="Press Enter to accept, or enter another path: "
if defined NEW_PATH set "TOSU_PATH=%NEW_PATH%"

:check_path
if not exist "%TOSU_PATH%\tosu.exe" (
    echo [ERROR] tosu.exe was not found in: %TOSU_PATH%
    pause
    exit /b 1
)

set "DEST=%TOSU_PATH%\static\dan-voting"
if not exist "%DEST%" mkdir "%DEST%"
if errorlevel 1 (
    echo [ERROR] Failed to create: %DEST%
    pause
    exit /b 1
)

set "INSTALL_FILE=%DEST%\.installation-id"
set "DAN_VOTING_INSTALL_FILE=%INSTALL_FILE%"
set "NEED_NEW_ID=1"
if exist "%INSTALL_FILE%" (
    powershell -NoProfile -Command "$id = (Get-Content -LiteralPath $env:DAN_VOTING_INSTALL_FILE -Raw).Trim(); if ($id -notmatch '^[a-f0-9]{64}$') { exit 1 }" >nul 2>&1
    if not errorlevel 1 set "NEED_NEW_ID=0"
)

if "%NEED_NEW_ID%"=="1" (
    powershell -NoProfile -Command "$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); $id = [System.BitConverter]::ToString($bytes).Replace('-','').ToLower(); [System.IO.File]::WriteAllText($env:DAN_VOTING_INSTALL_FILE, $id)"
    if errorlevel 1 (
        echo [ERROR] Failed to generate the installation ID.
        pause
        exit /b 1
    )
)

set /p INSTALL_ID=<"%INSTALL_FILE%"
set "DAN_VOTING_INSTALL_ID=%INSTALL_ID%"
powershell -NoProfile -Command "if ($env:DAN_VOTING_INSTALL_ID -notmatch '^[a-f0-9]{64}$') { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] The installation ID is invalid.
    pause
    exit /b 1
)

set "DAN_VOTING_SOURCE_HTML=%~dp0dan-voting\index.html"
set "DAN_VOTING_DEST_HTML=%DEST%\index.html"
powershell -NoProfile -Command "$html = Get-Content -LiteralPath $env:DAN_VOTING_SOURCE_HTML -Raw -Encoding UTF8; $html = $html.Replace('__DAN_VOTING_INSTALLATION_ID__', $env:DAN_VOTING_INSTALL_ID); Set-Content -LiteralPath $env:DAN_VOTING_DEST_HTML -Value $html -Encoding UTF8 -NoNewline"
if errorlevel 1 (
    echo [ERROR] Failed to write the overlay HTML.
    pause
    exit /b 1
)

if exist "%~dp0dan-voting\icons" (
    xcopy /E /I /Y "%~dp0dan-voting\icons" "%DEST%\icons" >nul
    if errorlevel 1 (
        echo [ERROR] Failed to copy rank icons.
        pause
        exit /b 1
    )
)

if exist "%~dp0README.txt" copy /Y "%~dp0README.txt" "%DEST%\" >nul 2>&1
if exist "%~dp0PRIVACY.txt" copy /Y "%~dp0PRIVACY.txt" "%DEST%\" >nul 2>&1

echo.
echo ================================================
echo   Installation complete
echo.
echo   Overlay URL: http://localhost:24050/dan-voting/
echo ================================================
echo.
pause
endlocal
exit /b 0
