@echo off
REM TradeTrainer 上传脚本 (Windows -> 服务器)
REM 使用 scp 将项目文件传输到服务器
REM 前提：安装了 OpenSSH 客户端 (Windows 10/11 自带)

set SERVER=root@47.80.9.217
set REMOTE_DIR=/opt/tradetrainer-deploy
set LOCAL_DIR=%~dp0..

echo === TradeTrainer 文件上传 ===
echo 目标服务器: %SERVER%
echo.

REM 在服务器上创建目录
echo [1/5] 创建远程目录...
ssh %SERVER% "mkdir -p %REMOTE_DIR%"

REM 上传后端代码
echo [2/5] 上传后端代码...
scp -r "%LOCAL_DIR%\backend" %SERVER%:%REMOTE_DIR%/

REM 上传前端构建产物
echo [3/5] 上传前端构建产物...
scp -r "%LOCAL_DIR%\frontend\dist" %SERVER%:%REMOTE_DIR%/frontend_dist/

REM 上传数据文件
echo [4/5] 上传数据文件 (parquet)...
scp -r "%LOCAL_DIR%\data" %SERVER%:%REMOTE_DIR%/

REM 上传部署配置
echo [5/5] 上传部署配置...
scp -r "%LOCAL_DIR%\deploy" %SERVER%:%REMOTE_DIR%/

echo.
echo === 上传完成！===
echo.
echo 接下来SSH登录服务器执行部署：
echo   ssh %SERVER%
echo   cd %REMOTE_DIR%
echo   chmod +x deploy/deploy.sh
echo   bash deploy/deploy.sh
echo.
pause
