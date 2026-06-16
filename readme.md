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