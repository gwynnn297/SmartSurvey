from __future__ import annotations

import os
import json
import re
import hashlib
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

import pymysql
import requests
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.sql import text
from dotenv import load_dotenv
load_dotenv() 

# ====== dự án sẵn có (KHÔNG dùng PhoBERT nội bộ) ======
from settings import settings
from db import init_db, SessionLocal, AiSentiment, Answer, Response, AiChatLog, ActivityLog

# ============================================================
# CẤU HÌNH GOOGLE GEMINI (Structured Output)
# ============================================================
# Lưu ý: EXT_SENTI_MODEL không ảnh hưởng tới Gemini ở đây, giữ để đồng nhất config
# đúng
EXT_URL = os.getenv("EXT_SENTI_URL")
EXT_KEY = os.getenv("EXT_SENTI_KEY")
EXT_LANG      = os.getenv("EXT_SENTI_LANG", "vi")
EXT_MODEL     = os.getenv("EXT_SENTI_MODEL", "sentiment-vn-1")
EXT_TIMEOUT   = float(os.getenv("EXT_SENTI_TIMEOUT", "8.0"))
EXT_MAX_RETRY = int(os.getenv("EXT_SENTI_MAX_RETRY", "2"))

LABEL_MAP = {"negative": 0, "neutral": 1, "positive": 2}

# Circuit-breaker đơn giản
_CB_FAILS = 0
_CB_OPEN_UNTIL: float | None = None
_CB_TRIP_THRESHOLD = 6
_CB_COOLDOWN_SEC   = 30.0


def _cb_is_open(now: float | None = None) -> bool:
    import time
    ts = now or time.time()
    global _CB_OPEN_UNTIL
    if _CB_OPEN_UNTIL is None:
        return False
    if ts >= _CB_OPEN_UNTIL:
        _CB_OPEN_UNTIL = None
        return False
    return True


def _cb_record(success: bool):
    import time
    global _CB_FAILS, _CB_OPEN_UNTIL
    if success:
        _CB_FAILS = 0
        _CB_OPEN_UNTIL = None
        return
    _CB_FAILS += 1
    if _CB_FAILS >= _CB_TRIP_THRESHOLD:
        _CB_OPEN_UNTIL = time.time() + _CB_COOLDOWN_SEC


# ============================================================
# Chuẩn hoá văn bản (phục vụ hash/cache)
# ============================================================
_ABBR = {
    "ko": "không", "k": "không", "k0": "không", "kh": "không",
    "dc": "được", "đc": "được", "ok": "ổn",
    "bt": "bình thường", "bthg": "bình thường", "bth": "bình thường",
}
_EMO = {":))": "vui", ":)": "vui", ":D": "vui", ":(": "buồn", ":((": "buồn"}


def norm_text(t: str) -> str:
    import unicodedata
    if not t:
        return ""
    t = unicodedata.normalize("NFKC", t).lower().strip()
    for k, v in _EMO.items():
        t = t.replace(k, f" {v} ")
    t = re.sub(r"https?://\S+|www\.\S+", " ", t)
    t = re.sub(r"[@#]\S+", " ", t)
    t = re.sub(r"(.)\1{2,}", r"\1\1", t)
    t = re.sub(r"([!?.])\1{2,}", r"\1\1", t)
    toks = re.findall(r"[a-zà-ỹ0-9]+|[^\w\s]", t, flags=re.UNICODE)
    toks = [_ABBR.get(tok, tok) for tok in toks]
    t = " ".join(toks)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

# ============================================================
# DB helpers (PyMySQL)
# ============================================================

def _conn():
    return pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASS,
        database=settings.DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def sql_one(q: str, args=None):
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(q, args or ())
            return cur.fetchone()


def sql_all(q: str, args=None):
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(q, args or ())
            return cur.fetchall()


def sql_exec(q: str, args=None):
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(q, args or ())
        con.commit()

# ============================================================
# Gọi GEMINI (Structured Output JSON)
# ============================================================

