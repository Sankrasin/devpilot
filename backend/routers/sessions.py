from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from pydantic import BaseModel

import database
import models

router = APIRouter()

class ChatSessionCreate(BaseModel):
    id: str
    type: str
    title: str
    url: str

class ChatSessionUpdate(BaseModel):
    data: str

class ChatSessionResponse(BaseModel):
    id: str
    type: str
    title: str
    url: str
    data: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ChatSessionResponse])
@router.get("", response_model=List[ChatSessionResponse])
def get_sessions(db: Session = Depends(database.get_db)):
    # Auto-cleanup logic (sessions older than 24 hours)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    db.query(models.ChatSession).filter(models.ChatSession.created_at < cutoff).delete()
    db.commit()

    return db.query(models.ChatSession).order_by(models.ChatSession.created_at.asc()).all()

@router.get("/{session_id}", response_model=ChatSessionResponse)
def get_session(session_id: str, db: Session = Depends(database.get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.post("/", response_model=ChatSessionResponse)
@router.post("", response_model=ChatSessionResponse)
def create_session(session_data: ChatSessionCreate, db: Session = Depends(database.get_db)):
    db_session = models.ChatSession(
        id=session_data.id,
        type=session_data.type,
        title=session_data.title,
        url=session_data.url
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.put("/{session_id}", response_model=ChatSessionResponse)
def update_session(session_id: str, update_data: ChatSessionUpdate, db: Session = Depends(database.get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.data = update_data.data
    db.commit()
    db.refresh(session)
    return session

@router.delete("/{session_id}")
def delete_session(session_id: str, db: Session = Depends(database.get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        return {"status": "ok"} # Idempotent delete
    
    db.delete(session)
    db.commit()
    return {"status": "ok"}
