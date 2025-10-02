@echo off
echo Creating Supabase-enabled package...
echo.

REM Create timestamp for filename
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do if "%%I" neq "" set datetime=%%I
set timestamp=%datetime:~0,8%-%datetime:~8,6%

REM Create package name
set packagename=Clean-site-supabase-%timestamp%

echo Package name: %packagename%.zip
echo.

REM Check if 7zip is available
where 7z >nul 2>nul
if %errorlevel% equ 0 (
    echo Using 7zip to create package...
    7z a -tzip "%packagename%.zip" * -x!*.zip -x!package.bat -x!*.log
) else (
    echo 7zip not found. Please manually zip all files except .zip, .bat, and .log files
    echo Package would be named: %packagename%.zip
)

echo.
echo Package created! Contents include:
echo - Pre-configured Supabase credentials
echo - Login page (login.html)
echo - Logout functionality in headers
echo - Auto-read SKU/Qty/Size from page inputs
echo - All original functionality maintained
echo.
echo Ready to deploy to your hosting platform!
pause