def call_external_sentiment(text: str, retries: int | None = None) -> Tuple[int, float, Dict[str, Any]]:
    if not EXT_URL or not EXT_KEY:
        return 1, 0.0, {"error": "Missing EXT_SENTI_URL or EXT_SENTI_KEY in env"}

    headers = {
        "x-goog-api-key": EXT_KEY,
        "Content-Type": "application/json",
    }
    body = {
        "contents": [{
            "parts": [{"text": (
                "Bạn là bộ phân tích cảm xúc tiếng Việt.\n"
                "Trả về JSON đúng schema với các khóa {label, confidence}.\n"
                "label ∈ [negative, neutral, positive]. "
                "confidence ∈ [0,1].\n"
                f"Văn bản: {text}"
            )}]
        }],
        "generationConfig": {
            "temperature": 0,
            "topP": 1,
            "topK": 1,
            "candidateCount": 1,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "label": {"type": "string", "enum": ["negative","neutral","positive"]},
                    "confidence": {"type": "number"}
                },
                "required": ["label","confidence"]
            }
        }
    }

    import time
    use_retries = EXT_MAX_RETRY if retries is None else retries
    last_err = None
    for attempt in range(int(use_retries) + 1):
        try:
            r = requests.post(EXT_URL, headers=headers, json=body, timeout=EXT_TIMEOUT)
            if r.status_code == 200:
                j = r.json()
                # Gemini trả về JSON trong candidates[0].content.parts[0].text
                try:
                    txt = j["candidates"][0]["content"]["parts"][0]["text"]
                    data = json.loads(txt)
                    lab = str(data.get("label","neutral")).lower()
                    conf = float(data.get("confidence", 0.0))
                    lid = {"negative":0,"neutral":1,"positive":2}.get(lab, 1)
                    return lid, conf, {"api": j, "parsed": data}
                except Exception as parse_e:
                    last_err = f"parse_error: {parse_e}"
            elif r.status_code in (429, 500, 503):
                last_err = f"http_{r.status_code}"
            else:
                last_err = f"http_{r.status_code}: {r.text[:200]}"
        except Exception as e:
            last_err = str(e)

        # backoff nhẹ 0.2s * (attempt+1)
        time.sleep(0.2 * (attempt + 1))

    return 1, 0.0, {"error": last_err}

# ============================================================
# FastAPI app
# ============================================================
app = FastAPI(title="SmartSurvey AI Service")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    init_db()
    print("[startup] DB =", settings.DB_URL)
    print("[startup] External sentiment only (Gemini)")

# ============================================================
# Business helpers
# ============================================================

def fetch_answer_rows(db: Session, survey_id: int, question_id: Optional[int] = None):
    q = (
        db.query(Answer.answer_id, Answer.question_id, Answer.answer_text)
        .join(Response, Response.response_id == Answer.response_id)
        .filter(Response.survey_id == survey_id)
        .filter(func.length(func.trim(func.coalesce(Answer.answer_text, ""))) > 0)
    )
    if question_id is not None:
        q = q.filter(Answer.question_id == question_id)
    return q.order_by(Answer.answer_id.asc()).all()


def log_inference(
    survey_id: int,
    question_id: Optional[int],
    answer_id: Optional[int],
    raw_text: str,
    norm_text_val: str,
    source: str,
    pred_label: int,
    pred_conf: float,
    final_label: Optional[int],
    status: str,
    meta: Dict[str, Any],
):
    sql_exec(
        """
        INSERT INTO ai_inference
          (survey_id, question_id, answer_id, raw_text, norm_text, text_hash,
           embed, source, pred_label, pred_conf, final_label, status, meta_json, created_at, updated_at)
        VALUES
          (%s,%s,%s,%s,%s,%s,
           NULL,%s,%s,%s,%s,%s,%s,NOW(),NOW())
        ON DUPLICATE KEY UPDATE
          source=VALUES(source), pred_label=VALUES(pred_label), pred_conf=VALUES(pred_conf),
          final_label=VALUES(final_label), status=VALUES(status), meta_json=VALUES(meta_json), updated_at=NOW()
        """,
        (
            survey_id,
            question_id,
            answer_id,
            raw_text,
            norm_text_val,
            sha256(norm_text_val),
            source,
            int(pred_label),
            float(pred_conf),
            int(final_label) if final_label is not None else None,
            status,
            json.dumps(meta, ensure_ascii=False),
        ),
    )


