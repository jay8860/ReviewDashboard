from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

# Create data directory if it doesn't exist (Critical for Volume mounting or local dev)
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except Exception as e:
    print(f"Warning: Could not create data directory: {e}")

# Priority: Environment Variable (for Railway/Prod) > Local Persistent SQLite (in data folder)
raw_database_url = os.getenv("DATABASE_URL")
is_railway_runtime = any(
    os.getenv(k) for k in ("RAILWAY_ENVIRONMENT", "RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_ID")
)

VOLUME_DATA_DIR = "/app/backend/data"
VOLUME_DB_PATH = os.path.join(VOLUME_DATA_DIR, "tasks.db")

if not raw_database_url:
    if is_railway_runtime:
        # Use SQLite on the persistent volume mounted at /app/backend/data
        os.makedirs(VOLUME_DATA_DIR, exist_ok=True)
        raw_database_url = f"sqlite:///{VOLUME_DB_PATH}"
        print(f"ℹ️  Railway runtime: using volume-backed SQLite at {VOLUME_DB_PATH}")
    else:
        print("⚠️  DATABASE_URL not set. Using local SQLite at backend/data/tasks.db")

SQLALCHEMY_DATABASE_URL = raw_database_url or f"sqlite:///{os.path.join(DATA_DIR, 'tasks.db')}"

