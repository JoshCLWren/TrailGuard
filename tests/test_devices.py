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


def test_device_pair_list_get_patch_check_fw():
    user_id = 'user_devices'
    create_user(user_id)

    # List initially empty
    resp = client.get(f'/v1/users/{user_id}/devices')
    assert resp.status_code == 200
    assert resp.json()['devices'] == []

    # Pair a device
    resp = client.post(f'/v1/users/{user_id}/devices', json={'pairingCode': 'ABCD-1234'})
    assert resp.status_code == 201
    dev = resp.json()
    name = dev['name']
    device_id = name.split('/')[-1]

    # List now returns one
    resp = client.get(f'/v1/users/{user_id}/devices')
    assert resp.status_code == 200
    assert len(resp.json()['devices']) == 1

    # Get device
    resp = client.get(f'/v1/users/{user_id}/devices/{device_id}')
    assert resp.status_code == 200

    # Patch some fields
    resp = client.patch(
        f'/v1/users/{user_id}/devices/{device_id}',
        params={'updateMask': 'batteryPercent,connectionState'},
        json={'batteryPercent': 88, 'connectionState': 'ONLINE'},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data['batteryPercent'] == 88
    assert data['connectionState'] == 'ONLINE'

    # Check firmware
    resp = client.get(f'/v1/users/{user_id}/devices/{device_id}:checkFirmware')
    assert resp.status_code == 200
    fw = resp.json()
    assert 'currentVersion' in fw and 'latestVersion' in fw

    # Breadcrumbs: batch create and list
    resp = client.post(
        f'/v1/users/{user_id}/devices/{device_id}/breadcrumbs:batchCreate',
        json={'breadcrumbs': [{'position': {'latitude': 10.0, 'longitude': 20.0}}, {'position': {'latitude': 11.0, 'longitude': 21.0}}]},
    )
    assert resp.status_code == 200
    assert resp.json()['createdCount'] == 2

    resp = client.get(f'/v1/users/{user_id}/devices/{device_id}/breadcrumbs')
    assert resp.status_code == 200
    data = resp.json()
    assert len(data['breadcrumbs']) == 2
