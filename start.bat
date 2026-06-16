@echo off
echo ========================================
echo  A股模拟交易训练系统 - 启动脚本
echo ========================================

echo.
echo [1/3] 检查数据文件...
if not exist "data\stock_list.parquet" (
    echo 数据文件不存在，正在预处理数据...
    cd backend
    python preprocess_data.py
    cd ..
) else (
    echo 数据文件已存在，跳过预处理
)

echo.
echo [2/3] 启动后端服务...
start "Backend" cmd /k "cd backend && python main.py"

echo.
echo [3/3] 启动前端服务...
timeout /t 3 >nul
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo  后端运行在: http://localhost:8000
echo  前端运行在: http://localhost:5173
echo ========================================
