import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import engine, Base, apply_non_destructive_migrations
import models
from seed_auth import seed_admin
from seed_departments import seed_departments_and_agenda
from routers import auth, departments, reviews, tasks, planner, employees

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

# Seed admin user
from database import SessionLocal
db = SessionLocal()
try:
    seed_admin(db)
    seed_departments_and_agenda(db)
finally:
    db.close()

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(departments.router, prefix="/api/departments", tags=["departments"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(planner.router, prefix="/api/planner", tags=["planner"])
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])

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
