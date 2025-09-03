import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from ..database import engine

router = APIRouter()

@router.get('/health')
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        return {'status': 'ok'}
    except Exception:
        logging.exception('Database connection failed')
        return JSONResponse({'status': 'error'}, status_code=503)