# Handle Postgres URL format (SQLAlchemy requires postgresql://, Railway gives postgres://)
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def apply_non_destructive_migrations():
    """
    Backfill missing columns for legacy deployments.
    SQLAlchemy create_all() creates tables, but does not alter existing ones.
    """
    inspector = inspect(engine)

    migration_plan = {
        "users": [
            ("email", "VARCHAR"),
            ("role", "VARCHAR DEFAULT 'viewer'"),
            ("module_access", "TEXT"),
            ("hint", "VARCHAR"),
            ("reset_token", "VARCHAR"),
            ("reset_token_expiry", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "departments": [
            ("short_name", "VARCHAR"),
            ("description", "TEXT"),
            ("category_name", "VARCHAR DEFAULT 'General'"),
            ("category_order", "INTEGER DEFAULT 0"),
            ("display_order", "INTEGER DEFAULT 0"),
            ("priority_level", "VARCHAR DEFAULT 'Normal'"),
            ("head_name", "VARCHAR"),
            ("head_designation", "VARCHAR"),
            ("color", "VARCHAR DEFAULT 'indigo'"),
            ("icon", "VARCHAR DEFAULT 'Building2'"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "employees": [
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("department_id", "INTEGER"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "tasks": [
            ("is_pinned", "BOOLEAN DEFAULT FALSE"),
            ("is_today", "BOOLEAN DEFAULT FALSE"),
            ("steno_comment", "TEXT"),
            ("remarks", "TEXT"),
            ("department_id", "INTEGER"),
            ("source", "VARCHAR(50) DEFAULT 'manual'"),
            ("assigned_employee_id", "INTEGER"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "review_sessions": [
            ("summary", "TEXT"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "action_points": [
            ("linked_task_id", "INTEGER"),
            ("remarks", "TEXT"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "department_meetings": [
            ("agenda_snapshot", "TEXT"),
            ("action_table_columns", "TEXT DEFAULT '[\"Action Point\",\"Owner\",\"Timeline\",\"Status\",\"Remarks\"]'"),
            ("action_table_rows", "TEXT DEFAULT '[]'"),
            ("status", "VARCHAR DEFAULT 'Scheduled'"),
            ("scheduled_time", "VARCHAR"),
            ("officer_phone", "VARCHAR"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "review_programs": [
            ("target_value", "REAL"),
            ("achieved_value", "REAL"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "dept_data_grids": [
            ("columns", "TEXT DEFAULT '[\"Item\",\"Target\",\"Achieved\",\"Remarks\"]'"),
            ("rows", "TEXT DEFAULT '[]'"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "planner_events": [
            ("status", "VARCHAR DEFAULT 'Draft'"),
            ("venue", "VARCHAR"),
            ("attendees", "TEXT"),
            ("department_id", "INTEGER"),
            ("department_meeting_id", "INTEGER"),
            ("source", "VARCHAR DEFAULT 'manual'"),
            ("external_uid", "VARCHAR"),
            ("external_calendar", "VARCHAR"),
            ("is_locked", "BOOLEAN DEFAULT FALSE"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "planner_settings": [
            ("slot_minutes", "INTEGER DEFAULT 30"),
            ("slot_gap_minutes", "INTEGER DEFAULT 15"),
            ("day_start", "VARCHAR DEFAULT '10:00'"),
            ("day_end", "VARCHAR DEFAULT '18:00'"),
            ("lunch_start", "VARCHAR DEFAULT '13:30'"),
            ("lunch_end", "VARCHAR DEFAULT '14:30'"),
            ("timezone", "VARCHAR DEFAULT 'Asia/Kolkata'"),
            ("apple_ics_url", "TEXT"),
            ("recurring_blocks", "TEXT DEFAULT '[]'"),
            ("last_ics_sync_at", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "document_attachments": [
            ("meeting_id", "INTEGER"),
            ("scope", "VARCHAR DEFAULT 'department'"),
            ("original_filename", "VARCHAR"),
            ("stored_filename", "VARCHAR"),
            ("file_path", "TEXT"),
            ("mime_type", "VARCHAR"),
            ("file_extension", "VARCHAR"),
            ("file_size", "INTEGER DEFAULT 0"),
            ("extracted_text", "TEXT"),
            ("extraction_truncated", "BOOLEAN DEFAULT FALSE"),
            ("analysis_mode", "VARCHAR"),
            ("analysis_prompt", "TEXT"),
            ("analysis_output", "TEXT"),
            ("analysis_status", "VARCHAR DEFAULT 'Not Analyzed'"),
            ("analysis_error", "TEXT"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "field_visit_planning_notes": [
            ("note_text", "TEXT"),
            ("home_base", "VARCHAR DEFAULT 'Collectorate, Dantewada'"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "todo_items": [
            ("title", "VARCHAR"),
            ("details", "TEXT"),
            ("due_date", "DATE"),
            ("reminder_at", "TIMESTAMP"),
            ("status", "VARCHAR DEFAULT 'Open'"),
            ("priority", "VARCHAR DEFAULT 'Normal'"),
            ("order_index", "INTEGER DEFAULT 0"),
            ("source", "VARCHAR DEFAULT 'manual'"),
            ("department_id", "INTEGER"),
            ("assigned_employee_id", "INTEGER"),
            ("linked_task_id", "INTEGER"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "field_visit_drafts": [
            ("planned_date", "DATE"),
            ("planned_time", "VARCHAR"),
            ("visit_places_note", "TEXT"),
            ("people_going", "TEXT"),
            ("planner_event_id", "INTEGER"),
        ],
    }

    with engine.begin() as conn:
        existing_tables = set(inspector.get_table_names())
        is_sqlite = engine.dialect.name == "sqlite"
        for table_name, columns in migration_plan.items():
            if table_name not in existing_tables:
                continue

            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col_name, col_def in columns:
                if col_name in existing_cols:
                    continue
                try:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
                except OperationalError as exc:
                    # SQLite cannot ALTER TABLE ADD COLUMN with non-constant defaults
                    # such as CURRENT_TIMESTAMP. Retry without that default.
                    msg = str(exc)
                    has_dynamic_default = "Cannot add a column with non-constant default" in msg
                    if not (is_sqlite and has_dynamic_default):
                        raise

                    sqlite_safe_def = re.sub(
                        r"\s+DEFAULT\s+CURRENT_TIMESTAMP(?:\(\))?",
                        "",
                        col_def,
                        flags=re.IGNORECASE,
                    ).strip()
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {sqlite_safe_def}"))
                    conn.execute(
                        text(f"UPDATE {table_name} SET {col_name} = CURRENT_TIMESTAMP WHERE {col_name} IS NULL")
                    )
                existing_cols.add(col_name)
                print(f"ℹ️  Added missing column: {table_name}.{col_name}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
