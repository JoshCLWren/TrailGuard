from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db


router = APIRouter(prefix='/v1/users/{user_id}/devices/{device_id}/breadcrumbs', tags=['Breadcrumbs'])


def _to_response(b: models.Breadcrumb, user_id: str, device_id: str) -> schemas.BreadcrumbResponse:
    return schemas.BreadcrumbResponse(
        name=f'users/{user_id}/devices/{device_id}/breadcrumbs/{b.id}',
        create_time=b.create_time,
        position=schemas.LatLng(latitude=b.lat, longitude=b.lng),
    )


def _device_or_404(db: Session, user_id: str, device_id: str) -> models.Device:
    d = db.query(models.Device).filter(models.Device.id == device_id, models.Device.user_id == user_id).first()
    if not d:
        raise HTTPException(status_code=404, detail='Device not found')
    return d


@router.get('', response_model=schemas.BreadcrumbListResponse)
def list_breadcrumbs(user_id: str, device_id: str, pageSize: int = Query(1000, ge=1, le=5000), db: Session = Depends(get_db)):
    _device_or_404(db, user_id, device_id)
    q = (
        db.query(models.Breadcrumb)
        .filter(models.Breadcrumb.device_id == device_id)
        .order_by(models.Breadcrumb.recorded_at.desc())
        .limit(pageSize)
    )
    rows = q.all()
    return schemas.BreadcrumbListResponse(
        breadcrumbs=[_to_response(b, user_id, device_id) for b in rows], nextPageToken=None
    )


@router.post('', response_model=schemas.BreadcrumbResponse, status_code=201)
def create_breadcrumb(user_id: str, device_id: str, payload: schemas.BreadcrumbCreateRequest, db: Session = Depends(get_db)):
    _device_or_404(db, user_id, device_id)
    pos = payload.breadcrumb.position
    row = models.Breadcrumb(device_id=device_id, lat=pos.latitude, lng=pos.longitude)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_response(row, user_id, device_id)


@router.post(':batchCreate', response_model=schemas.BreadcrumbBatchCreateResponse)
def batch_create_breadcrumbs(user_id: str, device_id: str, payload: schemas.BreadcrumbBatchCreateRequest, db: Session = Depends(get_db)):
    _device_or_404(db, user_id, device_id)
    created = 0
    for b in payload.breadcrumbs:
        pos = b.position
        row = models.Breadcrumb(device_id=device_id, lat=pos.latitude, lng=pos.longitude)
        db.add(row)
        created += 1
    db.commit()
    return schemas.BreadcrumbBatchCreateResponse(createdCount=created)

