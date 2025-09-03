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


def test_create_and_list_checkins():
    user_id = 'user1'
    create_user(user_id)
    payload = {
        'checkIn': {
            'type': 'ok',
            'message': 'hello',
            'location': {'lat': 1.0, 'lng': 2.0}
        }
    }
    resp = client.post(f'/v1/users/{user_id}/checkIns', json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data['type'] == 'ok'

    resp = client.get(f'/v1/users/{user_id}/checkIns')
    assert resp.status_code == 200
    data = resp.json()
    assert len(data['checkIns']) == 1
