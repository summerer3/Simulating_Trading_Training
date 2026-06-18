"""
数据预处理脚本：将按年份的parquet拆分为按股票和按月的格式
优化服务器内存使用

输入：data/2006.parquet ~ data/2026.parquet
输出：
  - data/stocks/{stock_code}.parquet  (每只股票的全部历史)
  - data/market/{YYYY-MM}.parquet     (每月的市场快照)
  - data/trading_days.parquet         (所有交易日列表)
"""
import pandas as pd
from pathlib import Path
import time

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
STOCKS_DIR = DATA_DIR / "stocks"
MARKET_DIR = DATA_DIR / "market"


def main():
    start_time = time.time()

    STOCKS_DIR.mkdir(parents=True, exist_ok=True)
    MARKET_DIR.mkdir(parents=True, exist_ok=True)

    # 收集所有交易日
    all_trading_days = set()
    # 按股票收集数据
    stock_data = {}
    # 按月收集市场数据
    market_data = {}

    # 逐年处理，避免一次性加载所有数据
    for year in range(2006, 2027):
        file_path = DATA_DIR / f"{year}.parquet"
        if not file_path.exists():
            continue

        print(f"处理 {year}.parquet ...")
        df = pd.read_parquet(file_path)

        # 收集交易日
        dates = df['date'].unique()
        all_trading_days.update(dates)

        # 按股票分组
        for stock_code, group in df.groupby('stock_code'):
            if stock_code not in stock_data:
                stock_data[stock_code] = []
            stock_data[stock_code].append(group)

        # 按月分组 - 用于市场快照
        df['year_month'] = df['date'].dt.to_period('M').astype(str)
        for ym, group in df.groupby('year_month'):
            if ym not in market_data:
                market_data[ym] = []
            market_data[ym].append(group.drop(columns=['year_month']))

        # 释放内存
        del df

    # 1. 保存交易日列表
    print(f"\n保存交易日列表 ({len(all_trading_days)} 个交易日)...")
    trading_days_df = pd.DataFrame({'date': sorted(all_trading_days)})
    trading_days_df.to_parquet(DATA_DIR / "trading_days.parquet", index=False)

    # 2. 保存按股票的文件
    print(f"保存按股票文件 ({len(stock_data)} 只股票)...")
    for i, (stock_code, dfs) in enumerate(stock_data.items()):
        combined = pd.concat(dfs, ignore_index=True)
        combined = combined.sort_values('date')
        # 只保留需要的列
        cols = ['date', 'open', 'high', 'low', 'close', 'pre_close', 'change_pct']
        combined = combined[cols]
        # 处理NaN/Inf
        numeric_cols = ['open', 'high', 'low', 'close', 'pre_close', 'change_pct']
        combined[numeric_cols] = combined[numeric_cols].fillna(0).replace([float('inf'), float('-inf')], 0)

        combined.to_parquet(STOCKS_DIR / f"{stock_code}.parquet", index=False)

        if (i + 1) % 500 == 0:
            print(f"  已处理 {i + 1}/{len(stock_data)} 只股票")

    # 3. 保存按月的市场文件
    print(f"保存按月市场文件 ({len(market_data)} 个月份)...")
    for ym, dfs in market_data.items():
        combined = pd.concat(dfs, ignore_index=True)
        combined = combined.sort_values(['date', 'stock_code'])
        # 保留市场概览需要的列
        cols = ['date', 'stock_code', 'open', 'high', 'low', 'close', 'pre_close',
                'circulating_market_cap', 'change_pct']
        combined = combined[cols]
        # 处理NaN/Inf
        numeric_cols = ['open', 'high', 'low', 'close', 'pre_close', 'circulating_market_cap', 'change_pct']
        combined[numeric_cols] = combined[numeric_cols].fillna(0).replace([float('inf'), float('-inf')], 0)

        combined.to_parquet(MARKET_DIR / f"{ym}.parquet", index=False)

    elapsed = time.time() - start_time
    print(f"\n完成！耗时 {elapsed:.1f} 秒")

    # 统计
    stock_files = list(STOCKS_DIR.glob("*.parquet"))
    market_files = list(MARKET_DIR.glob("*.parquet"))
    stock_total = sum(f.stat().st_size for f in stock_files)
    market_total = sum(f.stat().st_size for f in market_files)
    print(f"  股票文件: {len(stock_files)} 个, 总计 {stock_total/1024/1024:.1f} MB")
    print(f"  市场文件: {len(market_files)} 个, 总计 {market_total/1024/1024:.1f} MB")
    print(f"  交易日文件: {(DATA_DIR / 'trading_days.parquet').stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
