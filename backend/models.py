from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    last_active = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, index=True)
    type = Column(String) # 'docs', 'requirements', 'planner'
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True) # UUID or string ID
    type = Column(String) # 'Scribe', 'Insight', 'Genesis'
    title = Column(String)
    url = Column(String)
    data = Column(String, nullable=True) # JSON string to hold plan/chat history
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # 24-hour expiry can be queried logically: created_at > now() - 24 hours
