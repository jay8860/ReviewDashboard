from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date

from database import get_db
import models

router = APIRouter()


class EventCreate(BaseModel):
    title: str
    date: date
    time_slot: Optional[str] = None
    duration_minutes: Optional[int] = 60
    event_type: Optional[str] = "meeting"
    color: Optional[str] = "indigo"
    description: Optional[str] = None
    review_session_id: Optional[int] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[date] = None
    time_slot: Optional[str] = None
    duration_minutes: Optional[int] = None
    event_type: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None


@router.get("/")
def get_events(start_date: Optional[date] = None, end_date: Optional[date] = None, db: Session = Depends(get_db)):
    q = db.query(models.PlannerEvent)
    if start_date:
        q = q.filter(models.PlannerEvent.date >= start_date)
    if end_date:
        q = q.filter(models.PlannerEvent.date <= end_date)
    return q.order_by(models.PlannerEvent.date, models.PlannerEvent.time_slot).all()


@router.post("/")
def create_event(data: EventCreate, db: Session = Depends(get_db)):
    event = models.PlannerEvent(**data.dict())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}")
def update_event(event_id: int, data: EventUpdate, db: Session = Depends(get_db)):
    event = db.query(models.PlannerEvent).filter(models.PlannerEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(event, k, v)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.PlannerEvent).filter(models.PlannerEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"message": "Deleted"}
