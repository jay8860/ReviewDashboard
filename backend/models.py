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
    category_name = Column(String, default="General")
    category_order = Column(Integer, default=0)
    display_order = Column(Integer, default=0)         # Order within category bucket
    priority_level = Column(String, default="Normal")  # Critical | High | Normal | Low
    head_name = Column(String, nullable=True)          # Department head / nodal officer
    head_designation = Column(String, nullable=True)
    color = Column(String, default="indigo")           # For UI theming: indigo/emerald/amber/rose/sky
    icon = Column(String, default="Building2")         # Lucide icon name
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    review_programs = relationship("ReviewProgram", back_populates="department", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="department")
    agenda_points = relationship("AgendaPoint", back_populates="department", cascade="all, delete-orphan", order_by="AgendaPoint.order_index")
    meetings = relationship("DepartmentMeeting", back_populates="department", cascade="all, delete-orphan")
    employees = relationship("Employee", back_populates="department")
    data_grid = relationship("DeptDataGrid", back_populates="department", uselist=False, cascade="all, delete-orphan")
    document_attachments = relationship("DocumentAttachment", back_populates="department", cascade="all, delete-orphan")

# ─── Employee ─────────────────────────────────────────────────────────────────

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    mobile_number = Column(String, nullable=False, unique=True, index=True)
    display_username = Column(String, nullable=False, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True) # Optional link to department
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="employees")
    tasks = relationship("Task", back_populates="assigned_employee")


# ─── Review Program ───────────────────────────────────────────────────────────

class ReviewProgram(Base):
    __tablename__ = "review_programs"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    review_frequency_days = Column(Integer, default=15)   # Expected cadence in days
    target_value = Column(String, nullable=True)          # E.g. "100%", "50 Lakhs"
    achieved_value = Column(String, nullable=True)        # E.g. "45%", "20 Lakhs"
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
    description = Column(Text, nullable=True)          # Task name / description
    assigned_agency = Column(String, nullable=True)
    allocated_date = Column(Date, nullable=True)       # Date task was assigned
    time_given = Column(String, nullable=True)         # e.g. "7 days", "30 days"
    deadline_date = Column(Date, nullable=True)
    completion_date = Column(String, nullable=True)    # Completion notes / date string
    status = Column(String, default=TaskStatus.pending)
    priority = Column(String, default=TaskPriority.normal)
    is_pinned = Column(Boolean, default=False)         # Pinned to today
    is_today = Column(Boolean, default=False)          # Flagged as today's task
    steno_comment = Column(Text, nullable=True)        # Steno / secretary comment
    remarks = Column(Text, nullable=True)
    # Link to department
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    # Source tracking
    source = Column(String, default="manual")          # manual | action_point | review
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Employee linking
    assigned_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)

    department = relationship("Department", back_populates="tasks")
    action_points = relationship("ActionPoint", back_populates="linked_task")
    assigned_employee = relationship("Employee", back_populates="tasks")


# ─── Department Agenda Point ──────────────────────────────────────────────────
# Agenda points live at the Department level, independent of any meeting/session

class AgendaPoint(Base):
    __tablename__ = "agenda_points"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    title = Column(String, nullable=False)             # Short agenda title
    details = Column(Text, nullable=True)              # Optional notes/details
    status = Column(String, default="Open")            # Open | Done | Deferred
    order_index = Column(Integer, default=0)           # For manual ordering
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="agenda_points")


# ─── Department Meeting ───────────────────────────────────────────────────────
# A meeting scheduled directly for a department (not via review program)

class DepartmentMeeting(Base):
    __tablename__ = "department_meetings"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    venue = Column(String, nullable=True)
    attendees = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    # Snapshot of agenda points at time of meeting (JSON list of titles)
    agenda_snapshot = Column(Text, nullable=True)       # JSON: [{"title": "...", "details": "..."}]
    # Editable table for in-meeting action tracking
    action_table_columns = Column(Text, nullable=False, default='["Action Point","Owner","Timeline","Status","Remarks"]')
    action_table_rows = Column(Text, nullable=False, default='[]')
    status = Column(String, default="Scheduled")        # Scheduled | Done | Cancelled
    officer_phone = Column(String, nullable=True)       # WhatsApp number of concerned officer
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="meetings")
    document_attachments = relationship("DocumentAttachment", back_populates="meeting", cascade="all, delete-orphan")


# ─── Department Data Grid ─────────────────────────────────────────────────────
# A flexible spreadsheet-style data store per department

class DeptDataGrid(Base):
    __tablename__ = "dept_data_grids"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    # Store column headers as JSON array e.g. ["Program", "Target", "Achieved", "Remarks"]
    columns = Column(Text, nullable=False, default='["Item","Target","Achieved","Remarks"]')
    # Store rows as JSON array of arrays e.g. [["PDLD", "100%", "45%", "On track"], ...]
    rows = Column(Text, nullable=False, default='[]')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="data_grid")


# ─── Document Attachments ──────────────────────────────────────────────────────
# Uploaded files at department-level or meeting-level with AI analysis fields

class DocumentAttachment(Base):
    __tablename__ = "document_attachments"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    meeting_id = Column(Integer, ForeignKey("department_meetings.id"), nullable=True, index=True)
    scope = Column(String, nullable=False, default="department")   # department | meeting
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)
    file_path = Column(Text, nullable=False)
    mime_type = Column(String, nullable=True)
    file_extension = Column(String, nullable=True)
    file_size = Column(Integer, nullable=False, default=0)
    extracted_text = Column(Text, nullable=True)
    extraction_truncated = Column(Boolean, default=False)
    analysis_mode = Column(String, nullable=True)                  # default | custom
    analysis_prompt = Column(Text, nullable=True)                  # Custom prompt
    analysis_output = Column(Text, nullable=True)
    analysis_status = Column(String, nullable=False, default="Not Analyzed")
    analysis_error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="document_attachments")
    meeting = relationship("DepartmentMeeting", back_populates="document_attachments")


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
