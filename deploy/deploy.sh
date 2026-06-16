#!/bin/bash
# TradeTrainer 部署脚本
# 服务器: Ubuntu 22.04 (47.80.9.217)
# 域名: tradetrainer.xyz

set -e

APP_DIR="/opt/tradetrainer"
DEPLOY_SRC="/opt/tradetrainer-deploy"

echo "=== TradeTrainer 部署脚本 ==="

# 1. 安装系统依赖
echo "[1/7] 安装系统依赖..."
apt update
apt install -y python3 python3-pip python3-venv nginx

# 2. 创建项目目录
echo "[2/7] 创建项目目录..."
mkdir -p $APP_DIR

# 3. 复制文件
echo "[3/7] 复制项目文件..."
cp -r $DEPLOY_SRC/backend $APP_DIR/
mkdir -p $APP_DIR/frontend
cp -r $DEPLOY_SRC/frontend_dist $APP_DIR/frontend/dist
cp -r $DEPLOY_SRC/data $APP_DIR/
mkdir -p $APP_DIR/static

# 4. 创建虚拟环境并安装依赖
echo "[4/7] 安装Python依赖..."
python3 -m venv $APP_DIR/venv
$APP_DIR/venv/bin/pip install --upgrade pip
$APP_DIR/venv/bin/pip install -r $APP_DIR/backend/requirements.txt

# 5. 配置nginx
echo "[5/7] 配置Nginx..."
cp $DEPLOY_SRC/deploy/nginx.conf /etc/nginx/sites-available/tradetrainer
ln -sf /etc/nginx/sites-available/tradetrainer /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 6. 配置systemd服务
echo "[6/7] 配置系统服务..."
cp $DEPLOY_SRC/deploy/tradetrainer.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable tradetrainer
systemctl restart tradetrainer

# 7. 检查状态
echo "[7/7] 检查服务状态..."
sleep 2
systemctl status tradetrainer --no-pager

echo ""
echo "=== 部署完成！==="
echo "请确保域名 tradetrainer.xyz 的 A 记录指向 47.80.9.217"
echo "访问: http://tradetrainer.xyz"
echo ""
echo "可选：安装SSL证书（推荐）:"
echo "  apt install certbot python3-certbot-nginx"
echo "  certbot --nginx -d tradetrainer.xyz -d www.tradetrainer.xyz"
