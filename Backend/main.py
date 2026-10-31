# uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

from contextlib import asynccontextmanager

from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
from realtime.storage import prepare_uploads
from routes.health import router as health_router
from routes.users import router as users_router
from routes.websocket import router as websocket_router
from routes.files import router as files_router
from routes.sessions import router as sessions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    prepare_uploads()
    yield


app = FastAPI(lifespan=lifespan)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # any page may read my responses
#     # allow_origins=["http://localhost:5173"],  # only the frontend app may read my responses
# )

app.include_router(health_router)
app.include_router(users_router)
app.include_router(websocket_router)
app.include_router(files_router)
app.include_router(sessions_router)
