# app.py
from __future__ import annotations
from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from settings import settings
from db import init_db, SessionLocal, AiSentiment, Answer, Response
from sentiment_adapter import SentimentAdapter

app = FastAPI(title="SmartSurvey AI Service")

# ---- DB session dependency ----
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---- Khởi tạo DB khi server start ----
@app.on_event("startup")
def on_startup():
    init_db()
    print("[startup] DB_URL =", settings.DB_URL)
    print("[startup] MODEL_DIR =", settings.MODEL_DIR)

# ---- Adapter (singleton trong process) ----
_adapter: Optional[SentimentAdapter] = None
def get_adapter() -> SentimentAdapter:
    global _adapter
    if _adapter is None:
        print("[adapter] Booting with MODEL_DIR =", settings.MODEL_DIR)
        _adapter = SentimentAdapter()
    return _adapter

# ================== Business logic ==================
def _fetch_texts(db: Session, survey_id: int, question_id: Optional[int] = None) -> List[str]:
    q = (
        db.query(Answer.answer_id, Answer.answer_text)
          .join(Response, Response.response_id == Answer.response_id)
          .filter(Response.survey_id == survey_id)
          .filter(func.length(func.trim(func.coalesce(Answer.answer_text, ""))) > 0)  # loại NULL/''/space
    )
    if question_id is not None:
        q = q.filter(Answer.question_id == question_id)

    rows = q.order_by(Answer.answer_id.asc()).all()
    return [r.answer_text for r in rows]

def _aggregate(labels: List[str]) -> Dict[str, Any]:
    total = len(labels)
    counts = {"POS": 0, "NEU": 0, "NEG": 0}
    for lb in labels:
        counts[lb] = counts.get(lb, 0) + 1
    def pct(n): return (n * 100.0 / total) if total else 0.0
    return {
        "total_responses": total,
        "positive_percent": pct(counts["POS"]),
        "neutral_percent": pct(counts["NEU"]),
        "negative_percent": pct(counts["NEG"]),
        "counts": counts,
        "sample_size": total,
    }

def compute_and_save_sentiment(survey_id: int, db: Session, question_id: Optional[int] = None) -> AiSentiment:
    texts = _fetch_texts(db, survey_id, question_id)
    if not texts:
        raise HTTPException(status_code=400, detail="Không có câu trả lời văn bản hợp lệ cho survey này.")

    adapter = get_adapter()
    pred = adapter.predict_texts(texts)

    aggr = _aggregate(pred.labels)

    # LƯU Ý: Bảng ai_sentiment không có question_id → KHÔNG truyền question_id
    rec = AiSentiment(
        survey_id=survey_id,
        total_responses=aggr["total_responses"],
        positive_percent=aggr["positive_percent"],
        neutral_percent=aggr["neutral_percent"],
        negative_percent=aggr["negative_percent"],
        # details là cột JSON → truyền dict, KHÔNG ép str
        details={
            "counts": aggr["counts"],
            "sample_size": aggr["sample_size"],
            "question_id": question_id,  # nếu muốn lưu thông tin tham chiếu, để trong JSON
        },
        # với MySQL, created_at/updated_at đã có server_default/auto update, nhưng set thêm cũng không sao
        created_at=datetime.utcnow(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


# ================== API ==================
@app.post("/ai/sentiment/{survey_id}")
def run_sentiment_now(survey_id: int, question_id: Optional[int] = None, db: Session = Depends(get_db)):
    rec = compute_and_save_sentiment(survey_id, db, question_id)
    return {"survey_id": survey_id, "result_id": rec.sentiment_id, "created_at": rec.created_at}

@app.get("/ai/sentiment/{survey_id}")
def get_latest_sentiment(survey_id: int, db: Session = Depends(get_db)):
    rec = (
        db.query(AiSentiment)
          .filter(AiSentiment.survey_id == survey_id)
          .order_by(AiSentiment.sentiment_id.desc())  # đổi sang sentiment_id
          .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Chưa có bản ghi sentiment cho survey này.")
    return {
        "survey_id": survey_id,
        "result": {
            "id": rec.sentiment_id,                   # đổi id → sentiment_id
            "total_responses": rec.total_responses,
            "positive_percent": float(rec.positive_percent),
            "neutral_percent": float(rec.neutral_percent),
            "negative_percent": float(rec.negative_percent),
            "details": rec.details,                   # là JSON/dict
            "created_at": rec.created_at,
            "updated_at": rec.updated_at,
        },
    }

