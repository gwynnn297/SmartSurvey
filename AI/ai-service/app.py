from __future__ import annotations

import os
import json
import re
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

import pymysql
import requests
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.sql import text
from dotenv import load_dotenv
load_dotenv()

# ====== ML/NLP (không cần train) ======
from typing import List as _List
import math as _math
import numpy as _np
from sklearn.feature_extraction.text import TfidfVectorizer as _TfidfVectorizer
from sklearn.decomposition import TruncatedSVD as _SVD
from sklearn.cluster import KMeans as _KMeans
# --- Vietnamese tokenizer (with safe fallback) ---
try:
    from underthesea import word_tokenize as _vn_tok  # type: ignore

    def _tok_vi(s: str) -> str:
        # underthesea trả về chuỗi đã tách bằng dấu cách (format="text")
        return " ".join(_vn_tok(s or "", format="text").split())
except Exception:  # ImportError hoặc lỗi init model
    import re as _re

    def _tok_vi(s: str) -> str:
        # fallback cơ bản nếu underthesea chưa sẵn/có sự cố
        return _re.sub(r"\s+", " ", (s or "").strip())
import httpx
import time as _time


# ====== dự án sẵn có (KHÔNG dùng model train nội bộ) ======
# bạn giữ nguyên các module settings/db/model như dự án của bạn
from settings import settings
from db import init_db, SessionLocal, AiSentiment, Answer, Response, AiChatLog, ActivityLog

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

@app.get("/health")
def health_check():
    """Health check endpoint for AI service"""
    try:
        # Quick DB connection test
        with _conn() as con:
            con.cursor().execute("SELECT 1")
        return {"status": "healthy", "service": "ai-sentiment"}
    except Exception as e:
        return {"status": "unhealthy", "service": "ai-sentiment", "error": str(e)}

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
    return { "survey_id": survey_id,
        "sentiment_id": rec.sentiment_id,
        "total_responses": aggr["total_responses"],
        "positive_percent": aggr["positive_percent"],
        "neutral_percent": aggr["neutral_percent"],
        "negative_percent": aggr["negative_percent"],
        "counts": aggr["counts"],
        "created_at": str(rec.created_at)}


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

# ============================================================
# ===================== SPRINT 4 ADDITIONS ====================
# 1) Keywords (TF-IDF)
# 2) Basic Sentiment (rule-based, tiếng Việt)
# 3) Summary (Gemini)
# 4) Themes (TF-IDF -> SVD -> KMeans)
# 5) Get latest analysis by kind
# ============================================================


EXT_URL   = os.getenv("EXT_SENTI_URL") or os.getenv("EXT_SUMM_URL")
EXT_KEY   = os.getenv("EXT_SENTI_KEY")
EXT_TIMEOUT = float(os.getenv("EXT_SENTI_TIMEOUT", "15.0"))
EXT_RETRY   = int(os.getenv("EXT_SENTI_MAX_RETRY", "4"))
BATCH_SIZE  = int(os.getenv("SENTI_BATCH_SIZE", "50"))
BACKOFF_K   = float(os.getenv("SENTI_BACKOFF_BASE", "1.2"))
FORCE_EXTERNAL = os.getenv("FORCE_EXTERNAL_SENTI", "1") == "1"

