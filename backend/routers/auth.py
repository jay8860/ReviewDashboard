from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import secrets
import smtplib
from email.mime.text import MIMEText
import os

from database import get_db
import models
from utils import verify_password, create_access_token

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == request.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"username": user.username, "role": user.role, "id": user.id}
    }


@router.get("/hint/{username}")
def get_hint(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"hint": user.hint or "No hint set"}


@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        return {"message": "If this email exists, a reset link has been sent."}
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
    db.commit()
    # Send email if SMTP configured
    smtp_server = os.getenv("SMTP_SERVER")
    if smtp_server:
        try:
            base_url = os.getenv("BASE_URL", "http://localhost:8000")
            reset_link = f"{base_url}/reset-password?token={token}"
            msg = MIMEText(f"Reset your password: {reset_link}")
            msg["Subject"] = "Governance Dashboard - Password Reset"
            msg["From"] = os.getenv("SMTP_USERNAME", "")
            msg["To"] = request.email
            with smtplib.SMTP(smtp_server, int(os.getenv("SMTP_PORT", 587))) as s:
                s.starttls()
                s.login(os.getenv("SMTP_USERNAME", ""), os.getenv("SMTP_PASSWORD", ""))
                s.send_message(msg)
        except Exception:
            pass
    return {"message": "If this email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    from utils import get_password_hash
    user = db.query(models.User).filter(models.User.reset_token == request.token).first()
    if not user or not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user.hashed_password = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()
    return {"message": "Password reset successfully"}