def aggregate_percent(labels: List[int]) -> Dict[str, Any]:
    total = len(labels)
    c = {0: 0, 1: 0, 2: 0}
    for l in labels:
        c[l] = c.get(l, 0) + 1
    pct = lambda n: (n * 100.0 / total) if total else 0.0
    return {
        "total_responses": total,
        "positive_percent": pct(c[2]),
        "neutral_percent": pct(c[1]),
        "negative_percent": pct(c[0]),
        "counts": {"POS": c[2], "NEU": c[1], "NEG": c[0]},
        "sample_size": total,
    }


# ====== ONLY external: luôn gọi Gemini (vẫn cho phép cache hit theo text_hash) ======

def classify_and_log(survey_id: int, question_id: Optional[int], answer_id: Optional[int], raw: str) -> int:
    nt = norm_text(raw)

    # Chỉ gọi external API
    lid, conf, meta = call_external_sentiment(nt)
    status = "ok" if "error" not in meta else "needs_review"

    log_inference(
        survey_id, question_id, answer_id,
        raw, nt,
        source="ext",
        pred_label=int(lid), pred_conf=float(conf),
        final_label=int(lid if status=="ok" else 1),  # nếu lỗi thì ghi NEU làm final
        status=status,
        meta=meta
    )
    # Trả nhãn dựa vào external luôn (hoặc NEU nếu lỗi)
    return int(lid if status=="ok" else 1)


# ============================================================
# Health check endpoint
# ============================================================

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ai-sentiment"}

# ============================================================
# Endpoints sentiment
# ============================================================

@app.post("/ai/sentiment/{survey_id}")
def run_sentiment_now(survey_id: int, question_id: Optional[int] = None, db: Session = Depends(get_db)):
    rows = fetch_answer_rows(db, survey_id, question_id)
    if not rows:
        raise HTTPException(400, "Không có câu trả lời hợp lệ.")

    final_labels: List[int] = []
    for r in rows:
        lab = classify_and_log(survey_id, r.question_id, r.answer_id, r.answer_text or "")
        final_labels.append(lab)

    aggr = aggregate_percent(final_labels)
    rec = AiSentiment(
        survey_id=survey_id,
        total_responses=aggr["total_responses"],
        positive_percent=aggr["positive_percent"],
        neutral_percent=aggr["neutral_percent"],
        negative_percent=aggr["negative_percent"],
        details={"counts": aggr["counts"], "sample_size": aggr["sample_size"], "question_id": question_id},
        created_at=datetime.utcnow(),
    )
    db.add(rec); db.commit(); db.refresh(rec)

    db.add(ActivityLog(user_id=None, action_type="ai_generate",
                       target_id=rec.sentiment_id, target_table="ai_sentiment",
                       description=f"Recomputed with external API only (Gemini)") )
    db.commit()
    return {"survey_id": survey_id, "result": rec.sentiment_id, "created_at": str(rec.created_at)}


@app.get("/ai/sentiment/{survey_id}")
def get_latest_sentiment(survey_id: int, db: Session = Depends(get_db)):
    rec = (
        db.query(AiSentiment)
        .filter(AiSentiment.survey_id == survey_id)
        .order_by(AiSentiment.sentiment_id.desc())
        .first()
    )
    if not rec:
        raise HTTPException(404, "Chưa có bản ghi sentiment.")
    return {
        "survey_id": survey_id,
        "result": {
            "id": rec.sentiment_id,
            "total_responses": rec.total_responses,
            "positive_percent": float(rec.positive_percent),
            "neutral_percent": float(rec.neutral_percent),
            "negative_percent": float(rec.negative_percent),
            "details": rec.details,
            "created_at": rec.created_at,
            "updated_at": rec.updated_at,
        },
    }

# ============================================================
# Chat (RAG nội bộ đơn giản; không phụ thuộc sentiment model)
# ============================================================

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


def retrieve_topk(texts: List[str], query: str, top_k: int = 5) -> List[str]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    if not texts:
        return []
    top_k = max(1, min(int(top_k), 20))
    vec = TfidfVectorizer(ngram_range=(1, 2), max_features=20000)
    X = vec.fit_transform(texts)
    q = vec.transform([query])
    sims = cosine_similarity(q, X).ravel()
    idx = sims.argsort()[::-1][:top_k]
    return [texts[i] for i in idx]


