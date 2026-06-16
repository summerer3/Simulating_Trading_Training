"""
数据服务：提供股票数据查询功能
"""
import pandas as pd
from pathlib import Path
from functools import lru_cache
from typing import Optional

DATA_DIR = Path(__file__).parent.parent / "data"


@lru_cache(maxsize=25)
def load_year_data(year: int) -> Optional[pd.DataFrame]:
    """加载某年的数据（带缓存）"""
    file_path = DATA_DIR / f"{year}.parquet"
    if not file_path.exists():
        return None
    return pd.read_parquet(file_path)


def get_stock_list() -> list:
    """获取股票列表"""
    file_path = DATA_DIR / "stock_list.parquet"
    if not file_path.exists():
        return []
    df = pd.read_parquet(file_path)
    return df.to_dict('records')


def get_market_data(date_str: str) -> list:
    """获取某日的市场全貌数据（前一交易日的收盘数据）"""
    date = pd.Timestamp(date_str)
    year = date.year

    df = load_year_data(year)
    if df is None:
        return []

    # 获取该日期之前最近的交易日数据
    df_before = df[df['date'] < date]
    if df_before.empty:
        # 尝试前一年
        df_prev = load_year_data(year - 1)
        if df_prev is not None:
            df_before = df_prev

    if df_before.empty:
        return []

    # 获取最近交易日
    latest_date = df_before['date'].max()
    latest_data = df_before[df_before['date'] == latest_date].copy()

    result = latest_data[['stock_code', 'open', 'high', 'low', 'close', 'pre_close',
                          'circulating_market_cap', 'change_pct']].copy()
    result = result.rename(columns={
        'close': 'current_price',
        'change_pct': 'prev_change_pct',
        'circulating_market_cap': 'market_cap'
    })

    # 处理NaN/Infinity值，避免JSON序列化失败
    result = result.fillna(0)
    result = result.replace([float('inf'), float('-inf')], 0)

    return result.to_dict('records')


def get_stock_history(stock_code: str, end_date: str, days: int = 0) -> list:
    """获取某只股票截止到某日之前最近两年的历史数据"""
    end = pd.Timestamp(end_date)
    two_years_ago = end - pd.DateOffset(years=2)
    year = end.year

    all_data = []
    # 加载涉及的年份数据（最多3个年份文件覆盖两年范围）
    for y in range(two_years_ago.year, year + 1):
        df = load_year_data(y)
        if df is not None:
            stock_df = df[df['stock_code'] == stock_code]
            if not stock_df.empty:
                all_data.append(stock_df)

    if not all_data:
        return []

    combined = pd.concat(all_data, ignore_index=True)
    combined = combined[(combined['date'] >= two_years_ago) & (combined['date'] < end)]
    combined = combined.sort_values('date')

    if days > 0:
        combined = combined.tail(days)

    result = combined[['date', 'open', 'high', 'low', 'close', 'pre_close',
                       'circulating_market_cap', 'change_pct']].copy()
    numeric_cols = ['open', 'high', 'low', 'close', 'pre_close', 'circulating_market_cap', 'change_pct']
    result[numeric_cols] = result[numeric_cols].fillna(0).replace([float('inf'), float('-inf')], 0)
    return result.to_dict('records')


def get_trading_days(start_date: str, stock_code: str = "000001.XSHE") -> list:
    """获取从某日开始的交易日列表"""
    start = pd.Timestamp(start_date)
    year = start.year

    all_dates = set()
    for y in range(year, min(year + 2, 2027)):
        df = load_year_data(y)
        if df is not None:
            dates = df[df['date'] >= start]['date'].unique()
            all_dates.update(dates)

    return sorted([d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d)[:10]
                   for d in all_dates])


def get_stock_day_price(stock_code: str, date_str: str) -> Optional[dict]:
    """获取某只股票某天的价格数据"""
    date = pd.Timestamp(date_str)
    year = date.year

    df = load_year_data(year)
    if df is None:
        return None

    row = df[(df['stock_code'] == stock_code) & (df['date'] == date)]
    if row.empty:
        return None

    result = row.iloc[0][['open', 'high', 'low', 'close', 'pre_close']].to_dict()
    return {k: (0 if (v != v or v == float('inf') or v == float('-inf')) else v) for k, v in result.items()}
