# ai-service/app.py
from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from collections import Counter
from datetime import datetime
import json
from typing import Optional, List, Tuple

from db import init_db, SessionLocal, AiSentiment, Answer, Response
from sentiment_adapter import SentimentAdapter
from analysis import aggregate_sentiment

app = FastAPI(title="SmartSurvey AI Service")
init_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

_adapter: Optional[SentimentAdapter] = None
def get_adapter() -> SentimentAdapter:
    global _adapter
    if _adapter is None:
        _adapter = SentimentAdapter()
    return _adapter

def _load_texts_from_db(
    db: Session, survey_id: int, question_id: Optional[int] = None
) -> List[Tuple[int, str]]:
    """
    Trả về list (answer_id, answer_text) cho 1 survey (và 1 câu hỏi nếu có).
    """
    q = (
        db.query(Answer.answer_id, Answer.answer_text)
          .join(Response, Response.response_id == Answer.response_id)
          .filter(Response.survey_id == survey_id)
          .filter(Answer.answer_text.isnot(None))
          .filter(Answer.answer_text != "")
    )
    if question_id is not None:
        q = q.filter(Answer.question_id == question_id)

    rows = q.order_by(Answer.answer_id.asc()).all()
    return [(aid, txt) for aid, txt in rows if txt]

def compute_and_save_sentiment(
    survey_id: int, db: Session, question_id: Optional[int] = None
) -> AiSentiment:
    adapter = get_adapter()
    pairs = _load_texts_from_db(db, survey_id, question_id)

    if not pairs:
        raise HTTPException(status_code=404, detail="Survey chưa có câu trả lời văn bản trong DB.")

    _, texts = zip(*pairs)
    preds = adapter.predict_texts(list(texts))  # ['POS','NEU','NEG',...]

    agg = aggregate_sentiment(preds)
    counts = Counter([p for p in preds if p])

    rec = AiSentiment(
        survey_id=survey_id,
        total_responses=agg["sample_size"],
        positive_percent=round(agg["positive"] * 100.0, 2),
        neutral_percent =round(agg["neutral"]  * 100.0, 2),
        negative_percent=round(agg["negative"] * 100.0, 2),
        details=json.dumps(
            {"counts": counts, "sample_size": agg["sample_size"], "question_id": question_id},
            ensure_ascii=False,
        ),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

@app.post("/ai/sentiment/{survey_id}")
def run_sentiment_now(
    survey_id: int,
    question_id: Optional[int] = Query(None, description="Chỉ phân tích 1 câu hỏi cụ thể (optional)"),
    db: Session = Depends(get_db),
):
    rec = compute_and_save_sentiment(survey_id, db, question_id)
    return {
        "message": "DONE",
        "survey_id": survey_id,
        "result": {
            "id": getattr(rec, "sentiment_id", None),
            "total_responses": rec.total_responses,
            "positive_percent": float(rec.positive_percent),
            "neutral_percent":  float(rec.neutral_percent),
            "negative_percent": float(rec.negative_percent),
            "details": rec.details,
            "created_at": rec.created_at,
        },
    }

@app.get("/ai/sentiment/{survey_id}")
def get_latest_sentiment(survey_id: int, db: Session = Depends(get_db)):
    rec = (
        db.query(AiSentiment)
          .filter(AiSentiment.survey_id == survey_id)
          .order_by(AiSentiment.created_at.desc())
          .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Chưa có dữ liệu sentiment cho survey này.")
    return {
        "survey_id": survey_id,
        "result": {
            "id": getattr(rec, "sentiment_id", None),
            "total_responses": rec.total_responses,
            "positive_percent": float(rec.positive_percent),
            "neutral_percent":  float(rec.neutral_percent),
            "negative_percent": float(rec.negative_percent),
            "details": rec.details,
            "created_at": rec.created_at,
        },
    }
