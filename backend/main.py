"""
A股模拟交易训练系统 - 后端API
"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import timedelta, datetime, date

from database import engine, get_db, Base
from models import User, TrainingSession, CommunityPost
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_user_optional, ACCESS_TOKEN_EXPIRE_MINUTES
)
import data_service

# 创建数据库表
Base.metadata.create_all(bind=engine)


def _ensure_training_sessions_columns():
    """兼容旧SQLite库：补齐新字段"""
    with engine.connect() as conn:
        cols = conn.exec_driver_sql("PRAGMA table_info(training_sessions)").fetchall()
        col_names = {c[1] for c in cols}
        if "stock_code" not in col_names:
            conn.exec_driver_sql("ALTER TABLE training_sessions ADD COLUMN stock_code VARCHAR")
            conn.commit()


_ensure_training_sessions_columns()

app = FastAPI(title="A股模拟交易训练系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件（收款码图片等）
import os
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ============ Schemas ============

class UserRegister(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str


class TradeAction(BaseModel):
    stock_code: str
    action: str  # "buy", "sell", "hold"
    position_ratio: float = 1.0  # 1.0=全仓, 0.5=半仓


class SaveSessionRequest(BaseModel):
    stock_code: Optional[str] = None
    start_date: str
    end_date: str
    initial_capital: float
    final_capital: float
    total_return_pct: float
    annualized_return_pct: float
    max_drawdown_pct: float
    total_trades: int
    win_rate: float
    trade_history: list


# ============ Auth Routes ============

@app.post("/api/auth/register", response_model=Token)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    if len(user_data.username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少2个字符")
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6个字符")

    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}


@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}


@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    is_vip = user.is_vip and user.vip_expire_at and user.vip_expire_at > datetime.utcnow()
    return {
        "username": user.username,
        "id": user.id,
        "is_vip": is_vip,
        "vip_expire_at": user.vip_expire_at.isoformat() if user.vip_expire_at else None,
    }


# ============ Data Routes ============

@app.get("/api/stocks")
def get_stocks():
    """获取股票列表"""
    return data_service.get_stock_list()


@app.get("/api/stocks/search")
def search_stocks(q: str):
    """搜索股票"""
    all_stocks = data_service.get_stock_list()
    q = q.upper()
    return [s for s in all_stocks if q in s['stock_code'] or q in s['code_short']][:20]


@app.get("/api/market")
def get_market(date: str):
    """获取某日市场全貌"""
    return data_service.get_market_data(date)


@app.get("/api/random-start")
def random_start():
    """随机选择一只股票和开始日期（上市满1年后）"""
    import random
    import pandas as pd
    stocks = data_service.get_stock_list()
    if not stocks:
        raise HTTPException(status_code=500, detail="无股票数据")
    # 最多尝试10次找到有效股票
    for _ in range(10):
        stock = random.choice(stocks)
        df = data_service._load_stock_data(stock['stock_code'])
        if df is None or df.empty:
            continue
        first_date = df['date'].min()
        # 上市满1年后的起始日期
        earliest_start = (first_date + pd.DateOffset(years=1)).strftime('%Y-%m-%d')
        trading_days = data_service.get_trading_days(earliest_start)
        if len(trading_days) < 250:
            continue
        # 随机选一个日期，留出至少1年的交易空间
        max_idx = len(trading_days) - 250
        idx = random.randint(0, max_idx)
        return {"stock_code": stock['stock_code'], "code_short": stock['code_short'], "start_date": trading_days[idx]}
    raise HTTPException(status_code=500, detail="未找到符合条件的股票，请重试")


@app.get("/api/stock/history")
def get_stock_history(stock_code: str, end_date: str, days: int = 0):
    """获取股票历史K线数据，days=0表示加载所有历史数据"""
    return data_service.get_stock_history(stock_code, end_date, days)


@app.get("/api/stock/price")
def get_stock_price(stock_code: str, date: str):
    """获取股票某日价格"""
    result = data_service.get_stock_day_price(stock_code, date)
    if result is None:
        raise HTTPException(status_code=404, detail="未找到该日期的数据")
    return result


@app.get("/api/trading-days")
def get_trading_days(start_date: str):
    """获取交易日列表"""
    return data_service.get_trading_days(start_date)


# ============ Training Session Routes ============

@app.post("/api/sessions")
def save_session(
    session_data: SaveSessionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """保存训练结果"""
    session = TrainingSession(
        user_id=user.id,
        stock_code=session_data.stock_code,
        start_date=session_data.start_date,
        end_date=session_data.end_date,
        initial_capital=session_data.initial_capital,
        final_capital=session_data.final_capital,
        total_return_pct=session_data.total_return_pct,
        annualized_return_pct=session_data.annualized_return_pct,
        max_drawdown_pct=session_data.max_drawdown_pct,
        total_trades=session_data.total_trades,
        win_rate=session_data.win_rate,
        trade_history=session_data.trade_history,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "message": "训练结果已保存"}


@app.get("/api/sessions")
def get_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取用户的训练记录"""
    sessions = db.query(TrainingSession).filter(
        TrainingSession.user_id == user.id
    ).order_by(TrainingSession.created_at.desc()).all()

    return [{
        "id": s.id,
        "stock_code": s.stock_code,
        "start_date": s.start_date,
        "end_date": s.end_date,
        "initial_capital": s.initial_capital,
        "final_capital": s.final_capital,
        "total_return_pct": s.total_return_pct,
        "annualized_return_pct": s.annualized_return_pct,
        "max_drawdown_pct": s.max_drawdown_pct,
        "total_trades": s.total_trades,
        "win_rate": s.win_rate,
        "trade_history": s.trade_history,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    } for s in sessions]


