from sqlalchemy.orm import Session
import models
from utils import get_password_hash
import json

ALL_MODULES = [
    "overview",
    "tasks",
    "employees",
    "departments",
    "field_visits",
    "todos",
    "planner",
]

TASK_EMPLOYEE_MODULES = ["tasks", "employees"]

def seed_admin(db: Session):
    """Seed default admin user if none exists."""
    existing = db.query(models.User).filter(models.User.username == "admin").first()
    if not existing:
        admin = models.User(
            username="admin",
            email="admin@governance.local",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            module_access=json.dumps(ALL_MODULES),
            hint="Default admin — change password after first login"
        )
        db.add(admin)
        db.commit()
        print("✅ Admin user created: admin / admin123")
    else:
        if not existing.module_access:
            existing.module_access = json.dumps(ALL_MODULES)
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
        if not restricted_user.module_access:
            restricted_user.module_access = json.dumps(TASK_EMPLOYEE_MODULES)
            updated = True
        if updated:
            db.commit()
