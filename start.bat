@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title 原型机模拟器

where node >nul 2>&1
if errorlevel 1 (
  echo 没有找到 Node.js。请先安装 https://nodejs.org 后再双击本文件。
  pause
  exit /b 1
)

if not exist node_modules\ (
  echo 正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败。
    pause
    exit /b 1
  )
)

if not exist compiler\build\radixcc.exe (
  echo 正在构建汇编器...
  set "GPP="
  where g++ >nul 2>&1 && set "GPP=g++"
  if "!GPP!"=="" if exist "D:\Program Files (x86)\msys64\ucrt64\bin\g++.exe" set "GPP=D:\Program Files (x86)\msys64\ucrt64\bin\g++.exe"
  if "!GPP!"=="" if exist "C:\msys64\ucrt64\bin\g++.exe" set "GPP=C:\msys64\ucrt64\bin\g++.exe"
  if "!GPP!"=="" (
    echo 没有找到 g++。页面可以打开，但装入程序会失败。
  ) else (
    if not exist compiler\build mkdir compiler\build
    "!GPP!" -std=c++20 -O2 -I compiler\src -o compiler\build\radixcc.exe compiler\src\main.cpp compiler\src\trit.cpp compiler\src\setun.cpp compiler\src\setun70.cpp compiler\src\eniac.cpp compiler\src\ibm650.cpp compiler\src\ibm1401.cpp
    if errorlevel 1 (
      echo 汇编器构建失败。
      pause
      exit /b 1
    )
  )
)

echo 开发服务器：http://127.0.0.1:43127
echo 关闭本窗口即可停止。
start "" powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 90;$i++){ try { Invoke-WebRequest http://127.0.0.1:43127 -UseBasicParsing -TimeoutSec 5 | Out-Null; Start-Process http://127.0.0.1:43127; exit 0 } catch { Start-Sleep -Seconds 1 } }"
call npm run dev
if errorlevel 1 pause
