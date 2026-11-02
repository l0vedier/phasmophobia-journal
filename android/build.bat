@echo off
setlocal
cd /d "%~dp0"

set SDK=E:\Android\Sdk
set BT=%SDK%\build-tools\34.0.0
set AJAR=%SDK%\platforms\android-34\android.jar

if not exist "%BT%\aapt2.exe" (
    echo [ERROR] build-tools not found: %BT%
    pause
    exit /b 1
)

echo [1/6] clean
if exist build rmdir /s /q build
mkdir build\gen
mkdir build\classes
mkdir build\dex

echo [2/6] aapt2 compile
"%BT%\aapt2.exe" compile --dir res -o build\res.zip
if errorlevel 1 goto :err

echo [3/6] aapt2 link
"%BT%\aapt2.exe" link -o build\app-unsigned.apk -I "%AJAR%" --manifest AndroidManifest.xml -A "..\mobile" --java build\gen build\res.zip
if errorlevel 1 goto :err

echo [4/6] javac
javac --release 8 -encoding UTF-8 -cp "%AJAR%" -d build\classes build\gen\com\phasmo\journal\R.java src\com\phasmo\journal\MainActivity.java
if errorlevel 1 goto :err

echo [5/6] d8
call "%BT%\d8.bat" --release --lib "%AJAR%" --min-api 21 --output build\dex build\classes\com\phasmo\journal\*.class
if errorlevel 1 goto :err

python -c "import zipfile,shutil; shutil.copyfile('build/app-unsigned.apk','build/app-with-dex.apk'); z=zipfile.ZipFile('build/app-with-dex.apk','a',zipfile.ZIP_DEFLATED); z.write('build/dex/classes.dex','classes.dex'); z.close()"
if errorlevel 1 goto :err

echo [6/6] align + sign
"%BT%\zipalign.exe" -f -p 4 build\app-with-dex.apk build\app-aligned.apk
if errorlevel 1 goto :err
set KS_PASS=
if exist keystore\pass.txt set /p KS_PASS=<keystore\pass.txt
if not defined KS_PASS (
    echo [ERROR] keystore\pass.txt missing - put the keystore password in it
    pause
    exit /b 1
)
call "%BT%\apksigner.bat" sign --ks keystore\journal.keystore --ks-key-alias journal --ks-pass pass:%KS_PASS% --key-pass pass:%KS_PASS% --out app-release.apk build\app-aligned.apk
if errorlevel 1 goto :err

python -c "import os; os.replace('app-release.apk', '\u6050\u9b3c\u75c7\u7b14\u8bb0.apk')"

echo.
echo [DONE] APK ready: %~dp0
dir /b *.apk
pause
exit /b 0

:err
echo.
echo [FAILED] see messages above
pause
exit /b 1
