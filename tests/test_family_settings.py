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


def test_settings_get_patch_and_family_crud():
    user_id = 'user_misc'
    create_user(user_id)

    # Settings default
    resp = client.get(f'/v1/users/{user_id}/settings')
    assert resp.status_code == 200
    data = resp.json()
    assert data['name'].endswith('/settings')

    # Patch autoAlerts
    resp = client.patch(f'/v1/users/{user_id}/settings', params={'updateMask': 'autoAlerts'}, json={'autoAlerts': True})
    assert resp.status_code == 200
    assert resp.json()['autoAlerts'] is True

    # Family list empty
    resp = client.get(f'/v1/users/{user_id}/familyMembers')
    assert resp.status_code == 200
    assert resp.json()['familyMembers'] == []

    # Create family member
    resp = client.post(f'/v1/users/{user_id}/familyMembers', json={'displayName': 'Alice'})
    assert resp.status_code == 201
    member_name = resp.json()['name']
    member_id = member_name.split('/')[-1]

    # List returns one
    resp = client.get(f'/v1/users/{user_id}/familyMembers')
    assert resp.status_code == 200
    assert len(resp.json()['familyMembers']) == 1

    # Delete
    resp = client.delete(f'/v1/users/{user_id}/familyMembers/{member_id}')
    assert resp.status_code == 204

    # List empty again
    resp = client.get(f'/v1/users/{user_id}/familyMembers')
    assert resp.status_code == 200
    assert resp.json()['familyMembers'] == []

