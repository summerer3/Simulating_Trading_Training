"""
数据服务：提供股票数据查询功能
优化版：使用按股票和按月拆分的数据文件，大幅降低内存占用
"""
import pandas as pd
from pathlib import Path
from functools import lru_cache
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
STOCKS_DIR = DATA_DIR / "stocks"
MARKET_DIR = DATA_DIR / "market"


@lru_cache(maxsize=50)
def _load_stock_data(stock_code: str) -> Optional[pd.DataFrame]:
    """加载单只股票的全部历史数据（~100-500KB per stock）"""
    file_path = STOCKS_DIR / f"{stock_code}.parquet"
    if not file_path.exists():
        return None
    return pd.read_parquet(file_path)


@lru_cache(maxsize=3)
def _load_market_month(year_month: str) -> Optional[pd.DataFrame]:
    """加载某月的市场数据（~1-2MB per month）"""
    file_path = MARKET_DIR / f"{year_month}.parquet"
    if not file_path.exists():
        return None
    return pd.read_parquet(file_path)


@lru_cache(maxsize=1)
def _load_trading_days() -> list:
    """加载交易日列表（~50KB）"""
    file_path = DATA_DIR / "trading_days.parquet"
    if not file_path.exists():
        return []
    df = pd.read_parquet(file_path)
    return sorted(df['date'].tolist())


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

    # 确定要加载的月份文件
    ym = date.strftime('%Y-%m')
    df = _load_market_month(ym)

    if df is not None:
        df_before = df[df['date'] < date]
    else:
        df_before = pd.DataFrame()

    # 如果当月没有更早的数据，尝试上个月
    if df_before.empty:
        prev_month = (date - pd.DateOffset(months=1)).strftime('%Y-%m')
        df_prev = _load_market_month(prev_month)
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

    return result.to_dict('records')


def get_stock_history(stock_code: str, end_date: str, days: int = 0) -> list:
    """获取某只股票截止到某日之前最近两年的历史数据"""
    df = _load_stock_data(stock_code)
    if df is None:
        return []

    end = pd.Timestamp(end_date)
    two_years_ago = end - pd.DateOffset(years=2)

    filtered = df[(df['date'] >= two_years_ago) & (df['date'] < end)]

    if days > 0:
        filtered = filtered.tail(days)

    return filtered[['date', 'open', 'high', 'low', 'close', 'pre_close', 'change_pct']].to_dict('records')


def get_trading_days(start_date: str, stock_code: str = "000001.XSHE") -> list:
    """获取从某日开始的交易日列表"""
    start = pd.Timestamp(start_date)
    all_days = _load_trading_days()
    return [d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d)[:10]
            for d in all_days if d >= start]


def get_stock_day_price(stock_code: str, date_str: str) -> Optional[dict]:
    """获取某只股票某天的价格数据"""
    df = _load_stock_data(stock_code)
    if df is None:
        return None

    date = pd.Timestamp(date_str)
    row = df[df['date'] == date]
    if row.empty:
        return None

    result = row.iloc[0][['open', 'high', 'low', 'close', 'pre_close']].to_dict()
    return {k: (0 if (v != v or v == float('inf') or v == float('-inf')) else v) for k, v in result.items()}