class DeleteSessionsRequest(BaseModel):
    ids: List[int]


@app.post("/api/sessions/delete")
def delete_sessions(
    req: DeleteSessionsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """批量删除训练记录"""
    deleted = db.query(TrainingSession).filter(
        TrainingSession.id.in_(req.ids),
        TrainingSession.user_id == user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}


# ============ VIP & Training Limit ============

@app.get("/api/user/status")
def get_user_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取用户VIP状态和今日训练次数"""
    is_vip = user.is_vip and user.vip_expire_at and user.vip_expire_at > datetime.utcnow()
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_count = db.query(TrainingSession).filter(
        TrainingSession.user_id == user.id,
        TrainingSession.created_at >= today_start
    ).count()
    return {
        "is_vip": is_vip,
        "vip_expire_at": user.vip_expire_at.isoformat() if user.vip_expire_at else None,
        "today_training_count": today_count,
        "daily_limit": 999 if is_vip else 3,
    }


@app.post("/api/user/activate-vip")
def activate_vip(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """激活VIP（模拟支付后调用）"""
    now = datetime.utcnow()
    if user.vip_expire_at and user.vip_expire_at > now:
        user.vip_expire_at = user.vip_expire_at + timedelta(days=30)
    else:
        user.vip_expire_at = now + timedelta(days=30)
    user.is_vip = True
    db.commit()
    return {"message": "VIP已激活", "expire_at": user.vip_expire_at.isoformat()}


@app.get("/api/training/check")
def check_training_allowed(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """检查用户是否还能训练"""
    is_vip = user.is_vip and user.vip_expire_at and user.vip_expire_at > datetime.utcnow()
    if is_vip:
        return {"allowed": True}
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_count = db.query(TrainingSession).filter(
        TrainingSession.user_id == user.id,
        TrainingSession.created_at >= today_start
    ).count()
    return {"allowed": today_count < 3, "remaining": 3 - today_count}


# ============ Community Routes ============

class CreatePostRequest(BaseModel):
    title: str
    content: str
    session_id: Optional[int] = None


@app.post("/api/community/posts")
def create_post(
    post_data: CreatePostRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """发布社区帖子"""
    if len(post_data.title.strip()) < 2:
        raise HTTPException(status_code=400, detail="标题至少2个字符")
    if len(post_data.content.strip()) < 5:
        raise HTTPException(status_code=400, detail="内容至少5个字符")
    # 验证session_id属于该用户
    if post_data.session_id:
        session = db.query(TrainingSession).filter(
            TrainingSession.id == post_data.session_id,
            TrainingSession.user_id == user.id
        ).first()
        if not session:
            raise HTTPException(status_code=400, detail="训练记录不存在")

    post = CommunityPost(
        user_id=user.id,
        title=post_data.title.strip(),
        content=post_data.content.strip(),
        session_id=post_data.session_id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"id": post.id, "message": "发布成功"}


@app.get("/api/community/posts")
def get_posts(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    """获取社区帖子列表"""
    offset = (page - 1) * page_size
    total = db.query(CommunityPost).count()
    posts = db.query(CommunityPost).order_by(
        CommunityPost.created_at.desc()
    ).offset(offset).limit(page_size).all()

    result = []
    for p in posts:
        item = {
            "id": p.id,
            "title": p.title,
            "content": p.content[:200],
            "username": p.user.username,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "has_session": p.session_id is not None,
        }
        result.append(item)
    return {"total": total, "posts": result}


@app.get("/api/community/posts/{post_id}")
def get_post_detail(post_id: int, db: Session = Depends(get_db)):
    """获取帖子详情"""
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    result = {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "username": post.user.username,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "session": None,
    }
    if post.session:
        s = post.session
        result["session"] = {
            "stock_code": s.stock_code,
            "start_date": s.start_date,
            "end_date": s.end_date,
            "initial_capital": s.initial_capital,
            "final_capital": s.final_capital,
            "total_return_pct": s.total_return_pct,
            "annualized_return_pct": s.annualized_return_pct,
            "max_drawdown_pct": s.max_drawdown_pct,
            "total_trades": s.total_trades,
            "win_rate": s.win_rate,
            "trade_history": s.trade_history,
        }
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
