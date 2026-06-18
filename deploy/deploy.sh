#!/bin/bash
# TradeTrainer 部署脚本
# 服务器: Ubuntu 22.04 (47.80.9.217)
# 域名: tradetrainer.xyz
# 代码从 GitHub 拉取，数据从本地 scp 上传

set -e

APP_DIR="/opt/tradetrainer"
REPO_URL="https://github.com/summerer3/Simulating_Trading_Training.git"
REPO_DIR="/opt/tradetrainer-repo"

echo "=== TradeTrainer 部署脚本 ==="

# 1. 安装系统依赖
echo "[1/8] 安装系统依赖..."
apt update
apt install -y python3 python3-pip python3-venv nginx git nodejs

# 2. 从 GitHub 拉取最新代码
echo "[2/8] 从 GitHub 拉取代码..."
if [ -d "$REPO_DIR/.git" ]; then
    cd $REPO_DIR
    git fetch origin
    git reset --hard origin/main
else
    git clone $REPO_URL $REPO_DIR
fi

# 3. 构建前端
echo "[3/8] 构建前端..."
cd $REPO_DIR/frontend
npm install
npm run build

# 4. 部署文件
echo "[4/8] 部署项目文件..."
mkdir -p $APP_DIR/frontend $APP_DIR/static
cp -r $REPO_DIR/backend $APP_DIR/
cp -r $REPO_DIR/frontend/dist $APP_DIR/frontend/
cp -r $REPO_DIR/deploy $APP_DIR/
# 数据目录保留（通过 scp 上传，不从 git 拉取）
mkdir -p $APP_DIR/data

# 5. 创建虚拟环境并安装依赖
echo "[5/8] 安装Python依赖..."
if [ ! -d "$APP_DIR/venv" ]; then
    python3 -m venv $APP_DIR/venv
fi
$APP_DIR/venv/bin/pip install --upgrade pip
$APP_DIR/venv/bin/pip install -r $APP_DIR/backend/requirements.txt

# 6. 配置nginx
echo "[6/8] 配置Nginx..."
cp $REPO_DIR/deploy/nginx.conf /etc/nginx/sites-available/tradetrainer
ln -sf /etc/nginx/sites-available/tradetrainer /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 7. 配置systemd服务
echo "[7/8] 配置系统服务..."
cp $REPO_DIR/deploy/tradetrainer.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable tradetrainer
systemctl restart tradetrainer

# 8. 检查状态
echo "[8/8] 检查服务状态..."
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
