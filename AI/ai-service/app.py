from __future__ import annotations
from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from settings import settings
from db import init_db, SessionLocal, AiSentiment, Answer, Response, AiChatLog, ActivityLog
from sentiment_adapter import SentimentAdapter
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.sql import text
import json
import re

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

    # 🟢 Thêm ActivityLog sau khi lưu ai_sentiment
    db.add(ActivityLog(
        user_id=None,  # hoặc truyền user_id nếu bạn có thông tin người gọi
        action_type="ai_generate",             # đúng theo spec
        target_id=rec.sentiment_id,
        target_table="ai_sentiment",
        description=f"Recomputed sentiment for survey_id={survey_id}"
    ))
    db.commit()

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

# ================== Chat MVP ==================
class ChatRequest(BaseModel):
    survey_id: int
    question_text: str
    user_id: Optional[int] = None
    top_k: int = 5

class ChatResponse(BaseModel):
    survey_id: int
    question_text: str
    answer_text: str
    context: List[str]
    top_k: int
    created_at: datetime

def retrieve_topk(texts: list[str], query: str, top_k: int = 5) -> list[str]:
    if not texts:
        return []
    top_k = max(1, min(int(top_k), 20))
    vec = TfidfVectorizer(ngram_range=(1, 2), max_features=20000)
    X = vec.fit_transform(texts)
    q = vec.transform([query])
    sims = cosine_similarity(q, X).ravel()
    idx = sims.argsort()[::-1][:top_k]
    return [texts[i] for i in idx]

def craft_answer(question: str, context: list[str]) -> str:
    if not context:
        return "Hiện chưa có phản hồi phù hợp để trả lời câu hỏi này."
    bullets = "\n".join([f"- {c}" for c in context[:3]])
    return (
        f"Dựa trên các phản hồi phù hợp nhất cho câu hỏi: “{question}”, "
        f"các ý tiêu biểu như sau:\n{bullets}\n"
        "Tóm lại, xu hướng chung có thể rút ra từ các phản hồi trên."
    )

def answer_count_query(db, survey_id: int, question_text: str) -> Optional[str]:
    # Detect câu hỏi đếm
    if re.search(r"\b(bao nhiêu|bao %|bao phần trăm)\b", question_text, re.IGNORECASE):
        # Ví dụ đơn giản: đếm số câu trả lời có chữ "Yes"
        count = db.execute(text("""
            SELECT COUNT(*) FROM answers a
            JOIN responses r ON a.response_id = r.response_id
            WHERE r.survey_id = :sid
              AND a.answer_text LIKE '%Yes%'
        """), {"sid": survey_id}).scalar()
        return f"Có {count} câu trả lời Yes trong survey {survey_id}."
    return None

@app.post("/ai/chat", response_model=ChatResponse)
def ai_chat(req: ChatRequest, db: Session = Depends(get_db)):
    try:
        texts = _fetch_texts(db, req.survey_id)
        topk_ctx = retrieve_topk(texts, req.question_text, req.top_k)
        answer = craft_answer(req.question_text, topk_ctx)
        count_answer = answer_count_query(db, req.survey_id, req.question_text)
        if count_answer:
            answer = count_answer
            topk_ctx = []
        else:
            # fallback TF-IDF
            texts = _fetch_texts(db, req.survey_id)
            topk_ctx = retrieve_topk(texts, req.question_text, req.top_k)
            answer = craft_answer(req.question_text, topk_ctx)
        now = datetime.utcnow()

        # 1) Lưu ai_chat_logs
        chat = AiChatLog(
            survey_id=req.survey_id,
            user_id=req.user_id,
            question_text=req.question_text,
            ai_response=answer,
            context=json.dumps(topk_ctx, ensure_ascii=False),
        )
        db.add(chat); db.commit(); db.refresh(chat)

        # 2) Lưu activity_log
        db.add(ActivityLog(
            user_id=req.user_id,
            action_type="ai_query",
            target_id=chat.chat_id,
            target_table="ai_chat_logs",
            description=f"AI chat for survey_id={req.survey_id}"
        ))
        db.commit()

        return ChatResponse(
            survey_id=req.survey_id,
            question_text=req.question_text,
            answer_text=answer,
            context=topk_ctx,
            top_k=req.top_k,
            created_at=now
        )
    except Exception as e:
        # Nếu muốn log lỗi vào activity_log:
        db.add(ActivityLog(
            user_id=req.user_id,
            action_type="ai_query_error",
            target_id=None,
            target_table="ai_chat_logs",
            description=f"Error: {e}"
        ))
        db.commit()
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI chat: {e}")
    

