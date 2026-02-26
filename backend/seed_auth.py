from sqlalchemy.orm import Session
import models
from utils import get_password_hash


def seed_admin(db: Session):
    """Seed default admin user if none exists."""
    existing = db.query(models.User).filter(models.User.username == "admin").first()
    if not existing:
        admin = models.User(
            username="admin",
            email="admin@governance.local",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            hint="Default admin — change password after first login"
        )
        db.add(admin)
        db.commit()
        print("✅ Admin user created: admin / admin123")
    else:
        print("ℹ️  Admin user already exists")
