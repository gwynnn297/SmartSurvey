# db.py
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, BigInteger, Integer, String, DateTime, Text,
    ForeignKey, func
)
from sqlalchemy.dialects.mysql import DECIMAL, JSON as MYSQL_JSON
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from settings import settings

engine = create_engine(settings.DB_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


# ====== Bảng tổng hợp kết quả ======
class AiSentiment(Base):
    __tablename__ = "ai_sentiment"
    sentiment_id     = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    survey_id        = Column(BigInteger, nullable=False, index=True)
    total_responses  = Column(Integer, nullable=False, default=0)
    positive_percent = Column(DECIMAL(5, 2), nullable=False, default=0)
    neutral_percent  = Column(DECIMAL(5, 2), nullable=False, default=0)
    negative_percent = Column(DECIMAL(5, 2), nullable=False, default=0)
    details          = Column(MYSQL_JSON, nullable=True)
    created_at       = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


# ====== Bảng responses (PK: response_id) ======
class Response(Base):
    __tablename__ = "responses"

    response_id   = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    survey_id     = Column(BigInteger, nullable=False, index=True)
    user_id       = Column(BigInteger, nullable=True, index=True)
    request_token = Column(String(128), unique=True, nullable=True)
    submitted_at  = Column(DateTime, server_default=func.current_timestamp(), nullable=True)

    answers = relationship("Answer", back_populates="response")


# ====== Bảng answers (chứa văn bản để phân tích) ======
class Answer(Base):
    __tablename__ = "answers"

    answer_id   = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    response_id = Column(BigInteger, ForeignKey("responses.response_id"), nullable=False, index=True)
    question_id = Column(BigInteger, nullable=False, index=True)
    option_id   = Column(BigInteger, nullable=True, index=True)
    answer_text = Column(Text, nullable=True)
    created_at  = Column(DateTime, server_default=func.current_timestamp(), nullable=True)
    updated_at  = Column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=True,
    )

    response = relationship("Response", back_populates="answers")

# ====== AI Chat Logs (KHỚP cột với ảnh bạn gửi) ======
class AiChatLog(Base):
    __tablename__ = "ai_chat_logs"
    chat_id       = Column(BigInteger, primary_key=True, autoincrement=True, index=True)  # PK
    survey_id     = Column(BigInteger, nullable=False, index=True)
    user_id       = Column(BigInteger, nullable=True, index=True)
    question_text = Column(Text, nullable=False)
    ai_response   = Column(Text, nullable=False)
    context       = Column(Text, nullable=True)   # lưu JSON string
    created_at    = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

# ====== Activity Log (KHỚP cột với ảnh bạn gửi) ======
class ActivityLog(Base):
    __tablename__ = "activity_log"
    log_id       = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    user_id      = Column(BigInteger, nullable=True, index=True)
    action_type  = Column(String(50), nullable=False)   # ví dụ: 'ai_query', 'ai_generate', ...
    target_id    = Column(BigInteger, nullable=True)    # id bản ghi mục tiêu (vd chat_id)
    target_table = Column(String(50), nullable=True)    # 'ai_chat_logs' / 'ai_sentiment' ...
    description  = Column(Text, nullable=True)
    created_at   = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


def init_db() -> None:
    # an toàn: checkfirst, không ghi đè cấu trúc đang có
    Base.metadata.create_all(bind=engine)
