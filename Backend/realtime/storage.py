import os
import shutil
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# relative to the Backend folder, not to wherever uvicorn was started
UPLOADS_DIR = Path(__file__).resolve().parent.parent / os.getenv("UPLOAD_FOLDER_PATH", "uploads")


def path_for(file_id) -> Path:
    # the id, never the uploader's name: "../main.py" would land outside the folder
    return UPLOADS_DIR / str(file_id)


def prepare_uploads():
    """Start empty: nothing is remembered after a restart, files on disk included."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    for entry in UPLOADS_DIR.iterdir():
        if entry.is_file():
            entry.unlink()


def free_bytes() -> int:
    return shutil.disk_usage(UPLOADS_DIR).free


def delete_quietly(path):
    """Already gone is fine. Anything else is left for the next startup to clear."""
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    except OSError as error:
        print(f"Couldn't delete {path}: {error}")
