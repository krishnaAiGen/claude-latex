from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # LLM
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    heavy_model: str = "anthropic/claude-opus-4.6"
    light_model: str = "google/gemini-3-flash-preview"

    # Local storage (temp files for compilation)
    storage_dir: Path = Path("./storage")
    docker_latex_image: str = "texlive/texlive:latest"
    compile_timeout_seconds: int = 30

    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_database: str = "postgres"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    @property
    def database_url(self) -> str:
        return f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_database}"

    # AWS S3
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    # Auth
    google_client_id: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 72
    admin_email: str = "admin@example.com"
    admin_password: str = "admin123"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # Review pipeline
    review_model: str = "anthropic/claude-sonnet-4-6"
    review_log: bool = False  # Set REVIEW_LOG=true in .env to enable per-review log files
    semantic_scholar_api_key: str = ""  # Optional: get free key from semanticscholar.org/product/api

    # Email / invite
    resend_api_key: str = ""
    app_url: str = "http://localhost:3000"

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://claude-latex.vercel.app",
    ]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
