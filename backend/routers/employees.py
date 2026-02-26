from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
import models

router = APIRouter()

# Schema
class EmployeeCreate(BaseModel):
    name: str
    mobile_number: str
    display_username: str
    department_id: Optional[int] = None
    is_active: Optional[bool] = True

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    mobile_number: Optional[str] = None
    display_username: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None

def employee_to_dict(e: models.Employee) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "mobile_number": e.mobile_number,
        "display_username": e.display_username,
        "is_active": e.is_active,
        "department_id": e.department_id,
        "department_name": e.department.name if e.department else None,
        "created_at": str(e.created_at)
    }

@router.get("/")
def get_employees(search: Optional[str] = None, department_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.Employee)
    if department_id:
        q = q.filter(models.Employee.department_id == department_id)
    if search:
        q = q.filter(or_(
            models.Employee.name.ilike(f"%{search}%"),
            models.Employee.mobile_number.ilike(f"%{search}%"),
            models.Employee.display_username.ilike(f"%{search}%")
        ))
    return [employee_to_dict(e) for e in q.all()]

@router.post("/")
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    # Check uniqueness
    if db.query(models.Employee).filter(models.Employee.mobile_number == data.mobile_number).first():
        raise HTTPException(status_code=400, detail="Mobile number already exists")
    if db.query(models.Employee).filter(models.Employee.display_username == data.display_username).first():
        raise HTTPException(status_code=400, detail="Display username already exists")
        
    emp = models.Employee(**data.dict())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return employee_to_dict(emp)

@router.put("/{emp_id}")
def update_employee(emp_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    for k, v in data.dict(exclude_unset=True).items():
        # Check uniqueness if updating mobile or username
        if k == "mobile_number" and v != emp.mobile_number:
            if db.query(models.Employee).filter(models.Employee.mobile_number == v).first():
                raise HTTPException(status_code=400, detail="Mobile number already exists")
        if k == "display_username" and v != emp.display_username:
            if db.query(models.Employee).filter(models.Employee.display_username == v).first():
                raise HTTPException(status_code=400, detail="Display username already exists")
        setattr(emp, k, v)
        
    db.commit()
    db.refresh(emp)
    return employee_to_dict(emp)

@router.delete("/{emp_id}")
def delete_employee(emp_id: int, db: Session = Depends(get_db)):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()
    return {"message": "Deleted"}
