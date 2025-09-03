import os

os.environ['DATABASE_URL'] = 'sqlite+pysqlite:///:memory:'

from fastapi.testclient import TestClient

from trailguard_api.main import app
from trailguard_api import models
from trailguard_api.database import Base, engine, SessionLocal

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def create_user(user_id: str):
    db = SessionLocal()
    db.add(models.User(id=user_id))
    db.commit()
    db.close()


def test_sos_activate_cancel_flow():
    user_id = 'user_sos'
    create_user(user_id)

    # Initially inactive
    resp = client.get(f'/v1/users/{user_id}/sos')
    assert resp.status_code == 200
    assert resp.json()['active'] is False

    # Activate
    payload = { 'message': 'help', 'location': { 'lat': 1.0, 'lng': 2.0, 'accuracyMeters': 5.0 } }
    resp = client.post(f'/v1/users/{user_id}/sos:activate', json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data['active'] is True
    assert data['lastKnownLocation']['lat'] == 1.0

    # Get status reflects active
    resp = client.get(f'/v1/users/{user_id}/sos')
    assert resp.status_code == 200
    assert resp.json()['active'] is True

    # Cancel
    resp = client.post(f'/v1/users/{user_id}/sos:cancel')
    assert resp.status_code == 200
    assert resp.json()['active'] is False

