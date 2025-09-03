from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db


router = APIRouter(prefix='/v1/users/{user_id}/devices', tags=['Devices'])


def _to_device_response(d: models.Device, user_id: str) -> schemas.DeviceResponse:
    loc = None
    if d.lat is not None and d.lng is not None:
        loc = schemas.Location(lat=d.lat, lng=d.lng, accuracy_meters=d.accuracy_meters)
    return schemas.DeviceResponse(
        name=f'users/{user_id}/devices/{d.id}',
        battery_percent=d.battery_percent,
        solar=d.solar,
        connection_state=d.connection_state,
        firmware_version=d.firmware_version,
        last_seen_time=d.last_seen_time,
        location=loc,
    )


@router.get('', response_model=schemas.DeviceListResponse)
def list_devices(user_id: str, pageSize: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    q = db.query(models.Device).filter(models.Device.user_id == user_id).order_by(models.Device.create_time.desc()).limit(pageSize)
    devices = q.all()
    return schemas.DeviceListResponse(devices=[_to_device_response(d, user_id) for d in devices], nextPageToken=None)


@router.post('', response_model=schemas.DeviceResponse, status_code=201)
def create_device(user_id: str, payload: schemas.DeviceCreateRequest, db: Session = Depends(get_db)):
    code = (payload.pairingCode or '').strip()
    if not (4 <= len(code) <= 64):
        raise HTTPException(status_code=400, detail='Invalid pairingCode')
    # For dev: create a device for this user with provided optional fields
    d = models.Device(
        user_id=user_id,
        pairing_code=code,
        battery_percent=payload.device.battery_percent if payload.device else None,
        solar=payload.device.solar if payload.device and payload.device.solar is not None else False,
        connection_state=payload.device.connection_state if payload.device and payload.device.connection_state else 'OFFLINE',
        firmware_version=payload.device.firmware_version if payload.device else None,
        last_seen_time=payload.device.last_seen_time if payload.device else None,
        lat=payload.device.location.lat if payload.device and payload.device.location else None,
        lng=payload.device.location.lng if payload.device and payload.device.location else None,
        accuracy_meters=payload.device.location.accuracy_meters if payload.device and payload.device.location else None,
        paired_at=datetime.utcnow(),
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return _to_device_response(d, user_id)


@router.get('/{device_id}:checkFirmware', response_model=schemas.FirmwareInfoResponse)
def check_firmware(user_id: str, device_id: str, db: Session = Depends(get_db)):
    d = db.query(models.Device).filter(models.Device.id == device_id, models.Device.user_id == user_id).first()
    if not d:
        raise HTTPException(status_code=404, detail='Not found')
    current = d.firmware_version or '0.0.0'
    # For dev: pretend latest is 1.2.3 unless current equals it
    latest = '1.2.3'
    update = current != latest
    notes = 'Improved GPS accuracy and battery reporting.' if update else None
    return schemas.FirmwareInfoResponse(currentVersion=current, latestVersion=latest, updateAvailable=update, releaseNotes=notes)


@router.get('/{device_id}', response_model=schemas.DeviceResponse)
def get_device(user_id: str, device_id: str, db: Session = Depends(get_db)):
    d = db.query(models.Device).filter(models.Device.id == device_id, models.Device.user_id == user_id).first()
    if not d:
        raise HTTPException(status_code=404, detail='Not found')
    return _to_device_response(d, user_id)


@router.patch('/{device_id}', response_model=schemas.DeviceResponse)
def patch_device(
    user_id: str,
    device_id: str,
    payload: schemas.DevicePayload,
    updateMask: Optional[str] = Query(None, description='Comma-separated list of fields to update'),
    db: Session = Depends(get_db),
):
    d = db.query(models.Device).filter(models.Device.id == device_id, models.Device.user_id == user_id).first()
    if not d:
        raise HTTPException(status_code=404, detail='Not found')

    allowed = {
        'batteryPercent': 'battery_percent',
        'solar': 'solar',
        'connectionState': 'connection_state',
        'firmwareVersion': 'firmware_version',
        'lastSeenTime': 'last_seen_time',
        'location': 'location',
    }
    fields = None
    if updateMask:
        fields = [f.strip() for f in updateMask.split(',') if f.strip()]
        for f in fields:
            if f not in allowed:
                raise HTTPException(status_code=400, detail=f'Unknown field in updateMask: {f}')

    def maybe_update(attr: str, value):
        if value is not None:
            setattr(d, attr, value)

    # Apply updates according to mask or provided fields
    if not fields or 'batteryPercent' in fields:
        maybe_update('battery_percent', payload.battery_percent)
    if not fields or 'solar' in fields:
        if payload.solar is not None:
            d.solar = payload.solar
    if not fields or 'connectionState' in fields:
        if payload.connection_state is not None:
            d.connection_state = payload.connection_state
    if not fields or 'firmwareVersion' in fields:
        maybe_update('firmware_version', payload.firmware_version)
    if not fields or 'lastSeenTime' in fields:
        maybe_update('last_seen_time', payload.last_seen_time)
    if (not fields or 'location' in fields) and payload.location is not None:
        d.lat = payload.location.lat
        d.lng = payload.location.lng
        d.accuracy_meters = payload.location.accuracy_meters

    db.commit()
    db.refresh(d)
    return _to_device_response(d, user_id)
