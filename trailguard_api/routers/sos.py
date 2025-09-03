from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db


router = APIRouter(prefix='/v1/users/{user_id}/sos', tags=['SOS'])


def _active_session(db: Session, user_id: str) -> Optional[models.SOSSession]:
    return (
        db.query(models.SOSSession)
        .filter(models.SOSSession.user_id == user_id, models.SOSSession.cancel_time.is_(None))
        .order_by(models.SOSSession.start_time.desc())
        .first()
    )


def _to_status(sess: Optional[models.SOSSession], user_id: str) -> schemas.SOSStatusResponse:
    if not sess:
        return schemas.SOSStatusResponse(
            name=f'users/{user_id}/sos', active=False, start_time=None, cancel_time=None, last_known_location=None
        )
    loc = None
    if sess.last_lat is not None and sess.last_lng is not None:
        loc = schemas.Location(lat=sess.last_lat, lng=sess.last_lng, accuracy_meters=sess.last_accuracy_meters)
    return schemas.SOSStatusResponse(
        name=f'users/{user_id}/sos',
        active=sess.cancel_time is None,
        start_time=sess.start_time,
        cancel_time=sess.cancel_time,
        last_known_location=loc,
    )


@router.get('', response_model=schemas.SOSStatusResponse)
def get_status(user_id: str, db: Session = Depends(get_db)):
    sess = _active_session(db, user_id)
    return _to_status(sess, user_id)


@router.post(':activate', response_model=schemas.SOSStatusResponse)
def activate(user_id: str, payload: Optional[schemas.SOSActivateRequest] = None, db: Session = Depends(get_db)):
    sess = _active_session(db, user_id)
    if not sess:
        sess = models.SOSSession(user_id=user_id, start_time=datetime.utcnow())
        db.add(sess)
    # Update message/location if provided
    if payload and payload.message:
        sess.message = payload.message
    if payload and payload.location:
        sess.last_lat = payload.location.lat
        sess.last_lng = payload.location.lng
        sess.last_accuracy_meters = payload.location.accuracy_meters
    sess.cancel_time = None
    db.commit()
    db.refresh(sess)
    return _to_status(sess, user_id)


@router.post(':cancel', response_model=schemas.SOSStatusResponse)
def cancel(user_id: str, db: Session = Depends(get_db)):
    sess = _active_session(db, user_id)
    if sess:
        sess.cancel_time = datetime.utcnow()
        db.commit()
        db.refresh(sess)
    return _to_status(_active_session(db, user_id), user_id)

