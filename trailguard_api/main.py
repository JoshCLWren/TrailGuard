from pathlib import Path
import yaml
from fastapi import FastAPI

from .database import init_db
from .routers import checkins, health


def create_app() -> FastAPI:
    app = FastAPI()

    schema_path = Path('openapi.yaml')
    if schema_path.exists():
        with schema_path.open() as f:
            openapi_schema = yaml.safe_load(f)

        def custom_openapi():
            return openapi_schema

        app.openapi = custom_openapi

    app.include_router(health.router)
    app.include_router(checkins.router)

    @app.on_event('startup')
    def on_startup():
        init_db()

    return app


app = create_app()
