"""Entry point FastAPI AGROWTH: include semua router + middleware CORS."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import mangsa, predict, recommendation

app = FastAPI(title="AGROWTH API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
