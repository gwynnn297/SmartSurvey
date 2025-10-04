# settings.py
from urllib.parse import quote_plus
from typing import Optional

try:
    # Pydantic v2
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import computed_field
except ImportError:
    # Fallback cho Pydantic v1 (nếu môi trường bạn dùng bản cũ)
    from pydantic import BaseSettings  # type: ignore
    SettingsConfigDict = None  # type: ignore
    computed_field = None  # type: ignore


class Settings(BaseSettings):
    # ==== DB config (đặt trong .env khi deploy) ====
    # MySQL (mặc định): mysql+pymysql
    # PostgreSQL: postgresql+psycopg
    # SQLite: sqlite
    DB_SCHEME: str = "mysql+pymysql"
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_NAME: str = "smartsurvey"
    DB_USER: str = "root"
    DB_PASS: str = "123456"

    # ==== Model config ====
    # Hãy trỏ tới checkpoint có thật (ví dụ checkpoint-4854)
    MODEL_DIR: str = r"D:\NghienCuuKhoaHoc\Group_Project\SmartSurvey\AI\ai-research\checkpoints\phobert-out-20251002-compat1"
    HF_MODEL_NAME: str = "vinai/phobert-base"  # fallback online nếu MODEL_DIR không tồn tại
    NEUTRAL_THRESHOLD: float = 0.50
    
    # Pydantic v2 config / v1 fallback
    if SettingsConfigDict:
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
        )
    else:
        class Config:  # type: ignore
            env_file = ".env"
            env_file_encoding = "utf-8"

    # Tạo DB_URL từ các thành phần; hỗ trợ sqlite / mysql / postgres
    if computed_field:
        @computed_field  # type: ignore[misc]
        @property
        def DB_URL(self) -> str:
            if self.DB_SCHEME.lower() == "sqlite":
                # DB_NAME là đường dẫn tới file .db
                return f"sqlite:///{self.DB_NAME}"
            user = quote_plus(self.DB_USER)
            pwd = quote_plus(self.DB_PASS)
            return f"{self.DB_SCHEME}://{user}:{pwd}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    else:
        @property
        def DB_URL(self) -> str:
            if self.DB_SCHEME.lower() == "sqlite":
                return f"sqlite:///{self.DB_NAME}"
            user = quote_plus(self.DB_USER)
            pwd = quote_plus(self.DB_PASS)
            return f"{self.DB_SCHEME}://{user}:{pwd}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


settings = Settings()
