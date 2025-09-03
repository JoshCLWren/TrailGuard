import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from .models import Base

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+psycopg2://postgres:postgres@localhost/trailguard')

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db():
    """Run the SQL migration if using PostgreSQL."""
    if engine.url.get_backend_name().startswith('postgresql'):
        sql_path = Path('migrations/001_init.sql')
        if sql_path.exists():
            sql = sql_path.read_text()
            with engine.begin() as conn:
                conn.exec_driver_sql(sql)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
