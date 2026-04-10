import os
import warnings
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import engine, Base, apply_non_destructive_migrations
import models
from seed_auth import seed_admin
from seed_departments import seed_departments_and_agenda
from seed_employees import seed_special_employees
from routers import auth, departments, reviews, tasks, planner, employees, field_visits, todos, analytics, backup

# Startup environment validation
_DEFAULT_SECRET_KEY = "governance-dashboard-secret-key-change-in-production"
if os.getenv("SECRET_KEY", _DEFAULT_SECRET_KEY) == _DEFAULT_SECRET_KEY:
    warnings.warn(
        "SECRET_KEY is not set or is using the default value. "
        "Set the SECRET_KEY environment variable to a strong random secret before deploying to production.",
        RuntimeWarning,
        stacklevel=1,
    )

if not os.getenv("GEMINI_API_KEY"):
    warnings.warn(
        "GEMINI_API_KEY is not set. Document AI analysis features will not be available.",
        RuntimeWarning,
        stacklevel=1,
    )

# Create all tables
Base.metadata.create_all(bind=engine)
apply_non_destructive_migrations()

app = FastAPI(title="Governance Dashboard API", version="1.0.0")

# CORS – restrict to trusted origins via ALLOWED_ORIGINS env var.
# In development, falls back to allow all origins when not set.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_allowed_origins: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed admin user
from database import SessionLocal
db = SessionLocal()
try:
    seed_admin(db)
    seed_departments_and_agenda(db)
    seed_special_employees(db)
finally:
    db.close()

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(departments.router, prefix="/api/departments", tags=["departments"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(planner.router, prefix="/api/planner", tags=["planner"])
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])
app.include_router(field_visits.router, prefix="/api/field-visits", tags=["field-visits"])
app.include_router(todos.router, prefix="/api/todos", tags=["todos"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(backup.router, prefix="/api/backup", tags=["backup"])


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.head("/healthz")
def healthz_head():
    return Response(status_code=200)


@app.head("/")
def root_head():
    return Response(status_code=200)

# Serve React frontend
frontend_dist = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/reset-password")
    def reset_password_page():
        return FileResponse(os.path.join(frontend_dist, "index.html"))

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
