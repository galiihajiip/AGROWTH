"""Entry point FastAPI AGROWTH: include semua router + middleware CORS."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import RequestLoggingMiddleware, configure_logging, get_settings
from app.routers import mangsa, predict, recommendation

configure_logging()
settings = get_settings()
app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

# Routers
app.include_router(predict.router)
app.include_router(recommendation.router)
app.include_router(mangsa.router)


@app.get("/")
async def read_root():
    return {"message": "AGROWTH API", "status": "ok"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
