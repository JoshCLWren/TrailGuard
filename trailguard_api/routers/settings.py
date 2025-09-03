from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db


router = APIRouter(prefix='/v1/users/{user_id}/settings', tags=['Settings'])


def _ensure_settings(db: Session, user_id: str) -> models.UserSetting:
    s = db.query(models.UserSetting).filter(models.UserSetting.user_id == user_id).first()
    if not s:
        s = models.UserSetting(user_id=user_id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _to_response(s: models.UserSetting, user_id: str) -> schemas.SettingsResponse:
    return schemas.SettingsResponse(
        name=f'users/{user_id}/settings',
        auto_alerts=s.auto_alerts,
        notify_contacts=s.notify_contacts,
        sos_auto_call=s.sos_auto_call,
        geofence_radius_meters=s.geofence_radius_meters,
    )


@router.get('', response_model=schemas.SettingsResponse)
def get_settings(user_id: str, db: Session = Depends(get_db)):
    s = _ensure_settings(db, user_id)
    return _to_response(s, user_id)


@router.patch('', response_model=schemas.SettingsResponse)
def patch_settings(
    user_id: str,
    payload: schemas.SettingsPayload,
    updateMask: Optional[str] = Query(None, description='Comma-separated list of fields to update'),
    db: Session = Depends(get_db),
):
    s = _ensure_settings(db, user_id)
    allowed = {
        'autoAlerts': 'auto_alerts',
        'notifyContacts': 'notify_contacts',
        'sosAutoCall': 'sos_auto_call',
        'geofenceRadiusMeters': 'geofence_radius_meters',
    }
    fields = None
    if updateMask:
        fields = [f.strip() for f in updateMask.split(',') if f.strip()]
        for f in fields:
            if f not in allowed:
                raise HTTPException(status_code=400, detail=f'Unknown field in updateMask: {f}')

    def maybe(attr: str, value):
        if value is not None:
            setattr(s, attr, value)

    if not fields or 'autoAlerts' in fields:
        maybe('auto_alerts', payload.auto_alerts)
    if not fields or 'notifyContacts' in fields:
        maybe('notify_contacts', payload.notify_contacts)
    if not fields or 'sosAutoCall' in fields:
        maybe('sos_auto_call', payload.sos_auto_call)
    if not fields or 'geofenceRadiusMeters' in fields:
        maybe('geofence_radius_meters', payload.geofence_radius_meters)

    s.update_time = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return _to_response(s, user_id)

