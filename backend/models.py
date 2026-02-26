from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Boolean, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class TaskStatus(str, enum.Enum):
    pending = "Pending"
    in_progress = "In Progress"
    completed = "Completed"
    overdue = "Overdue"

class TaskPriority(str, enum.Enum):
    low = "Low"
    normal = "Normal"
    high = "High"
    critical = "Critical"

class ActionPointStatus(str, enum.Enum):
    open = "Open"
    in_progress = "In Progress"
    closed = "Closed"
    deferred = "Deferred"

class ReviewSessionStatus(str, enum.Enum):
    scheduled = "Scheduled"
    completed = "Completed"
    cancelled = "Cancelled"
    missed = "Missed"


# ─── User (recycled) ──────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, nullable=True)
    hashed_password = Column(String)
    role = Column(String, default="viewer")  # admin | viewer
    hint = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


# ─── Department ───────────────────────────────────────────────────────────────

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    short_name = Column(String, nullable=True)         # e.g. "EDU", "HEALTH"
    description = Column(Text, nullable=True)
    head_name = Column(String, nullable=True)          # Department head / nodal officer
    head_designation = Column(String, nullable=True)
    color = Column(String, default="indigo")           # For UI theming: indigo/emerald/amber/rose/sky
    icon = Column(String, default="Building2")         # Lucide icon name
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    review_programs = relationship("ReviewProgram", back_populates="department", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="department")


# ─── Review Program ───────────────────────────────────────────────────────────

class ReviewProgram(Base):
    __tablename__ = "review_programs"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    review_frequency_days = Column(Integer, default=15)   # Expected cadence in days
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    department = relationship("Department", back_populates="review_programs")
    review_sessions = relationship("ReviewSession", back_populates="program", cascade="all, delete-orphan")
    checklist_templates = relationship("ChecklistTemplate", back_populates="program", cascade="all, delete-orphan")


# ─── Review Session ───────────────────────────────────────────────────────────

class ReviewSession(Base):
    __tablename__ = "review_sessions"
    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("review_programs.id"), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    actual_date = Column(Date, nullable=True)
    status = Column(String, default=ReviewSessionStatus.scheduled)
    venue = Column(String, nullable=True)
    attendees = Column(Text, nullable=True)            # Comma-separated names
    notes = Column(Text, nullable=True)                # Meeting notes / minutes
    summary = Column(Text, nullable=True)              # Pre-meeting brief or post summary
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    program = relationship("ReviewProgram", back_populates="review_sessions")
    action_points = relationship("ActionPoint", back_populates="session", cascade="all, delete-orphan")
    checklist_responses = relationship("ChecklistResponse", back_populates="session", cascade="all, delete-orphan")


# ─── Action Point ─────────────────────────────────────────────────────────────

class ActionPoint(Base):
    __tablename__ = "action_points"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("review_sessions.id"), nullable=False)
    description = Column(Text, nullable=False)
    assigned_to = Column(String, nullable=True)        # Name of responsible officer
    due_date = Column(Date, nullable=True)
    status = Column(String, default=ActionPointStatus.open)
    priority = Column(String, default=TaskPriority.normal)
    linked_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)  # One-click → Task
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    session = relationship("ReviewSession", back_populates="action_points")
    linked_task = relationship("Task", back_populates="action_points")


# ─── Checklist Template ───────────────────────────────────────────────────────

class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"
    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("review_programs.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    program = relationship("ReviewProgram", back_populates="checklist_templates")
    responses = relationship("ChecklistResponse", back_populates="template_item")


# ─── Checklist Response (per session) ────────────────────────────────────────

class ChecklistResponse(Base):
    __tablename__ = "checklist_responses"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("review_sessions.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("checklist_templates.id"), nullable=False)
    is_checked = Column(Boolean, default=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    session = relationship("ReviewSession", back_populates="checklist_responses")
    template_item = relationship("ChecklistTemplate", back_populates="responses")


# ─── Task (enhanced from original) ───────────────────────────────────────────

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    task_number = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    assigned_agency = Column(String, nullable=True)
    deadline_date = Column(Date, nullable=True)
    status = Column(String, default=TaskStatus.pending)
    priority = Column(String, default=TaskPriority.normal)
    remarks = Column(Text, nullable=True)
    # New: Link to department
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    # New: Source tracking
    source = Column(String, default="manual")          # manual | action_point | review
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="tasks")
    action_points = relationship("ActionPoint", back_populates="linked_task")


# ─── Weekly Planner Event (recycled) ─────────────────────────────────────────

class PlannerEvent(Base):
    __tablename__ = "planner_events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    time_slot = Column(String, nullable=True)          # e.g. "09:00"
    duration_minutes = Column(Integer, default=60)
    event_type = Column(String, default="meeting")     # meeting | review | task | reminder
    color = Column(String, default="indigo")
    description = Column(Text, nullable=True)
    # Link to review session if this is a scheduled review
    review_session_id = Column(Integer, ForeignKey("review_sessions.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
