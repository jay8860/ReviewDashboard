import os
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from database import engine, Base, apply_non_destructive_migrations
import models
from seed_auth import seed_admin
from seed_departments import seed_departments_and_agenda
from seed_employees import seed_special_employees
from routers import auth, departments, reviews, tasks, planner, employees, field_visits, todos, analytics, backup, audit

# Create all tables
Base.metadata.create_all(bind=engine)
apply_non_destructive_migrations()

app = FastAPI(title="Governance Dashboard API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PUBLIC_API_PATHS = {
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
}

MODULE_BY_PREFIX = {
    "/api/departments": "departments",
    "/api/reviews": "departments",
    "/api/tasks": "tasks",
    "/api/planner": "planner",
    "/api/employees": "employees",
    "/api/field-visits": "field_visits",
    "/api/todos": "todos",
    "/api/analytics": "analytics",
}


def _module_for_path(path: str) -> str | None:
    for prefix, module_key in MODULE_BY_PREFIX.items():
        if path == prefix or path.startswith(f"{prefix}/"):
            return module_key
    return None


def _is_admin_only_path(path: str) -> bool:
    admin_prefixes = ("/api/audit", "/api/backup")
    if any(path == prefix or path.startswith(f"{prefix}/") for prefix in admin_prefixes):
        return True
    return path in {"/api/auth/users", "/api/auth/modules"} or path.startswith("/api/auth/users/")


@app.middleware("http")
async def enforce_api_auth(request: Request, call_next):
    path = request.url.path

    if request.method == "OPTIONS":
        return await call_next(request)

    if not path.startswith("/api/"):
        return await call_next(request)

    if path in PUBLIC_API_PATHS:
        return await call_next(request)

    if path.startswith("/api/auth/hint/"):
        return await call_next(request)

    if path == "/api/planner/export.ics":
        return await call_next(request)

    db = SessionLocal()
    try:
        try:
            current_user = auth.get_current_user_from_authorization(
                authorization=request.headers.get("authorization"),
                db=db,
            )
        except Exception as exc:
            detail = getattr(exc, "detail", "Unauthorized")
            status_code = getattr(exc, "status_code", 401)
            return JSONResponse(status_code=status_code, content={"detail": detail})

        if _is_admin_only_path(path) and current_user.role != "admin":
            return JSONResponse(status_code=403, content={"detail": "Admin access required"})

        required_module = _module_for_path(path)
        if required_module and current_user.role != "admin":
            modules = auth.parse_module_access(current_user.module_access, current_user.role)
            if required_module not in modules:
                return JSONResponse(status_code=403, content={"detail": "Module access denied"})

        return await call_next(request)
    finally:
        db.close()

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
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])

TASK_UPLOAD_ROOT = os.path.join(os.path.dirname(__file__), "data", "task_uploads")
os.makedirs(TASK_UPLOAD_ROOT, exist_ok=True)
app.mount("/uploads/tasks", StaticFiles(directory=TASK_UPLOAD_ROOT), name="task_uploads")


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

    def serve_frontend_index():
        return FileResponse(
            os.path.join(frontend_dist, "index.html"),
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    @app.get("/reset-password")
    def reset_password_page():
        return serve_frontend_index()

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return serve_frontend_index()
