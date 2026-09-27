import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


class Settings:
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/resume_analyzer",
    )
    jwt_secret = os.getenv("JWT_SECRET", "replace-this-with-a-long-random-secret")
    jwt_algorithm = "HS256"
    jwt_expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))
    openai_api_key = os.getenv("OPENAI_API_KEY")
    openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    cloudinary_cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    cloudinary_api_key = os.getenv("CLOUDINARY_API_KEY")
    cloudinary_api_secret = os.getenv("CLOUDINARY_API_SECRET")
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")


settings = Settings()