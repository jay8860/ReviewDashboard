from sqlalchemy.orm import Session
import models
from utils import get_password_hash, verify_password
import json

ALL_MODULES = [
    "overview",
    "tasks",
    "analytics",
    "employees",
    "departments",
    "field_visits",
    "todos",
    "planner",
]

# Modules needed by the TaskAdderBot service account (creates/updates tasks,
# looks up employees, and writes to the field-visit planning notepad).
TASK_EMPLOYEE_MODULES = ["tasks", "employees", "field_visits"]

def seed_admin(db: Session):
    """Seed default admin user if none exists."""
    existing = db.query(models.User).filter(models.User.username == "admin").first()
    if not existing:
        admin = models.User(
            username="admin",
            email="admin@governance.local",
            hashed_password=get_password_hash("admin321"),
            role="admin",
            token_version=0,
            module_access=json.dumps(ALL_MODULES),
            hint="Default admin login"
        )
        db.add(admin)
        db.commit()
        print("✅ Admin user created: admin / admin321")
    else:
        updated = False
        if existing.role != "admin":
            existing.role = "admin"
            updated = True
        if not existing.module_access or json.loads(existing.module_access or "[]") != ALL_MODULES:
            existing.module_access = json.dumps(ALL_MODULES)
            updated = True
        current_version = getattr(existing, "token_version", 0) or 0
        if not verify_password("admin321", existing.hashed_password):
            existing.hashed_password = get_password_hash("admin321")
            existing.hint = "Default admin login"
            existing.token_version = current_version + 1
            updated = True
        elif existing.hint != "Default admin login":
            existing.hint = "Default admin login"
            updated = True
        if not existing.module_access:
            existing.module_access = json.dumps(ALL_MODULES)
            updated = True
        if updated:
            db.commit()
        print("ℹ️  Admin user already exists")

    # Seed a restricted user account for task + employee operations
    restricted_user = db.query(models.User).filter(models.User.username == "user").first()
    if not restricted_user:
        basic_user = models.User(
            username="user",
            email="user@governance.local",
            hashed_password=get_password_hash("user123"),
            role="user",
            module_access=json.dumps(TASK_EMPLOYEE_MODULES),
            hint="Default user — task & employee access only"
        )
        db.add(basic_user)
        db.commit()
        print("✅ User account created: user / user123")
    else:
        updated = False
        if restricted_user.role != "user":
            restricted_user.role = "user"
            updated = True
        try:
            existing_modules = json.loads(restricted_user.module_access or "[]")
        except Exception:
            existing_modules = []
        if not restricted_user.module_access or set(TASK_EMPLOYEE_MODULES) - set(existing_modules):
            merged = existing_modules + [m for m in TASK_EMPLOYEE_MODULES if m not in existing_modules]
            restricted_user.module_access = json.dumps(merged)
            updated = True
        if updated:
            db.commit()
