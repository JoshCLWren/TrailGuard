from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix='/v1/users/{user_id}/checkIns', tags=['CheckIns'])


def to_checkin_response(ci: models.CheckIn) -> schemas.CheckInResponse:
    location = None
    if ci.lat is not None and ci.lng is not None:
        location = schemas.Location(lat=ci.lat, lng=ci.lng, accuracy_meters=ci.accuracy_meters)
    return schemas.CheckInResponse(
        name=f'users/{ci.user_id}/checkIns/{ci.id}',
        type=ci.type,
        message=ci.message,
        device_id=ci.device_id,
        location=location,
        create_time=ci.create_time,
    )


@router.get('', response_model=schemas.CheckInListResponse)
def list_checkins(
    user_id: str,
    pageSize: int = 50,
    pageToken: Optional[str] = None,
    filter: Optional[str] = None,
    orderBy: Optional[str] = None,
    db: Session = Depends(get_db),
):
    limit = max(1, min(pageSize, 200))
    query = db.query(models.CheckIn).filter(models.CheckIn.user_id == user_id).order_by(models.CheckIn.create_time.desc()).limit(limit)
    checkins = query.all()
    return schemas.CheckInListResponse(checkIns=[to_checkin_response(c) for c in checkins], nextPageToken=None)


@router.post('', response_model=schemas.CheckInResponse, status_code=201)
def create_checkin(user_id: str, payload: schemas.CheckInCreate, db: Session = Depends(get_db)):
    ci_in = payload.checkIn
    checkin = models.CheckIn(
        user_id=user_id,
        device_id=ci_in.device_id,
        type=ci_in.type,
        message=ci_in.message,
        lat=ci_in.location.lat if ci_in.location else None,
        lng=ci_in.location.lng if ci_in.location else None,
        accuracy_meters=ci_in.location.accuracy_meters if ci_in.location else None,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return to_checkin_response(checkin)
