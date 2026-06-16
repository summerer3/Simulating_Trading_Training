"""
数据预处理脚本：将CSV文件转换为Parquet格式以加速读取
按年合并所有股票数据为单个Parquet文件
"""
import os
import pandas as pd
from pathlib import Path

SOURCE_DIR = Path(r"d:\量化交易workspace\small_cap_ML\datasets")
OUTPUT_DIR = Path(r"d:\量化交易workspace\Simulating_Trading_Training\data")

# 需要的核心列
CORE_COLUMNS = ['open', 'high', 'low', 'close', 'pre_close', 'circulating_market_cap']


def process_year(year: int):
    """处理单年数据，合并所有股票为一个Parquet文件"""
    year_dir = SOURCE_DIR / str(year)
    if not year_dir.exists():
        print(f"目录不存在: {year_dir}")
        return

    all_data = []
    csv_files = list(year_dir.glob("*.csv"))
    print(f"处理 {year} 年，共 {len(csv_files)} 个文件...")

    for csv_file in csv_files:
        stock_code = csv_file.stem  # e.g., 000001.XSHE
        try:
            df = pd.read_csv(csv_file, index_col=0)
            if df.empty:
                continue
            # 只保留核心列
            available_cols = [c for c in CORE_COLUMNS if c in df.columns]
            df = df[available_cols].copy()
            df['stock_code'] = stock_code
            df.index.name = 'date'
            df = df.reset_index()
            all_data.append(df)
        except Exception as e:
            print(f"  跳过 {csv_file.name}: {e}")

    if all_data:
        merged = pd.concat(all_data, ignore_index=True)
        merged['date'] = pd.to_datetime(merged['date'])
        # 计算涨跌幅
        merged['change_pct'] = ((merged['close'] - merged['pre_close']) / merged['pre_close'] * 100).round(2)
        # 计算换手率估算 (使用流通市值和成交额的关系，这里简化处理)
        merged = merged.sort_values(['stock_code', 'date'])

        output_file = OUTPUT_DIR / f"{year}.parquet"
        merged.to_parquet(output_file, index=False)
        print(f"  已保存: {output_file} ({len(merged)} 行)")
    else:
        print(f"  {year} 年无有效数据")


def build_stock_list():
    """构建股票代码列表"""
    all_codes = set()
    for year_dir in SOURCE_DIR.iterdir():
        if year_dir.is_dir() and year_dir.name.isdigit():
            for csv_file in year_dir.glob("*.csv"):
                all_codes.add(csv_file.stem)

    stock_list = sorted(all_codes)
    df = pd.DataFrame({'stock_code': stock_list})
    # 从代码中提取简单信息
    df['market'] = df['stock_code'].apply(lambda x: 'SZ' if 'XSHE' in x else 'SH')
    df['code_short'] = df['stock_code'].apply(lambda x: x.split('.')[0])

    output_file = OUTPUT_DIR / "stock_list.parquet"
    df.to_parquet(output_file, index=False)
    print(f"股票列表已保存: {output_file} ({len(df)} 只股票)")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 处理所有年份
    for year in range(2006, 2027):
        process_year(year)

    # 构建股票列表
    build_stock_list()
    print("数据预处理完成!")


if __name__ == "__main__":
    main()
