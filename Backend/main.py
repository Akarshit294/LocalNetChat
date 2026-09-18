from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # any page may read my responses
    # allow_origins=["http://localhost:5173"],  # only the frontend app may read my responses
)

@app.get("/health")
async def health():
    return {"status": "healthy"}