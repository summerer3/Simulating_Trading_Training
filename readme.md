# A股模拟交易训练系统

## 功能概述

一个针对A股的模拟交易训练网站，使用2006-2026年的日线历史数据，帮助用户练习交易决策。

数据来源: `d:\量化交易workspace\small_cap_ML\datasets`

## 功能特性

1. **选择训练参数** - 用户选择开始日期、目标股票和初始资金
2. **市场全貌** - 显示所有股票前一日数据（涨跌幅、价格、流通市值等），支持排序
3. **交易决策** - 买入/卖出/观望，支持全仓和半仓操作
4. **逐日推进** - 每次决策后自动移到下一个交易日
5. **训练总结** - 结束时显示总收益、年化收益、最大回撤等指标
6. **用户系统** - 注册登录后可保存训练记录

## 技术栈

- **后端**: Python FastAPI + SQLAlchemy + SQLite
- **前端**: React + Vite + Ant Design
- **数据**: CSV → Parquet 预处理加速读取

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 预处理数据（首次运行）

```bash
cd backend
python preprocess_data.py
```

这会将CSV数据转换为Parquet格式，存储在 `data/` 目录下。

### 3. 启动后端

```bash
cd backend
python main.py
```

后端运行在 http://localhost:8000

### 4. 安装前端依赖

```bash
cd frontend
npm install
```

### 5. 启动前端

```bash
cd frontend
npm run dev
```

前端运行在 http://localhost:5173

### 一键启动（Windows）

```bash
start.bat
```

## 项目结构

```
├── backend/
│   ├── main.py              # FastAPI 主应用
│   ├── auth.py              # 认证模块
│   ├── models.py            # 数据库模型
│   ├── database.py          # 数据库配置
│   ├── data_service.py      # 数据查询服务
│   ├── preprocess_data.py   # 数据预处理脚本
│   └── requirements.txt     # Python 依赖
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # 主组件
│   │   ├── api.js           # API 封装
│   │   ├── pages/
│   │   │   ├── SetupPage.jsx    # 设置页面
│   │   │   ├── TradingPage.jsx  # 交易页面
│   │   │   └── HistoryPage.jsx  # 历史记录
│   │   └── index.css        # 样式
│   ├── package.json
│   └── vite.config.js
├── data/                    # 预处理后的数据（自动生成）
└── start.bat                # 一键启动脚本
```

## 交易规则

- 交易以当日**开盘价**成交
- 买入必须整手（100股的整数倍）
- 观望时直接跳到下一交易日
- 支持全仓和半仓操作

## 服务器部署

以下以 Ubuntu 22.04 服务器为例。

### 前提条件

- 一台 Linux 服务器（推荐 Ubuntu 22.04，2核4G 以上）
- 域名（可选，也可用 IP 直接访问）
- 本地已有预处理好的数据文件（`data/` 和 `backend/data/` 目录）

### 步骤一：服务器安装基础依赖

```bash
apt update
apt install -y python3 python3-pip python3-venv nginx git
# 安装 Node.js（推荐 v20）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 步骤二：克隆代码

```bash
git clone https://github.com/summerer3/Simulating_Trading_Training.git /opt/tradetrainer-repo
```

### 步骤三：从本地上传数据文件

在**本地 Windows** 执行（数据文件不在 Git 中）：

```bash
# 上传股票数据
scp -r data/* root@<服务器IP>:/opt/tradetrainer/data/
scp -r backend/data/* root@<服务器IP>:/opt/tradetrainer/backend/data/
```

或者运行 `deploy\upload.bat`（需先修改其中的服务器 IP）。

### 步骤四：执行部署脚本

```bash
ssh root@<服务器IP>
cd /opt/tradetrainer-repo
chmod +x deploy/deploy.sh
bash deploy/deploy.sh
```

该脚本会自动完成：
1. 构建前端 `npm install && npm run build`
2. 复制前后端代码到 `/opt/tradetrainer/`
3. 创建 Python 虚拟环境并安装依赖
4. 配置 Nginx 反向代理
5. 配置 systemd 服务并启动

### 步骤五：配置域名（可选）

将域名 A 记录指向服务器 IP。然后修改 Nginx 配置中的 `server_name`：

```bash
vim /etc/nginx/sites-available/tradetrainer
# 将 server_name 改为你的域名
systemctl reload nginx
```

安装 SSL 证书（推荐）：

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### 日常更新流程

**更新代码**（本地改完推到 GitHub 后）：

```bash
ssh root@<服务器IP>
cd /opt/tradetrainer-repo
git fetch origin && git reset --hard origin/main
cd frontend && npm run build
cp -r dist /opt/tradetrainer/frontend/
cp -r /opt/tradetrainer-repo/backend/* /opt/tradetrainer/backend/
systemctl restart tradetrainer
```

**更新数据**（本地 scp 上传）：

```bash
scp -r data/* root@<服务器IP>:/opt/tradetrainer/data/
scp -r backend/data/* root@<服务器IP>:/opt/tradetrainer/backend/data/
ssh root@<服务器IP> "systemctl restart tradetrainer"
```

### 常用运维命令

```bash
# 查看服务状态
systemctl status tradetrainer

# 查看后端日志
journalctl -u tradetrainer -f

# 重启服务
systemctl restart tradetrainer

# 重载 Nginx
systemctl reload nginx
```

### 目录结构（服务器）

```
/opt/tradetrainer/          # 运行目录
├── backend/                # 后端代码
├── frontend/dist/          # 前端构建产物
├── data/                   # 股票数据（scp 上传）
├── venv/                   # Python 虚拟环境
└── static/                 # 静态资源

/opt/tradetrainer-repo/     # Git 仓库（拉取代码用）
```