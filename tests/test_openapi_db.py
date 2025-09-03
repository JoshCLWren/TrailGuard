import os

os.environ['DATABASE_URL'] = 'sqlite+pysqlite:///:memory:'

from fastapi.testclient import TestClient

from trailguard_api.main import app
from trailguard_api.database import Base, engine


def setup_module(module):
    Base.metadata.create_all(bind=engine)


client = TestClient(app)


def test_openapi_served():
    r = client.get('/openapi.json')
    assert r.status_code == 200
    data = r.json()
    assert data.get('openapi')
    assert data.get('info', {}).get('title') == 'TrailGuard API'


def test_db_endpoint():
    r = client.get('/db')
    assert r.status_code == 200
    data = r.json()
    assert data['ok'] is True
    assert 'url' in data and 'backend' in data

