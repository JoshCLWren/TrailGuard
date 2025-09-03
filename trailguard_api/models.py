import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Float, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def uuid4_str() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = 'users'

    id = Column(String, primary_key=True, default=uuid4_str)
    email = Column(Text, unique=True)
    display_name = Column(Text)
    create_time = Column(DateTime(timezone=True), default=datetime.utcnow)

    devices = relationship('Device', back_populates='user')


class Device(Base):
    __tablename__ = 'devices'

    id = Column(String, primary_key=True, default=uuid4_str)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name = Column(Text)
    battery_percent = Column(Integer)
    solar = Column(Boolean, nullable=False, default=False)
    connection_state = Column(Text, default='OFFLINE')
    firmware_version = Column(Text)
    last_seen_time = Column(DateTime(timezone=True))
    lat = Column(Float)
    lng = Column(Float)
    accuracy_meters = Column(Float)
    pairing_code = Column(Text, unique=True)
    paired_at = Column(DateTime(timezone=True))
    create_time = Column(DateTime(timezone=True), default=datetime.utcnow)
    update_time = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship('User', back_populates='devices')
    breadcrumbs = relationship('Breadcrumb', back_populates='device')
    check_ins = relationship('CheckIn', back_populates='device')
    messages = relationship('Message', back_populates='device')


class Breadcrumb(Base):
    __tablename__ = 'breadcrumbs'

    id = Column(String, primary_key=True, default=uuid4_str)
    device_id = Column(String, ForeignKey('devices.id', ondelete='CASCADE'), nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    accuracy_meters = Column(Float)
    create_time = Column(DateTime(timezone=True), default=datetime.utcnow)

    device = relationship('Device', back_populates='breadcrumbs')


class CheckIn(Base):
    __tablename__ = 'check_ins'

    id = Column(String, primary_key=True, default=uuid4_str)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    device_id = Column(String, ForeignKey('devices.id', ondelete='SET NULL'))
    type = Column(Text, nullable=False)
    message = Column(Text)
    lat = Column(Float)
    lng = Column(Float)
    accuracy_meters = Column(Float)
    create_time = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship('User')
    device = relationship('Device', back_populates='check_ins')


class SOSSession(Base):
    __tablename__ = 'sos_sessions'

    id = Column(String, primary_key=True, default=uuid4_str)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    message = Column(Text)
    start_time = Column(DateTime(timezone=True), default=datetime.utcnow)
    cancel_time = Column(DateTime(timezone=True))
    last_lat = Column(Float)
    last_lng = Column(Float)
    last_accuracy_meters = Column(Float)
    create_time = Column(DateTime(timezone=True), default=datetime.utcnow)


class FamilyMember(Base):
    __tablename__ = 'family_members'

    id = Column(String, primary_key=True, default=uuid4_str)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    display_name = Column(Text, nullable=False)
    status = Column(Text)
    last_seen_time = Column(DateTime(timezone=True))
    create_time = Column(DateTime(timezone=True), default=datetime.utcnow)


class UserSetting(Base):
    __tablename__ = 'user_settings'

    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    auto_alerts = Column(Boolean, nullable=False, default=False)
    notify_contacts = Column(Boolean, nullable=False, default=False)
    sos_auto_call = Column(Boolean, nullable=False, default=False)
    geofence_radius_meters = Column(Integer, nullable=False, default=0)
    update_time = Column(DateTime(timezone=True), default=datetime.utcnow)


class Message(Base):
    __tablename__ = 'messages'

    id = Column(String, primary_key=True, default=uuid4_str)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    device_id = Column(String, ForeignKey('devices.id', ondelete='SET NULL'))
    text = Column(Text, nullable=False)
    lat = Column(Float)
    lng = Column(Float)
    accuracy_meters = Column(Float)
    create_time = Column(DateTime(timezone=True), default=datetime.utcnow)

    device = relationship('Device', back_populates='messages')
