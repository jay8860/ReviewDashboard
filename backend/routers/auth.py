import json
import logging
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from typing import List, Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from database import get_db
from utils import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)

router = APIRouter()

AVAILABLE_MODULES = [
    "overview",
    "tasks",
    "analytics",
    "employees",
    "departments",
    "field_visits",
    "todos",
    "planner",
]


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"
    email: Optional[str] = None
    hint: Optional[str] = None
    module_access: Optional[List[str]] = None


class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    hint: Optional[str] = None
    module_access: Optional[List[str]] = None


def normalize_module_access(raw_modules: Optional[List[str]], role: Optional[str]) -> List[str]:
    if role == "admin":
        return AVAILABLE_MODULES.copy()

    if not raw_modules:
        return []

    modules = []
    for item in raw_modules:
        key = str(item).strip().lower().replace("-", "_").replace(" ", "_")
        if key in AVAILABLE_MODULES and key not in modules:
            modules.append(key)
    return modules


def parse_module_access(raw_value: Optional[str], role: Optional[str]) -> List[str]:
    if role == "admin":
        return AVAILABLE_MODULES.copy()

    if not raw_value:
        return AVAILABLE_MODULES.copy() if role == "admin" else ["tasks", "employees"]

    try:
        parsed = json.loads(raw_value)
    except (json.JSONDecodeError, ValueError):
        parsed = [x.strip() for x in str(raw_value).split(",")]

    if not isinstance(parsed, list):
        parsed = []

    normalized = normalize_module_access(parsed, role)
    if role != "admin" and not normalized:
        return ["tasks", "employees"]
    return normalized


def user_to_dict(user: models.User) -> dict:
    modules = parse_module_access(user.module_access, user.role)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "hint": user.hint,
        "module_access": modules,
        "created_at": str(user.created_at) if user.created_at else None,
    }


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> models.User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/modules")
def get_modules():
    return [{"key": key, "label": key.replace("_", " ").title()} for key in AVAILABLE_MODULES]


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    username = (request.username or "").strip()
    password = request.password or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="Invalid username or password")

    user = db.query(models.User).filter(func.lower(models.User.username) == username.lower()).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password")

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_dict(user),
    }


@router.get("/users")
def get_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    users = db.query(models.User).order_by(models.User.created_at.desc(), models.User.id.desc()).all()
    return [user_to_dict(user) for user in users]


@router.post("/users")
def create_user(
    request: UserCreateRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    username = request.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(request.password.strip()) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    role = (request.role or "user").strip().lower()
    if role not in {"admin", "user", "viewer"}:
        role = "user"

    modules = normalize_module_access(request.module_access or [], role)
    if role != "admin" and not modules:
        modules = ["tasks", "employees"]

    user = models.User(
        username=username,
        email=(request.email or None),
        hashed_password=get_password_hash(request.password),
        role=role,
        hint=request.hint,
        module_access=json.dumps(modules),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_dict(user)


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    request: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if request.username is not None:
        username = request.username.strip()
        if not username:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        exists = db.query(models.User).filter(models.User.username == username, models.User.id != user_id).first()
        if exists:
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = username

    if request.email is not None:
        user.email = request.email or None

    if request.hint is not None:
        user.hint = request.hint or None

    new_role = user.role
    if request.role is not None:
        role = request.role.strip().lower()
        if role not in {"admin", "user", "viewer"}:
            raise HTTPException(status_code=400, detail="Invalid role")
        if user.id == current_admin.id and role != "admin":
            raise HTTPException(status_code=400, detail="You cannot demote your own admin role")
        user.role = role
        new_role = role

    if request.password is not None and request.password.strip():
        if len(request.password.strip()) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        user.hashed_password = get_password_hash(request.password.strip())

    if request.module_access is not None or request.role is not None:
        raw = request.module_access if request.module_access is not None else parse_module_access(user.module_access, new_role)
        modules = normalize_module_access(raw, new_role)
        if new_role != "admin" and not modules:
            modules = ["tasks", "employees"]
        user.module_access = json.dumps(modules)

    db.commit()
    db.refresh(user)
    return user_to_dict(user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Default admin cannot be deleted")
    db.delete(user)
    db.commit()
    return {"message": "Deleted"}


@router.get("/hint/{username}")
def get_hint(username: str, db: Session = Depends(get_db)):
    # Always return the same structure regardless of whether the user exists
    # to prevent username enumeration via differing status codes.
    user = db.query(models.User).filter(
        func.lower(models.User.username) == (username or "").strip().lower()
    ).first()
    hint = user.hint if user and user.hint else "No hint set"
    return {"hint": hint}


@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        return {"message": "If this email exists, a reset link has been sent."}
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()

    smtp_server = os.getenv("SMTP_SERVER")
    if smtp_server:
        try:
            base_url = os.getenv("BASE_URL", "http://localhost:8000")
            reset_link = f"{base_url}/reset-password?token={token}"
            msg = MIMEText(f"Reset your password: {reset_link}")
            msg["Subject"] = "Governance Dashboard - Password Reset"
            msg["From"] = os.getenv("SMTP_USERNAME", "")
            msg["To"] = request.email
            with smtplib.SMTP(smtp_server, int(os.getenv("SMTP_PORT", 587))) as smtp:
                smtp.starttls()
                smtp.login(os.getenv("SMTP_USERNAME", ""), os.getenv("SMTP_PASSWORD", ""))
                smtp.send_message(msg)
        except smtplib.SMTPException as smtp_err:
            logger.warning("Failed to send password reset email to %s: %s", request.email, smtp_err)
        except Exception as exc:
            logger.warning("Unexpected error sending password reset email: %s", exc)
    return {"message": "If this email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.reset_token == request.token).first()
    if not user or not user.reset_token_expiry or user.reset_token_expiry < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if not request.new_password or len(request.new_password.strip()) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user.hashed_password = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()
    return {"message": "Password reset successfully"}
