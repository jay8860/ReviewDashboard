from sqlalchemy import func
from sqlalchemy.orm import Session

import models


def seed_special_employees(db: Session):
    """
    Ensure helper/group entries exist for messaging workflows.
    """
    all_ceos_name = "All Ceos"
    existing = db.query(models.Employee).filter(
        func.lower(models.Employee.display_username) == all_ceos_name.lower()
    ).first()
    if existing:
        return

    # Group alias row; recipient expansion logic is handled in frontend
    # by mapping this alias to JP CEO contacts.
    row = models.Employee(
        name=all_ceos_name,
        display_username=all_ceos_name,
        mobile_number="9999999999",
        is_active=True,
        department_id=None,
    )
    db.add(row)
    db.commit()
