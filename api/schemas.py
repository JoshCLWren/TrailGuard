from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class Location(BaseModel):
    lat: float
    lng: float
    accuracy_meters: Optional[float] = Field(None, alias='accuracyMeters')

    class Config:
        allow_population_by_field_name = True


class CheckInPayload(BaseModel):
    type: str
    message: Optional[str] = None
    device_id: Optional[str] = Field(None, alias='deviceId')
    location: Optional[Location] = None

    class Config:
        allow_population_by_field_name = True


class CheckInCreate(BaseModel):
    checkIn: CheckInPayload


class CheckInResponse(CheckInPayload):
    name: str
    create_time: datetime = Field(..., alias='createTime')

    class Config:
        allow_population_by_field_name = True


class CheckInListResponse(BaseModel):
    checkIns: List[CheckInResponse]
    nextPageToken: Optional[str] = None

    class Config:
        allow_population_by_field_name = True
