@echo off
REM TradeTrainer 数据上传脚本 (Windows -> 服务器)
REM 代码通过 GitHub 拉取，此脚本仅上传数据文件
REM 前提：安装了 OpenSSH 客户端 (Windows 10/11 自带)

set SERVER=root@47.80.9.217
set APP_DIR=/opt/tradetrainer
set LOCAL_DIR=%~dp0..

echo === TradeTrainer 数据上传 ===
echo 目标服务器: %SERVER%
echo.

REM 上传数据文件
echo [1/2] 上传数据文件 (parquet)...
ssh %SERVER% "mkdir -p %APP_DIR%/data"
scp -r "%LOCAL_DIR%\data\*" %SERVER%:%APP_DIR%/data/

REM 上传后端数据缓存（如有）
echo [2/2] 上传后端数据缓存...
ssh %SERVER% "mkdir -p %APP_DIR%/backend/data"
scp -r "%LOCAL_DIR%\backend\data\*" %SERVER%:%APP_DIR%/backend/data/

echo.
echo === 数据上传完成！===
echo.
echo 代码部署请在服务器执行：
echo   ssh %SERVER%
echo   bash /opt/tradetrainer-repo/deploy/deploy.sh
echo.
pause
