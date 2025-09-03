from pathlib import Path
import os
import sys
import yaml
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse

# Support running as a package or as a script
try:
    from .database import init_db, engine  # type: ignore
    from .routers import checkins, sos, devices, breadcrumbs, family, settings  # type: ignore
except Exception:  # pragma: no cover
    # When executed as `python trailguard_api/main.py`, add project root to sys.path
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from trailguard_api.database import init_db, engine  # type: ignore
    from trailguard_api.routers import checkins, sos, devices, breadcrumbs, family, settings  # type: ignore


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Initialize DB and run migrations on startup
        init_db()
        yield

    app = FastAPI(lifespan=lifespan)

    # Enable CORS for local dev where PWA is served from :8000
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            'http://localhost:8000',
            'http://127.0.0.1:8000',
        ],
        allow_credentials=False,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    schema_path = Path('openapi.yaml')
    if schema_path.exists():
        with schema_path.open() as f:
            openapi_schema = yaml.safe_load(f)

        def custom_openapi():
            return openapi_schema

        app.openapi = custom_openapi

    app.include_router(checkins.router)
    app.include_router(sos.router)
    app.include_router(devices.router)
    app.include_router(breadcrumbs.router)
    app.include_router(family.router)
    app.include_router(settings.router)

    @app.get('/db', tags=['Internal'])
    def db_info():
        """Lightweight DB diagnostics for local dev.
        Returns masked connection URL and a connectivity check result.
        """
        url_masked = engine.url.render_as_string(hide_password=True)
        payload = {
            'url': url_masked,
            'backend': engine.url.get_backend_name(),
            'driver': engine.url.get_driver_name(),
            'ok': True,
            'error': None,
        }
        try:
            with engine.connect() as conn:
                conn.exec_driver_sql('SELECT 1')
        except Exception as e:  # pragma: no cover
            payload['ok'] = False
            payload['error'] = str(e)
        return JSONResponse(payload)

    return app


app = create_app()


if __name__ == '__main__':  # pragma: no cover
    # Allow running directly: `python trailguard_api/main.py`
    import uvicorn
    # Use import string for reload support
    uvicorn.run('trailguard_api.main:app', host='0.0.0.0', port=3000, reload=True)