def craft_answer(question: str, context: List[str]) -> str:
    if not context:
        return "Hiện chưa có phản hồi phù hợp để trả lời câu hỏi này."
    bullets = "\n".join([f"- {c}" for c in context[:3]])
    return f"Dựa trên các phản hồi cho câu hỏi: “{question}”:\n{bullets}\nTóm lại, xu hướng chung có thể rút ra từ các phản hồi trên."


def answer_count_query(db: Session, survey_id: int, question_text: str) -> Optional[str]:
    q = (question_text or "").lower()
    if not re.search(r"\b(bao nhiêu|bao %|bao phần trăm|bao phan tram)\b", q, re.IGNORECASE):
        return None
    if any(k in q for k in ["đồng ý", "dong y", "yes"]):
        count = db.execute(text("""
            SELECT COUNT(*) FROM answers a JOIN responses r ON a.response_id = r.response_id
            WHERE r.survey_id = :sid AND (a.answer_text LIKE '%đồng ý%' OR a.answer_text LIKE '%dong y%' OR a.answer_text LIKE '%Yes%')
        """), {"sid": survey_id}).scalar()
        return f"Có {count} câu trả lời Đồng ý/Yes trong survey {survey_id}."
    if any(k in q for k in ["không", "khong", "no"]):
        count = db.execute(text("""
            SELECT COUNT(*) FROM answers a JOIN responses r ON a.response_id = r.response_id
            WHERE r.survey_id = :sid AND (a.answer_text LIKE '%không%' OR a.answer_text LIKE '%khong%' OR a.answer_text LIKE '%No%')
        """), {"sid": survey_id}).scalar()
        return f"Có {count} câu trả lời chứa Không/No trong survey {survey_id}."
    m = re.search(r"bao nhiêu.*?(trả lời|answer|phản hồi|phan hoi)?\s*(.+)$", q)
    if m:
        kw = m.group(2).strip()
        if kw:
            count = db.execute(text("""
                SELECT COUNT(*) FROM answers a JOIN responses r ON a.response_id = r.response_id
                WHERE r.survey_id = :sid AND a.answer_text LIKE :kw
            """), {"sid": survey_id, "kw": f"%{kw}%"}).scalar()
            return f"Có {count} câu trả lời chứa \"{kw}\" trong survey {survey_id}."
    return None


@app.post("/ai/chat", response_model=ChatResponse)
def ai_chat(req: ChatRequest, db: Session = Depends(get_db)):
    try:
        q_norm = norm_text(req.question_text)
        count_answer = answer_count_query(db, req.survey_id, q_norm)
        if count_answer:
            answer, topk_ctx = count_answer, []
        else:
            texts = [r.answer_text for r in fetch_answer_rows(db, req.survey_id)]
            topk_ctx = retrieve_topk(texts, q_norm, req.top_k)
            answer = craft_answer(q_norm, topk_ctx)
        now = datetime.utcnow()
        chat = AiChatLog(
            survey_id=req.survey_id,
            user_id=req.user_id,
            question_text=req.question_text,
            ai_response=answer,
            context=json.dumps(topk_ctx, ensure_ascii=False),
        )
        db.add(chat); db.commit(); db.refresh(chat)
        db.add(ActivityLog(
            user_id=req.user_id, action_type="ai_query",
            target_id=chat.chat_id, target_table="ai_chat_logs",
            description=f"AI chat for survey_id={req.survey_id}",
        ))
        db.commit()
        return ChatResponse(
            survey_id=req.survey_id, question_text=req.question_text,
            answer_text=answer, context=topk_ctx,
            top_k=req.top_k, created_at=now,
        )
    except Exception as e:
        db.add(ActivityLog(
            user_id=req.user_id, action_type="ai_query_error",
            target_id=None, target_table="ai_chat_logs",
            description=f"Error: {e}",
        ))
        db.commit()
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI chat: {e}")

print("[startup] EXT_SENTI_URL =", os.getenv("EXT_SENTI_URL"))
print("[startup] EXT_SENTI_KEY set? ", bool(os.getenv("EXT_SENTI_KEY")))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
