from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db


router = APIRouter(prefix='/v1/users/{user_id}/familyMembers', tags=['Family'])


def _to_response(m: models.FamilyMember, user_id: str) -> schemas.FamilyMemberResponse:
    return schemas.FamilyMemberResponse(
        name=f'users/{user_id}/familyMembers/{m.id}',
        display_name=m.display_name,
        status=m.status,
        last_seen_time=m.last_seen_time,
    )


@router.get('', response_model=schemas.FamilyListResponse)
def list_family(user_id: str, db: Session = Depends(get_db)):
    rows = db.query(models.FamilyMember).filter(models.FamilyMember.user_id == user_id).order_by(models.FamilyMember.create_time.desc()).all()
    return schemas.FamilyListResponse(familyMembers=[_to_response(m, user_id) for m in rows])


@router.post('', response_model=schemas.FamilyMemberResponse, status_code=201)
def create_family_member(user_id: str, payload: schemas.FamilyMemberPayload, db: Session = Depends(get_db)):
    m = models.FamilyMember(user_id=user_id, display_name=payload.display_name, status=payload.status, last_seen_time=payload.last_seen_time)
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_response(m, user_id)


@router.delete('/{member_id}', status_code=204)
def delete_family_member(user_id: str, member_id: str, db: Session = Depends(get_db)):
    m = db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id, models.FamilyMember.user_id == user_id).first()
    if not m:
        raise HTTPException(status_code=404, detail='Not found')
    db.delete(m)
    db.commit()
    return None

