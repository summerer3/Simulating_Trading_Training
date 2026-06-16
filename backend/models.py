from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_vip = Column(Boolean, default=False)
    vip_expire_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    training_sessions = relationship("TrainingSession", back_populates="user")
    posts = relationship("CommunityPost", back_populates="user")


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    initial_capital = Column(Float, default=1000000.0)
    final_capital = Column(Float, nullable=False)
    total_return_pct = Column(Float, nullable=False)
    annualized_return_pct = Column(Float, nullable=False)
    max_drawdown_pct = Column(Float, nullable=False)
    total_trades = Column(Integer, default=0)
    win_rate = Column(Float, default=0.0)
    trade_history = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="training_sessions")


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    session_id = Column(Integer, ForeignKey("training_sessions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="posts")
    session = relationship("TrainingSession")
