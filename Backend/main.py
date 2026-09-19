from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.health import router as health_router
from routes.websocket import router as websocket_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # any page may read my responses
    # allow_origins=["http://localhost:5173"],  # only the frontend app may read my responses
)

app.include_router(health_router)
app.include_router(websocket_router)