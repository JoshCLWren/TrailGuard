from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
try:
    # Pydantic v2
    from pydantic import ConfigDict  # type: ignore
except Exception:  # pragma: no cover
    ConfigDict = dict  # fallback typing for editors; v1 not expected


class Location(BaseModel):
    lat: float
    lng: float
    accuracy_meters: Optional[float] = Field(None, alias='accuracyMeters')

    # Pydantic v2 config: allow population by field name
    model_config = ConfigDict(populate_by_name=True)


class CheckInPayload(BaseModel):
    type: str
    message: Optional[str] = None
    device_id: Optional[str] = Field(None, alias='deviceId')
    location: Optional[Location] = None

    model_config = ConfigDict(populate_by_name=True)


class CheckInCreate(BaseModel):
    checkIn: CheckInPayload


class CheckInResponse(CheckInPayload):
    name: str
    create_time: datetime = Field(..., alias='createTime')

    model_config = ConfigDict(populate_by_name=True)


class CheckInListResponse(BaseModel):
    checkIns: List[CheckInResponse]
    nextPageToken: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
