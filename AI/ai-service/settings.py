try:
    from pydantic_settings import BaseSettings  # Pydantic v2 (đúng module)
except ImportError:
    from pydantic import BaseSettings  # fallback v1

from urllib.parse import quote_plus
from pathlib import Path

class Settings(BaseSettings):
    # ==== MySQL ====
    DB_USER: str = "root"
    DB_PASS: str = "123456"
    DB_HOST: str = "localhost"   # đã chuyển sang localhost để khớp root@localhost
    DB_PORT: int = 3306
    DB_NAME: str = "smartsurvey"

    @property
    def DB_URL(self) -> str:
        # Encode password để không vỡ URL khi có ký tự đặc biệt
        pwd = quote_plus(self.DB_PASS or "")
        return (
            f"mysql+pymysql://{self.DB_USER}:{pwd}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    # ==== Model & inference (nếu cần thêm) ====
    MODEL_DIR: str = str(
        Path(__file__).resolve().parents[1] / "ai-research" / "checkpoints" / "vn_sentiment_baseline"
    )

settings = Settings()
