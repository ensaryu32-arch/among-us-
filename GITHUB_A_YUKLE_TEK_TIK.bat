@echo off
title GitHuba Yukleniyor...
echo ===================================================================
echo     GITHUBA BUTUN OYUN DOSYALARI VE RESIMLERI YUKLENIYOR...
echo ===================================================================
echo.
echo Eger ekrana GitHub giris penceresi cikarsa:
echo 'Sign in with your browser' butonuna basip onaylayin.
echo.
cd /d "%~dp0"
"C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe" push -u origin main --force
echo.
echo ===================================================================
echo   ISLEM TAMAMLANDI! Butun dosyalar GitHub deponuza yuklendi.
echo ===================================================================
pause
