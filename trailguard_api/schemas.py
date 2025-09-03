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


class SOSActivateRequest(BaseModel):
    message: Optional[str] = None
    location: Optional[Location] = None

    model_config = ConfigDict(populate_by_name=True)


class SOSStatusResponse(BaseModel):
    name: str
    active: bool
    start_time: Optional[datetime] = Field(None, alias='startTime')
    cancel_time: Optional[datetime] = Field(None, alias='cancelTime')
    last_known_location: Optional[Location] = Field(None, alias='lastKnownLocation')

    model_config = ConfigDict(populate_by_name=True)


# Devices
class DevicePayload(BaseModel):
    battery_percent: Optional[int] = Field(None, alias='batteryPercent')
    solar: Optional[bool] = None
    connection_state: Optional[str] = Field(None, alias='connectionState')
    firmware_version: Optional[str] = Field(None, alias='firmwareVersion')
    last_seen_time: Optional[datetime] = Field(None, alias='lastSeenTime')
    location: Optional[Location] = None

    model_config = ConfigDict(populate_by_name=True)


class DeviceResponse(DevicePayload):
    name: str


class DeviceListResponse(BaseModel):
    devices: List[DeviceResponse]
    nextPageToken: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class DeviceCreateRequest(BaseModel):
    pairingCode: str
    device: Optional[DevicePayload] = None


class FirmwareInfoResponse(BaseModel):
    currentVersion: str
    latestVersion: str
    updateAvailable: bool
    releaseNotes: Optional[str] = None


# Breadcrumbs
class LatLng(BaseModel):
    latitude: float
    longitude: float


class BreadcrumbPayload(BaseModel):
    position: LatLng


class BreadcrumbResponse(BaseModel):
    name: str
    create_time: datetime = Field(..., alias='createTime')
    position: LatLng

    model_config = ConfigDict(populate_by_name=True)


class BreadcrumbListResponse(BaseModel):
    breadcrumbs: List[BreadcrumbResponse]
    nextPageToken: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class BreadcrumbCreateRequest(BaseModel):
    breadcrumb: BreadcrumbPayload


class BreadcrumbBatchCreateRequest(BaseModel):
    breadcrumbs: List[BreadcrumbPayload]


class BreadcrumbBatchCreateResponse(BaseModel):
    createdCount: int


# Family
class FamilyMemberPayload(BaseModel):
    display_name: str = Field(..., alias='displayName')
    status: Optional[str] = None
    last_seen_time: Optional[datetime] = Field(None, alias='lastSeenTime')

    model_config = ConfigDict(populate_by_name=True)


class FamilyMemberResponse(FamilyMemberPayload):
    name: str


class FamilyListResponse(BaseModel):
    familyMembers: List[FamilyMemberResponse]

    model_config = ConfigDict(populate_by_name=True)


# Settings
class SettingsPayload(BaseModel):
    auto_alerts: Optional[bool] = Field(None, alias='autoAlerts')
    notify_contacts: Optional[bool] = Field(None, alias='notifyContacts')
    sos_auto_call: Optional[bool] = Field(None, alias='sosAutoCall')
    geofence_radius_meters: Optional[int] = Field(None, alias='geofenceRadiusMeters')

    model_config = ConfigDict(populate_by_name=True)


class SettingsResponse(SettingsPayload):
    name: str
