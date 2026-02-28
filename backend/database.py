from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os

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
            ("hint", "VARCHAR"),
            ("reset_token", "VARCHAR"),
            ("reset_token_expiry", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ],
        "departments": [
            ("short_name", "VARCHAR"),
            ("description", "TEXT"),
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
            ("status", "VARCHAR DEFAULT 'Scheduled'"),
            ("officer_phone", "VARCHAR"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
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
    }

    with engine.begin() as conn:
        existing_tables = set(inspector.get_table_names())
        for table_name, columns in migration_plan.items():
            if table_name not in existing_tables:
                continue

            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col_name, col_def in columns:
                if col_name in existing_cols:
                    continue
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
                existing_cols.add(col_name)
                print(f"ℹ️  Added missing column: {table_name}.{col_name}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