def _vn_norm(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s

def _fetch_texts_by_survey(survey_id: int) -> _List[str]:
    rows = sql_all(
        """
        SELECT a.answer_text
        FROM answers a
        JOIN responses r ON r.response_id = a.response_id
        WHERE r.survey_id=%s AND a.answer_text IS NOT NULL AND TRIM(a.answer_text) <> ''
        ORDER BY a.answer_id ASC
        """,
        (survey_id,),
    )
    return [_vn_norm(r["answer_text"]) for r in rows]

def _save_analysis(survey_id: int, payload: dict, kind: str, analysis_type_override: str | None = None):
    atype = analysis_type_override or "INSIGHT"
    sql_exec(
        """
        INSERT INTO ai_analysis(survey_id, analysis_data, analysis_type)
        VALUES (%s, %s, %s)
        """,
        (survey_id, json.dumps({"kind": kind, **payload}, ensure_ascii=False), atype),
    )

# ---------- 1) Keywords ----------
def _extract_keywords(texts: _List[str], top_k: int = 15) -> _List[dict]:
    if not texts:
        return []

    corpus = [_tok_vi(t) for t in texts]  # <— dùng _tok_vi (đã có fallback)
    vec = _TfidfVectorizer(max_df=0.9, min_df=1, ngram_range=(1, 2))
    X = vec.fit_transform(corpus)
    scores = X.sum(axis=0).A1
    terms = vec.get_feature_names_out()
    pairs = sorted(zip(terms, scores), key=lambda x: x[1], reverse=True)[:top_k]
    return [{"keyword": k, "score": round(float(s), 4)} for k, s in pairs]

@app.post("/ai/keywords/{survey_id}", tags=["Analysis Service"])
def ai_keywords(survey_id: int):
    texts = _fetch_texts_by_survey(survey_id)
    kws = _extract_keywords(texts, top_k=15)
    _save_analysis(survey_id, {"keywords": kws, "total_responses": len(texts)}, "KEYWORDS")
    return {"ok": True, "count": len(texts), "keywords": kws}

# ---------- 2) Basic sentiment (Gemini-only batch) ----------
# Dùng các biến ENV đã có ở đầu file:
#   EXT_URL, EXT_KEY, EXT_TIMEOUT, EXT_MAX_RETRY, FORCE_EXTERNAL, BATCH_SIZE, BACKOFF_K

def _gemini_prompt_batch(items: list[str]) -> str:
    return (
        "Bạn là bộ phân loại cảm xúc TIẾNG VIỆT.\n"
        "Với danh sách các câu dưới đây, hãy TRẢ VỀ JSON Array, "
        "mỗi phần tử dạng: {\"i\": <index>, \"label\": \"POS|NEU|NEG\"}.\n"
        "- POS: tích cực; NEG: tiêu cực; NEU: trung lập.\n"
        "- Chỉ trả đúng 1 trong 3 nhãn POS/NEU/NEG cho mỗi câu.\n"
        "- TUYỆT ĐỐI không thêm văn bản ngoài JSON.\n\n"
        "DANH SÁCH CÂU:\n" +
        "\n".join([f"{i}. {items[i]}" for i in range(len(items))])
    )

def gemini_classify_batch(texts: List[str]) -> List[str]:
    """Trả list nhãn ('POS'|'NEU'|'NEG') cùng độ dài với texts. Lỗi ⇒ 'NEU'."""
    if not texts:
        return []
    labels = ["NEU"] * len(texts)
    payload = {"contents": [{"parts": [{"text": _gemini_prompt_batch(texts)}]}]}

    backoff = 0.0
    for attempt in range(1, EXT_RETRY + 1):
        try:
            with httpx.Client(timeout=float(EXT_TIMEOUT)) as client:
                r = client.post(f"{EXT_URL}?key={EXT_KEY}", json=payload)
                if r.status_code == 429:
                    backoff = backoff * BACKOFF_K + 0.7  # backoff tăng dần
                    _time.sleep(min(3.0, backoff))
                    r = client.post(f"{EXT_URL}?key={EXT_KEY}", json=payload)

                r.raise_for_status()
                data = r.json()
                text_out = (
                    (data.get("candidates") or [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                t = text_out.strip()
                first, last = t.find('['), t.rfind(']')
                if first != -1 and last != -1 and last > first:
                    t = t[first:last+1]

                arr = json.loads(t)
                for obj in arr:
                    i = obj.get("i")
                    lab = (obj.get("label") or "").strip().upper()
                    if isinstance(i, int) and 0 <= i < len(labels) and lab in {"POS","NEU","NEG"}:
                        labels[i] = lab
                return labels
        except Exception:
            _time.sleep(0.5 * attempt)

    return labels


@app.post("/ai/basic-sentiment/{survey_id}", tags=["Analysis Service"])
def ai_basic_senti(survey_id: int):
    texts_all = _fetch_texts_by_survey(survey_id)
    if not texts_all:
        payload = {"total": 0, "counts": {"POS": 0, "NEU": 0, "NEG": 0}}
        _save_analysis(survey_id, payload, "BASIC_SENTI")
        return {"ok": True, **payload}

    counts = {"POS": 0, "NEU": 0, "NEG": 0}

    if FORCE_EXTERNAL:
        labels_all: List[str] = []
        for i in range(0, len(texts_all), BATCH_SIZE):
            batch = texts_all[i:i + BATCH_SIZE]
            labels_all.extend(gemini_classify_batch(batch))
            _time.sleep(0.25)

        for lab in labels_all:
            counts[lab] += 1
    else:
        counts["NEU"] = len(texts_all)

    payload = {"total": len(texts_all), "counts": counts}
    _save_analysis(survey_id, payload, "BASIC_SENTI")
    return {"ok": True, **payload}


# ---------- 3) Summarization (Gemini) ----------
GEMINI_URL = os.getenv("EXT_SUMM_URL")
GEMINI_KEY = os.getenv("EXT_SENTI_KEY")

def _local_summary(responses: list[str], max_bullets: int = 5) -> str:
    """Tóm tắt local đơn giản: chọn một vài câu “tiêu biểu” bằng TF-IDF."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    import numpy as np
    texts = [t.strip() for t in responses if t and t.strip()]
    if not texts:
        return "Không có dữ liệu để tóm tắt."

    # cắt dữ liệu để tránh quá dài
    MAX_RESP = int(os.getenv("SUMMARY_MAX_RESP", "120"))
    texts = texts[:MAX_RESP]

    # tách câu (nếu không có dấu câu thì coi mỗi phản hồi là 1 câu)
    sents = []
    for t in texts:
        parts = re.split(r"(?<=[.!?])\s+|\n+", t)
        sents.extend([p.strip() for p in parts if p.strip()])
    sents = sents[:800]
    if not sents:
        return "Không có dữ liệu để tóm tắt."

    vec = TfidfVectorizer(max_df=0.9, min_df=1, ngram_range=(1, 2))
    X = vec.fit_transform(sents)
    scores = X.sum(axis=1).A1
    idx = scores.argsort()[::-1][:max_bullets]
    picks = [sents[i] for i in sorted(idx)]  # giữ thứ tự tự nhiên
    return "- " + "\n- ".join(picks)

def _gemini_summarize(responses: _List[str]) -> str:
    if not responses:
        return "Không có dữ liệu để tóm tắt."

    # hạn chế độ dài input để giảm rủi ro 429
    MAX_RESP = int(os.getenv("SUMMARY_MAX_RESP", "120"))
    MAX_CHARS = int(os.getenv("SUMMARY_MAX_CHARS", "6000"))
    joined = "\n- ".join([r.strip() for r in responses if r][:MAX_RESP])[:MAX_CHARS]

    prompt = (
        "Tóm tắt ngắn gọn (3-5 bullet) các ý chính từ danh sách phản hồi tiếng Việt dưới đây. "
        "Nhấn mạnh điểm tích cực, tiêu cực và đề xuất cải tiến nếu có.\n\n"
        "Danh sách phản hồi:\n- " + joined
    )
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    # nếu chưa có key → dùng local summary
    if not GEMINI_KEY or not GEMINI_URL:
        return _local_summary(responses)

    try:
        with httpx.Client(timeout=float(os.getenv("EXT_SENTI_TIMEOUT", "12.0"))) as client:
            r = client.post(f"{GEMINI_URL}?key={GEMINI_KEY}", json=payload)

        if r.status_code == 200:
            data = r.json()
            cand = (data.get("candidates") or [{}])[0]
            content = cand.get("content") or {}
            parts = content.get("parts") or [{}]
            txt = parts[0].get("text")
            if isinstance(txt, str) and txt.strip():
                return txt
            # fallback nếu proxy trả field khác
            if isinstance(data, dict) and "text" in data and str(data["text"]).strip():
                return str(data["text"])
            return _local_summary(responses)

        # lỗi: đọc body để phân biệt rate/quota
        try:
            err = r.json()
        except Exception:
            err = {"text": r.text}
        status = (err.get("error") or {}).get("status") or err.get("status") or ""
        # nếu là 429 / RESOURCE_EXHAUSTED → fallback cục bộ
        if r.status_code == 429 or str(status).upper() in {"RATE_LIMIT_EXCEEDED", "RESOURCE_EXHAUSTED"}:
            return _local_summary(responses)
        # các lỗi khác: trả thông báo ngắn kèm fallback
        return f"Không tóm tắt được (HTTP {r.status_code}: {status}).\n" + _local_summary(responses)

    except Exception as e:
        return f"Không tóm tắt được. Lỗi: {e}\n" + _local_summary(responses)

# ---- throttle đơn giản cho /ai/summary ----
_SUMMARY_THROTTLE = {}

def _allow_summary_call(sid: int, window: int = int(os.getenv("SUMMARY_THROTTLE_SEC", "10"))) -> bool:
    import time
    now = time.time()
    last = _SUMMARY_THROTTLE.get(sid, 0)
    if now - last < window:
        return False
    _SUMMARY_THROTTLE[sid] = now
    return True

@app.post("/ai/summary/{survey_id}", tags=["Analysis Service"])
def ai_summary(survey_id: int):
    if not _allow_summary_call(survey_id):
        return {"ok": False, "summary": "Đang giới hạn tần suất, vui lòng thử lại sau vài giây.", "count": 0}
    texts = _fetch_texts_by_survey(survey_id)
    summ = _gemini_summarize(texts)
    _save_analysis(survey_id, {"summary": summ, "sample_size": len(texts)}, "SUMMARY", analysis_type_override="SUMMARY")
    return {"ok": True, "summary": summ, "count": len(texts)}

# ---------- 4) Theme clustering (TF-IDF -> SVD -> KMeans) ----------
def _pick_k(n: int) -> int:
    if n <= 8: return 2
    return min(8, max(3, int(_math.sqrt(n))))

def _cluster_themes(texts: _List[str], k: int | None = None):
    if not texts:
        return []
    corpus = [_tok_vi(t) for t in texts]  # <— dùng _tok_vi
    tfidf = _TfidfVectorizer(max_df=0.9, min_df=1, ngram_range=(1,2), max_features=5000)
    X = tfidf.fit_transform(corpus)

    from sklearn.decomposition import TruncatedSVD as _SVD
    n_comp = max(2, min(100, X.shape[1] // 2))
    svd = _SVD(n_components=n_comp, random_state=42)
    Xr = svd.fit_transform(X)

    from sklearn.cluster import KMeans as _KMeans
    import numpy as _np
    kk = k or _pick_k(len(texts))
    km = _KMeans(n_clusters=kk, n_init="auto", random_state=42)
    labels = km.fit_predict(Xr)

    themes = []
    for c in range(kk):
        idx = _np.where(labels == c)[0]
        if not len(idx): 
            continue
        center = km.cluster_centers_[c]
        dists = _np.linalg.norm(Xr[idx] - center, axis=1)
        order = idx[_np.argsort(dists)]
        reps = [texts[i] for i in order[: min(3, len(order))]]
        themes.append({"cluster": int(c), "size": int(len(idx)), "examples": reps})
    themes.sort(key=lambda x: -x["size"])
    return themes

@app.post("/ai/themes/{survey_id}", tags=["Analysis Service"])
def ai_themes(survey_id: int, k: int | None = None):
    texts = _fetch_texts_by_survey(survey_id)
    themes = _cluster_themes(texts, k=k)
    _save_analysis(survey_id, {"themes": themes, "k": len(themes), "total": len(texts)}, "THEMES")
    return {"ok": True, "k": len(themes), "themes": themes}

# ---------- 5) Get latest analysis by kind ----------
@app.get("/ai/analysis/{survey_id}/latest/{kind}", tags=["Analysis Service"])
def get_latest_analysis(survey_id: int, kind: str):
    # kind in: KEYWORDS | THEMES | SUMMARY | BASIC_SENTI
    rows = sql_all(
        """
        SELECT analysis_id, analysis_data, analysis_type, created_at
        FROM ai_analysis
        WHERE survey_id=%s
        ORDER BY created_at DESC, analysis_id DESC
        LIMIT 50
        """,
        (survey_id,),
    )
    for r in rows:
        try:
            data = json.loads(r["analysis_data"]) if isinstance(r["analysis_data"], str) else r["analysis_data"]
            if data.get("kind") == kind or (kind == "SUMMARY" and r.get("analysis_type") == "SUMMARY"):
                return {"ok": True, "data": data, "analysis_id": r["analysis_id"], "analysis_type": r["analysis_type"]}
        except Exception:
            continue
    return {"ok": False, "message": f"No analysis with kind={kind}"}

# ============================================================
# ============ SPRINT 4 (Optimal): Survey Generation =========
# - Templates/rules in DB tables (no survey_id FK)
# - Gemini generation + validator (rules from DB)
# - History into ai_survey_gen_history
# ============================================================

from pydantic import BaseModel, Field
from typing import Optional as _Opt, List as _L, Dict as _D
import json, os, re, time
import httpx

# -------- ENV / runtime knobs --------
GEMINI_URL  = os.getenv("GEMINI_URL") or os.getenv("EXT_SENTI_URL") \
              or "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GEMINI_KEY  = os.getenv("GEMINI_KEY") or os.getenv("EXT_SENTI_KEY") or ""
GEN_TIMEOUT = float(os.getenv("GEN_TIMEOUT", "12.0"))
GEN_RETRY   = int(os.getenv("GEN_MAX_RETRY", "3"))
GEN_BACKOFF = float(os.getenv("GEN_BACKOFF_K", "1.4"))
CFG_TTL_SEC = float(os.getenv("SURVEY_CFG_TTL_SEC", "300"))
POOL_N      = int(os.getenv("SURVEY_GEN_POOL", "12"))

# -------- In-memory cache for config --------
_CFG = {"loaded_at": 0.0, "templates_by_industry": {}, "rules": {"BLOCK": [], "LEADING": []}}

def _cfg_reload(force=False):
    now = time.time()
    if not force and now - _CFG["loaded_at"] < CFG_TTL_SEC:
        return

    # 1) Load templates từ ai_survey_industry
    rows = sql_all("""
        SELECT code AS industry, COALESCE(templates, '[]') AS tpls
        FROM ai_survey_industry
        WHERE is_active = 1
    """, ())
    tpl_map = {}
    for r in rows or []:
        ind = r["industry"] if isinstance(r, dict) else r[0]
        tpls_json = r["tpls"] if isinstance(r, dict) else r[1]
        try:
            tpl_map[ind] = json.loads(tpls_json or "[]")
        except Exception:
            tpl_map[ind] = []

    # 2) Load rules từ ai_survey_rule (map rule_type -> kind, pattern -> value)
    rows = sql_all("""
        SELECT
          CASE WHEN rule_type = 'LEADING' THEN 'LEADING' ELSE 'BLOCK' END AS kind,
          pattern AS value,
          COALESCE(lang, 'vi') AS lang
        FROM ai_survey_rule
        WHERE is_active = 1
    """, ())
    rules = {"BLOCK": [], "LEADING": []}
    for r in rows or []:
        kind = r["kind"] if isinstance(r, dict) else r[0]
        value = r["value"] if isinstance(r, dict) else r[1]
        lang  = r["lang"]  if isinstance(r, dict) else r[2]
        if lang == "vi" and (value or "").strip():
            rules[kind].append(value.strip())

    _CFG["templates_by_industry"] = tpl_map
    _CFG["rules"] = rules
    _CFG["loaded_at"] = now

def _get_templates(industry: str) -> list[str]:
    _cfg_reload(False)
    m = _CFG["templates_by_industry"]
    return m.get(industry) or m.get("general", []) or []

def _rules():
    _cfg_reload(False)
    r = _CFG["rules"]
    return set(map(str.lower, r.get("BLOCK", []))), list(map(str.lower, r.get("LEADING", [])))

# -------- Schemas --------
class TemplatePack(BaseModel):
    industry: str = Field(..., description="e.g., retail, education, fintech, ...")
    templates: _L[str]

class GenReq(BaseModel):
    topic: str
    industry: str = "general"
    n: int = Field(10, ge=3, le=30)
    language: str = "vi"
    use_llm: bool = True
    survey_id: _Opt[int] = Field(None, description="(optional) attach to a real survey when storing history")
    user_id: _Opt[int] = None

class GenResp(BaseModel):
    topic: str
    industry: str
    language: str
    n: int
    questions: _L[str]
    source: str               # gemini | fallback
    validation: _D[str, int]
    history_id: _Opt[int] = None

# -------- Validator --------
def _validate(qs: _L[str]) -> _L[str]:
    block, leading = _rules()
    out, seen = [], set()
    for q in qs:
        q = re.sub(r"\s+", " ", (q or "").strip())
        if not q: continue
        tl = q.lower()
        if any(p in tl for p in leading):  # loại dẫn dắt
            continue
        if any(w in tl for w in block):    # loại cảm tính/cường điệu
            continue
        if not q.endswith("?"):
            q += "?"
        if len(q) < 8 or len(q) > 300:     # độ dài an toàn
            continue
        key = tl
        if key in seen:  # bỏ trùng
            continue
        seen.add(key)
        out.append(q)
    return out

# -------- Fallback (TF-IDF trên templates DB) --------
def _fallback(topic: str, industry: str, n: int) -> _L[str]:
    pool = _get_templates(industry)
    if not pool:
        pool = [
            "Bạn đánh giá mức độ hài lòng chung về {topic} như thế nào?",
            "Những điều cần cải thiện đối với {topic} là gì?",
            "Bạn có sẵn sàng giới thiệu {topic} cho người khác không?",
            "Những yếu tố ảnh hưởng lớn nhất đến trải nghiệm với {topic} là gì?",
            "Góp ý cụ thể để nâng cao chất lượng {topic}."
        ]
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        import numpy as _np
        vec = TfidfVectorizer(ngram_range=(1,2), max_features=3000)
        X = vec.fit_transform(pool)
        qv = vec.transform([topic])
        sims = (qv @ X.T).A1
        idx = sims.argsort()[::-1][:max(n, min(POOL_N, len(pool)))]
        picked = [pool[i].format(topic=topic) for i in idx]
        return picked[:n]
    except Exception:
        # nếu sklearn không có, trả ngẫu nhiên đơn giản
        return [t.format(topic=topic) for t in pool][:n]

# -------- Gemini caller (JSON array string) --------
def _gemini_call(payload: dict) -> _L[str]:
    backoff = 0.0
    for _try in range(1, GEN_RETRY+1):
        try:
            with httpx.Client(timeout=GEN_TIMEOUT) as cli:
                r = cli.post(f"{GEMINI_URL}?key={GEMINI_KEY}", json=payload)
            if r.status_code == 429:
                backoff = backoff * GEN_BACKOFF + 0.7
                time.sleep(min(3.0, backoff))
                continue
            r.raise_for_status()
            data = r.json()
            txt = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "[]").strip()
            arr = json.loads(txt) if txt.startswith("[") else []
            return [str(x) for x in arr]
        except Exception:
            time.sleep(0.25 * _try)
    return []

def _prompt(topic: str, industry: str, n: int, lang: str) -> dict:
    tpls = _get_templates(industry)[:15]
    schema = {"type":"array","items":{"type":"string"},"minItems":max(3,n),"maxItems":max(3,n)}
    guidance = (
        f"Bạn là chuyên gia thiết kế khảo sát bằng tiếng {'Việt' if lang=='vi' else 'Anh'}.\n"
        f"Chủ đề: {topic}\nNgành: {industry}\n"
        f"Yêu cầu: sinh đúng {n} câu hỏi rõ ràng, một ý, tránh dẫn dắt/cường điệu, kết thúc bằng dấu hỏi.\n"
        f"Tham khảo các pattern (nếu phù hợp, thay {{topic}} đúng ngữ cảnh):\n" +
        "\n".join(f"- {t}" for t in tpls) +
        "\nChỉ trả JSON Array các chuỗi câu hỏi, không kèm giải thích."
    ).strip()
    return {
        "contents": [{"parts": [{"text": guidance}]}],
        "generationConfig": {
            "temperature": 0.2, "topP": 1, "topK": 1, "candidateCount": 1,
            "responseMimeType": "application/json",
            "responseSchema": schema
        }
    }

# -------- Endpoints: config (templates/rules) --------
@app.post("/ai/survey/templates/upsert", tags=["SurveyGen"])
def upsert_template_pack(pack: TemplatePack):
    sql_exec("""
        INSERT INTO ai_survey_industry (code, name, templates, is_active, updated_at)
        VALUES (%s, %s, %s, 1, NOW())
        ON DUPLICATE KEY UPDATE
            templates = VALUES(templates),
            is_active = 1,
            updated_at = NOW()
    """, (pack.industry, pack.industry, json.dumps(pack.templates, ensure_ascii=False)))
    _cfg_reload(True)
    return {"ok": True, "industry": pack.industry, "count": len(pack.templates)}


@app.get("/ai/survey/templates", tags=["SurveyGen"])
def list_template_packs():
    _cfg_reload(True)
    rows = sql_all("""
        SELECT code AS industry,
               JSON_LENGTH(templates) AS size,
               is_active,
               updated_at
        FROM ai_survey_industry
        ORDER BY code
    """, ())
    out = []
    for r in rows or []:
        ind        = r["industry"] if isinstance(r, dict) else r[0]
        size       = r["size"]     if isinstance(r, dict) else r[1]
        is_active  = r["is_active"]if isinstance(r, dict) else r[2]
        updated_at = r["updated_at"] if isinstance(r, dict) else r[3]
        out.append({
            "industry": ind,
            "size": int(size or 0),
            "is_active": bool(is_active),
            "updated_at": str(updated_at) if updated_at else None
        })
    return {"ok": True, "packs": out}

class RuleReq(BaseModel):
    rule_type: str = Field(..., pattern="^(BLOCK|LEADING)$")
    pattern: str
    lang: str = "vi"
    is_active: bool = True
    industry_code: _Opt[str] = None  # nếu không dùng theo ngành, để None

@app.post("/ai/survey/rules/add", tags=["SurveyGen"])
def add_rule(req: RuleReq):
    sql_exec("""
        INSERT INTO ai_survey_rule (industry_code, rule_type, pattern, lang, is_active)
        VALUES (%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
            is_active = VALUES(is_active),
            pattern   = VALUES(pattern),
            lang      = VALUES(lang)
    """, (req.industry_code, req.rule_type, req.pattern.strip(), req.lang, 1 if req.is_active else 0))
    _cfg_reload(True)
    return {"ok": True}

@app.post("/ai/survey/config/reload", tags=["SurveyGen"])
def reload_cfg():
    _cfg_reload(True)
    m = _CFG.get("templates_by_industry", {})
    r = _CFG.get("rules", {"BLOCK": [], "LEADING": []})
    return {
        "ok": True,
        "templates_industries": len(m),
        "rules_block": len(r.get("BLOCK", [])),
        "rules_leading": len(r.get("LEADING", []))
    }

# -------- Endpoint: generate --------
@app.post("/ai/survey/generate", response_model=GenResp, tags=["SurveyGen"])
def survey_generate(req: GenReq, db: Session = Depends(get_db)):
    _cfg_reload(False)
    if req.use_llm and GEMINI_KEY and GEMINI_URL:
        raw = _gemini_call(_prompt(req.topic, req.industry, req.n, req.language))
        source = "gemini" if raw else "fallback"
    else:
        raw, source = [], "fallback"
    if not raw:
        raw = _fallback(req.topic, req.industry, req.n)

    # thay {topic} và validate
    raw = [q.replace("{topic}", req.topic) for q in raw]
    cleaned = _validate(raw)
    if len(cleaned) < req.n:
        # bù thêm từ pool fallback
        extra = _validate(_fallback(req.topic, req.industry, POOL_N))
        merged = []
        seen = set()
        for q in cleaned + extra:
            k = q.casefold()
            if k in seen: continue
            seen.add(k); merged.append(q)
        cleaned = merged[:req.n]

    # lưu lịch sử (không buộc survey_id)
    payload = {
        "topic": req.topic, "industry": req.industry, "language": req.language,
        "n": req.n, "questions": cleaned
    }
    sql_exec("""
        INSERT INTO ai_survey_gen_history (survey_id, topic, industry, language, n, source, payload)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (req.survey_id, req.topic, req.industry, req.language, req.n, source, json.dumps(payload, ensure_ascii=False)))
    row = sql_one("SELECT LAST_INSERT_ID() AS id")
    hist_id = int(row["id"]) if row and "id" in row else None

    # (an toàn) ghi activity log nếu bạn đã có model ActivityLog
    try:
        db.add(ActivityLog(
            user_id=req.user_id, action_type="ai_generate",
            target_id=hist_id, target_table="ai_survey_gen_history",
            description=f"SurveyGen {req.industry} / {req.topic}"
        ))
        db.commit()
    except Exception:
        db.rollback()

    return GenResp(
        topic=req.topic, industry=req.industry, language=req.language, n=req.n,
        questions=cleaned, source=source,
        validation={"unique": len({q.casefold() for q in cleaned}), "total": len(cleaned)},
        history_id=hist_id
    )

# -------- Optional: quick seed (≥5 industries) --------
@app.post("/ai/survey/templates/seed", tags=["SurveyGen"])
def seed_templates():
    seeds = {
        "general": [
            "Bạn đánh giá mức độ hài lòng chung về {topic} như thế nào?",
            "Những điều cần cải thiện đối với {topic} là gì?",
            "Bạn có sẵn sàng giới thiệu {topic} cho người khác không?",
            "Những yếu tố ảnh hưởng lớn nhất đến trải nghiệm với {topic} là gì?",
            "Góp ý cụ thể để nâng cao chất lượng {topic}."
        ],
        "education": [
            "Nội dung {topic} có rõ ràng và bám sát mục tiêu học tập không?",
            "Tốc độ và khối lượng bài tập của {topic} có phù hợp không?",
            "Mức độ hỗ trợ của giảng viên/assistant cho {topic} như thế nào?",
            "Tài liệu và công cụ cho {topic} có đầy đủ/dễ dùng không?",
            "Bạn mong muốn cải thiện gì cho {topic}?"
        ],
        "retail": [
            "Bạn hài lòng thế nào với chất lượng sản phẩm liên quan {topic}?",
            "Giá cả/khuyến mãi cho {topic} có hợp lý?",
            "Quy trình thanh toán/giao hàng {topic} có thuận tiện?",
            "Dịch vụ bảo hành/hậu mãi cho {topic} như thế nào?",
            "Bạn có sẵn sàng mua lại/giới thiệu {topic}?"
        ],
        "fintech": [
            "Trải nghiệm đăng ký/KYC cho {topic} có dễ dàng?",
            "Tốc độ/độ ổn định giao dịch của {topic} có đáp ứng nhu cầu?",
            "Thông tin phí và điều khoản của {topic} có minh bạch?",
            "Bạn đánh giá mức độ an toàn/bảo mật của {topic} như thế nào?",
            "CSKH của {topic} có phản hồi kịp thời?"
        ],
        "healthcare": [
            "Thời gian chờ và quy trình cho {topic} có hợp lý?",
            "Thái độ và chuyên môn của nhân viên y tế đối với {topic} như thế nào?",
            "Cơ sở vật chất/vệ sinh liên quan {topic} có đảm bảo?",
            "Chi phí cho {topic} có phù hợp với chất lượng nhận được?",
            "Bạn có yên tâm giới thiệu dịch vụ {topic} cho người khác?"
        ]
    }
    for ind, tpls in seeds.items():
        sql_exec("""
            INSERT INTO ai_survey_industry (code, name, templates, is_active, updated_at)
            VALUES (%s, %s, %s, 1, NOW())
            ON DUPLICATE KEY UPDATE
                templates = VALUES(templates),
                is_active = 1,
                updated_at = NOW()
        """, (ind, ind, json.dumps(tpls, ensure_ascii=False)))
    _cfg_reload(True)
    return {"ok": True, "seeded": list(seeds.keys())}

