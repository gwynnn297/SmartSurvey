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

app = FastAPI(title="SmartSurvey AI Service")   

# =================== AI OPTIMIZATION PRIMITIVES ===================
import threading, time as _t, random
from collections import OrderedDict, deque

# --- LRU Cache with TTL ---
class _LRUCacheTTL:
    def __init__(self, maxsize=10000, ttl=3600.0):
        self.maxsize = maxsize; self.ttl = ttl
        self._data = OrderedDict(); self._lock = threading.Lock()
    def get(self, key):
        with self._lock:
            item = self._data.get(key)
            if not item: return None
            val, ts = item
            if _t.time() - ts > self.ttl:
                self._data.pop(key, None); return None
            self._data.move_to_end(key); return val
    def set(self, key, value):
        with self._lock:
            if key in self._data: self._data.move_to_end(key)
            self._data[key] = (value, _t.time())
            if len(self._data) > self.maxsize:
                self._data.popitem(last=False)

CLASSIFY_CACHE = _LRUCacheTTL(
    maxsize=int(os.getenv("CACHE_CLASSIFY_MAX","20000")),
    ttl=float(os.getenv("CACHE_CLASSIFY_TTL","86400"))
)
SUMMARY_CACHE  = _LRUCacheTTL(
    maxsize=int(os.getenv("CACHE_SUMMARY_MAX","2000")),
    ttl=float(os.getenv("CACHE_SUMMARY_TTL","86400"))
)

def _hash_text_for_cache(s: str) -> str:
    return sha256(norm_text(s))

def _label_cache_key(text: str, variant: str = "A") -> str:
    return f"label:{variant}:{_hash_text_for_cache(text)}"

# --- Circuit Breaker + Retry wrapper (dùng chung cho Gemini) ---
class _Circuit:
    def __init__(self, fails_to_open=8, cooldown=30.0):
        self.fails = 0; self.open_until = 0.0
        self.fails_to_open = fails_to_open; self.cooldown = cooldown
    def is_open(self): return _t.time() < self.open_until
    def record(self, ok: bool):
        if ok: self.fails = 0; self.open_until = 0.0; return
        self.fails += 1
        if self.fails >= self.fails_to_open:
            self.open_until = _t.time() + self.cooldown

_GEMINI_CB = _Circuit(
    fails_to_open=int(os.getenv("CB_FAILS","8")),
    cooldown=float(os.getenv("CB_COOLDOWN","30"))
)

def call_gemini_json(url: str, key: str, payload: dict, timeout: float, max_retry: int = 4) -> dict:
    if _GEMINI_CB.is_open():
        raise RuntimeError("CircuitOpen")
    for attempt in range(max_retry+1):
        try:
            with httpx.Client(timeout=timeout) as client:
                r = client.post(f"{url}?key={key}", json=payload)
                if r.status_code == 429:
                    raise RuntimeError("RateLimited")
                r.raise_for_status()
                _GEMINI_CB.record(True)
                return r.json()
        except Exception:
            _GEMINI_CB.record(False)
            if attempt >= max_retry: raise
            # exp backoff + jitter
            back = min(3.0, (0.2 * (2**attempt))) + random.uniform(0, 0.2)
            _t.sleep(back)

# --- Token-bucket rate limiting ---
class TokenBucket:
    def __init__(self, rate_per_sec: float, burst: int):
        self.rate = rate_per_sec; self.capacity = burst
        self.tokens = burst; self.ts = _t.time(); self._lock = threading.Lock()
    def allow(self, n=1):
        with self._lock:
            now = _t.time()
            delta = now - self.ts; self.ts = now
            self.tokens = min(self.capacity, self.tokens + delta * self.rate)
            if self.tokens >= n: self.tokens -= n; return True
            return False

BUCKETS = {
    "classify": TokenBucket(float(os.getenv("RL_CLASSIFY_RPS","5")), int(os.getenv("RL_CLASSIFY_BURST","10"))),
    "summary":  TokenBucket(float(os.getenv("RL_SUMMARY_RPS","1")),  int(os.getenv("RL_SUMMARY_BURST","2"))),
}

# --- A/B assignment ---
def assign_bucket_by_hash(text_or_id: str, traffic_b: int = int(os.getenv("AB_TRAFFIC_B","20"))) -> str:
    try:
        h = int(sha256(str(text_or_id))[:6], 16) % 100
        return "B" if h < traffic_b else "A"
    except Exception:
        return "A"

# --- Lightweight in-memory metrics + endpoint (/ai/metrics) ---
_METRICS = {
    "classify_calls": 0, "classify_success": 0, "classify_cache_hit": 0, "classify_latency_ms": deque(maxlen=4000),
    "summary_calls":  0, "summary_success":  0, "summary_cache_hit":  0, "summary_latency_ms":  deque(maxlen=1000),
}
def _rec_latency(key: str, ms: float): _METRICS[key].append(ms)
def _p(vals: deque, q: float) -> float:
    if not vals: return 0.0
    xs = sorted(vals); idx = min(len(xs)-1, int(q*(len(xs)-1))); return xs[idx]

@app.get("/ai/metrics")
def ai_metrics():
    return {
        "classify": {
            "calls": _METRICS["classify_calls"], "success": _METRICS["classify_success"],
            "cache_hit": _METRICS["classify_cache_hit"],
            "p50_ms": _p(_METRICS["classify_latency_ms"], 0.50),
            "p95_ms": _p(_METRICS["classify_latency_ms"], 0.95),
            "success_rate": 100.0 * _METRICS["classify_success"] / max(1, _METRICS["classify_calls"]),
        },
        "summary": {
            "calls": _METRICS["summary_calls"], "success": _METRICS["summary_success"],
            "cache_hit": _METRICS["summary_cache_hit"],
            "p50_ms": _p(_METRICS["summary_latency_ms"], 0.50),
            "p95_ms": _p(_METRICS["summary_latency_ms"], 0.95),
            "success_rate": 100.0 * _METRICS["summary_success"] / max(1, _METRICS["summary_calls"]),
        }
    }
# ================= END AI OPTIMIZATION PRIMITIVES ===============

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
    db.add(rec)
    db.flush()  # có ngay rec.sentiment_id

    db.add(ActivityLog(
        user_id=None, action_type="ai_generate",
        target_id=rec.sentiment_id, target_table="ai_sentiment",
        description="Recomputed with external API only (Gemini)"
    ))
    db.commit()
    db.refresh(rec)

    # Giữ payload đầy đủ để FE cũ không gãy
    return {
        "survey_id": survey_id,
        "sentiment_id": rec.sentiment_id,
        "total_responses": aggr["total_responses"],
        "positive_percent": aggr["positive_percent"],
        "neutral_percent": aggr["neutral_percent"],
        "negative_percent": aggr["negative_percent"],
        "counts": aggr["counts"],
        "created_at": str(rec.created_at),
    }


from fastapi import Query

@app.get("/ai/sentiment/{survey_id}")
def get_latest_sentiment(
    survey_id: int,
    compact: int = Query(default=0, ge=0, le=1),   # ?compact=1 => chỉ trả 3 %
    db: Session = Depends(get_db),
):
    rec = (
        db.query(AiSentiment)
        .filter(AiSentiment.survey_id == survey_id)
        .order_by(AiSentiment.sentiment_id.desc())
        .first()
    )
    if not rec:
        raise HTTPException(404, "Chưa có bản ghi sentiment.")

    if compact == 1:
        # ✅ ĐÚNG yêu cầu Acceptance: chỉ trả % cho FE mới
        return {
            "positive_percent": float(rec.positive_percent),
            "neutral_percent": float(rec.neutral_percent),
            "negative_percent": float(rec.negative_percent),
        }

    # Giữ payload đầy đủ (tương thích FE cũ)
    det = rec.details or {}
    return {
        "survey_id": survey_id,
        "sentiment_id": rec.sentiment_id,
        "total_responses": rec.total_responses,
        "positive_percent": float(rec.positive_percent),
        "neutral_percent": float(rec.neutral_percent),
        "negative_percent": float(rec.negative_percent),
        "counts": det.get("counts"),
        "created_at": str(rec.created_at),
        "updated_at": str(rec.updated_at) if rec.updated_at else None,
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
        JOIN questions q ON q.question_id = a.question_id
        WHERE r.survey_id=%s 
        AND a.answer_text IS NOT NULL 
        AND TRIM(a.answer_text) <> ''
        AND q.question_type = 'open_ended'
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

def gemini_classify_batch(texts: List[str], variant: str | None = None) -> List[str]:
    """Trả list nhãn ('POS'|'NEU'|'NEG'). Lỗi ⇒ 'NEU'."""
    if not texts: return []
    labels = ["NEU"] * len(texts)

    # 1) A/B variant
    variant = variant or assign_bucket_by_hash(texts[0] if texts else "batch")

    # 2) Cache hit trước
    miss_idx, miss_texts = [], []
    for i, t in enumerate(texts):
        ck = _label_cache_key(t, variant)
        val = CLASSIFY_CACHE.get(ck)
        if val:
            labels[i] = val
            _METRICS["classify_cache_hit"] += 1
        else:
            miss_idx.append(i); miss_texts.append(t)

    if not miss_texts:
        return labels

    # 3) De-dup trong batch miss
    uniq_list, uniq_map = [], {}
    for i, t in zip(miss_idx, miss_texts):
        h = _hash_text_for_cache(t)
        if h not in uniq_map:
            uniq_map[h] = []
            uniq_list.append(t)
        uniq_map[h].append(i)

    # 4) Tạo prompt theo variant
    def _prompt_A(items: list[str]) -> str:
        return (
            "Bạn là bộ phân loại cảm xúc TIẾNG VIỆT.\n"
            "Trả về JSON Array: [{\"i\":<index>,\"label\":\"POS|NEU|NEG\"}] cho các câu sau:\n" +
            "\n".join([f"{i}. {items[i]}" for i in range(len(items))])
        )
    def _prompt_B(items: list[str]) -> str:
        return (
            "Classify Vietnamese sentiments. Output *only* JSON array [{\"i\":int,\"label\":\"POS|NEU|NEG\"}].\n" +
            "\n".join([f"{i}. {items[i]}" for i in range(len(items))])
        )
    prompt = _prompt_B(uniq_list) if variant == "B" else _prompt_A(uniq_list)
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    # 5) Gọi Gemni qua wrapper (retry + jitter + circuit breaker)
    _METRICS["classify_calls"] += 1
    t0 = _time.perf_counter()
    try:
        data = call_gemini_json(EXT_URL, EXT_KEY, payload, timeout=float(EXT_TIMEOUT), max_retry=int(EXT_RETRY))
        text_out = ((data.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")).strip()
        # cắt ra JSON array
        first, last = text_out.find('['), text_out.rfind(']')
        if first != -1 and last != -1 and last > first:
            text_out = text_out[first:last+1]
        arr = json.loads(text_out)
        # 6) phản ánh kết quả
        labels_uniq = ["NEU"] * len(uniq_list)
        for obj in arr:
            i = obj.get("i"); lab = (obj.get("label") or "").strip().upper()
            if isinstance(i, int) and 0 <= i < len(labels_uniq) and lab in {"POS","NEU","NEG"}:
                labels_uniq[i] = lab
        # gán về labels và set cache
        for text_u, lab in zip(uniq_list, labels_uniq):
            for idx in uniq_map[_hash_text_for_cache(text_u)]:
                labels[idx] = lab
            CLASSIFY_CACHE.set(_label_cache_key(text_u, variant), lab)
        _METRICS["classify_success"] += 1
    except Exception:
        # giữ nguyên 'NEU' cho phần miss khi lỗi
        pass
    finally:
        _rec_latency("classify_latency_ms", 1000.0*(_time.perf_counter()-t0))

    return labels



@app.post("/ai/basic-sentiment/{survey_id}", tags=["Analysis Service"])
def ai_basic_senti(survey_id: int):
    if not BUCKETS["classify"].allow():
        return {"ok": False, "message": "Rate limited. Vui lòng thử lại sau.", "total": 0, "counts": {"POS":0,"NEU":0,"NEG":0}}
    start = _time.perf_counter()

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
            labels_all.extend(gemini_classify_batch(batch, variant=assign_bucket_by_hash(str(survey_id))))
            _time.sleep(0.25)

        for lab in labels_all:
            counts[lab] += 1
    else:
        counts["NEU"] = len(texts_all)

    payload = {"total": len(texts_all), "counts": counts}
    _save_analysis(survey_id, payload, "BASIC_SENTI")
    _rec_latency("classify_latency_ms", 1000.0*(_time.perf_counter()-start))
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

    # ---- CACHE GET (theo nội dung) ----
    MAX_RESP = int(os.getenv("SUMMARY_MAX_RESP", "120"))
    MAX_CHARS = int(os.getenv("SUMMARY_MAX_CHARS", "6000"))
    joined_for_hash = "\n".join([r.strip() for r in responses if r][:MAX_RESP])[:MAX_CHARS]
    ck = f"summary:{sha256(joined_for_hash)}"
    cached = SUMMARY_CACHE.get(ck)
    if cached:
        _METRICS["summary_cache_hit"] += 1
        return cached

    # (giữ nguyên phần tạo prompt/payload hiện có, chỉ khác dưới đây dùng wrapper)
    prompt = (
        "Tóm tắt ngắn gọn (3-5 bullet) các ý chính từ danh sách phản hồi tiếng Việt dưới đây. "
        "Nhấn mạnh điểm tích cực, tiêu cực và đề xuất cải tiến nếu có.\n\n"
        "Danh sách phản hồi:\n- " + joined_for_hash.replace("\n", "\n- ")
    )
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    if not GEMINI_KEY or not GEMINI_URL:
        summ = _local_summary(responses)
        SUMMARY_CACHE.set(ck, summ)
        return summ

    _METRICS["summary_calls"] += 1
    t0 = _time.perf_counter()
    try:
        data = call_gemini_json(GEMINI_URL, GEMINI_KEY, payload, timeout=float(os.getenv("EXT_SENTI_TIMEOUT","12.0")), max_retry=int(os.getenv("EXT_SENTI_MAX_RETRY","4")))
        cand = (data.get("candidates") or [{}])[0]
        content = cand.get("content") or {}
        parts = content.get("parts") or [{}]
        txt = parts[0].get("text")
        if isinstance(txt, str) and txt.strip():
            SUMMARY_CACHE.set(ck, txt)
            _METRICS["summary_success"] += 1
            _rec_latency("summary_latency_ms", 1000.0*(_time.perf_counter()-t0))
            return txt
        # fallback:
        summ = _local_summary(responses)
        SUMMARY_CACHE.set(ck, summ)
        _rec_latency("summary_latency_ms", 1000.0*(_time.perf_counter()-t0))
        return summ
    except Exception:
        summ = _local_summary(responses)
        SUMMARY_CACHE.set(ck, summ)
        _rec_latency("summary_latency_ms", 1000.0*(_time.perf_counter()-t0))
        return summ


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
    if not BUCKETS["summary"].allow():
        return {"ok": False, "summary": "Rate limited. Vui lòng thử lại sau.", "count": 0}
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


#################################################################################
# ================== Insights Engine (routes minimal) ==================
#################################################################################
from fastapi import Query, HTTPException
import os, json, re
import pandas as _pd
import numpy as _np
from pathlib import Path
import yaml

def _load_rules_from_file(config_path: str) -> dict:
    """
    Đọc YAML luật phân tích từ đường dẫn cho phép tương đối hoặc tuyệt đối.
    """
    base = Path(__file__).resolve().parent
    p = Path(config_path)
    if not p.is_absolute():
        p = (base / p).resolve()

    if not p.exists():
        raise FileNotFoundError(f"Rules file not found: {p}")

    # MỞ BẰNG CHẾ ĐỘ ĐỌC UTF-8
    with p.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    # defaults nhẹ để tránh None
    data.setdefault("min_n", 1)
    data.setdefault("effect_size_min", 0.2)
    data.setdefault("trend", {"pct_change": 0.05, "monotonic_len": 3})
    data.setdefault("anomaly", {})
    return data

# Loader KHỚP schema bạn đã đưa:
# answers(answer_id, response_id, question_id, option_id, answer_text, created_at, updated_at)
# responses(response_id, survey_id, user_id, request_token, submitted_at)
def _load_responses_df_v2(survey_id: int) -> _pd.DataFrame:
    rows = sql_all("""
        SELECT
          a.answer_id,
          a.question_id,
          a.option_id,
          a.answer_text,
          a.answer_value,
          r.response_id,
          r.created_at,                 -- << dùng created_at từ VIEW responses_ext
          r.respondent_id,              -- nếu VIEW đặt alias như vậy
          r.gender, r.age_band, r.region
        FROM answers a
        JOIN responses_ext r ON r.response_id = a.response_id
        WHERE r.survey_id = %s
    """, (survey_id,))

    df = _pd.DataFrame(rows or [])
    if df.empty:
        return _pd.DataFrame(columns=[
            "answer_id","question_id","option_id","answer_text","answer_value",
            "response_id","created_at","respondent_id",
            "gender","age_band","region","answer_numeric"
        ])

    if "answer_text" in df.columns:
        df["answer_text"] = df["answer_text"].astype(str)
    if "created_at" in df.columns:
        df["created_at"] = _pd.to_datetime(df["created_at"], errors="coerce")

    num_from_value = _pd.to_numeric(df.get("answer_value"), errors="coerce")

    def extract_num(s):
        if not isinstance(s, str):
            return _np.nan
        m = re.search(r"(\d+)", s)
        return float(m.group(1)) if m else _np.nan

    num_from_text = df.get("answer_text", _pd.Series(dtype=str)).apply(extract_num)
    df["answer_numeric"] = num_from_value.where(num_from_value.notna(), num_from_text)
    return df

# ---- modules rút gọn (đã đủ Acceptance) ----
def _ins_stat(df, rules):
    from scipy import stats
    out = []
    min_n = int(rules.get("min_n", 30))
    for qid, g in df.groupby("question_id"):
        s = _pd.to_numeric(g["answer_numeric"], errors="coerce").dropna()
        if len(s) < min_n: continue
        mean = float(s.mean())
        if len(s) > 2 and s.std(ddof=1) > 0:
            ci_low, ci_high = stats.t.interval(1-rules.get("alpha",0.05), len(s)-1,
                                               loc=mean, scale=s.std(ddof=1)/len(s)**0.5)
            ci = [float(ci_low), float(ci_high)]
        else:
            ci = [None, None]
        out.append({"id": f"stat:{qid}","type":"stat","title":f"Điểm TB Q{qid}: {mean:.2f}",
                    "description":"Mean & khoảng tin cậy (t-CI).",
                    "metric":{"mean":mean,"ci":ci},"evidence":{"n":int(len(s))},
                    "significance":{"p":None,"effect":None},"severity":"low"})
    return out

def _ins_trend(df, rules):
    out = []
    if "created_at" not in df.columns: return out
    pct_th = float(rules["trend"]["pct_change"]); mono_len = int(rules["trend"]["monotonic_len"])
    for qid, g in df.groupby("question_id"):
        s = g.set_index("created_at")["answer_numeric"].dropna().resample("W").mean().dropna()
        if len(s) < mono_len: continue
        ma = s.rolling(3, min_periods=2).mean()
        base = ma.iloc[0] if ma.iloc[0] != 0 else 1.0
        pct = (ma.iloc[-1]-ma.iloc[0]) / abs(base)
        if _np.isfinite(pct) and abs(pct) >= pct_th:
            out.append({"id":f"trend:{qid}","type":"trend",
                        "title":f"Xu hướng {'tăng' if pct>0 else 'giảm'} điểm Q{qid}",
                        "description":"Mean theo tuần thay đổi đáng kể (MA-3).",
                        "metric":{"pct_change":float(pct)},"evidence":{"weeks":int(len(s))},
                        "significance":{},"severity":"medium"})
    return out

def _ins_compare(df, rules):
    out = []
    from scipy import stats
    min_n = int(rules.get("min_n", 30)); alpha = float(rules.get("alpha",0.05))
    # hiện tại DB chưa có gender/age_band/region → bỏ qua; nếu bạn có cột đó, thêm tên vào đây:
    seg_cols = [c for c in ["gender","age_band","region"] if c in df.columns]
    if not seg_cols: return out
    effect_min = float(rules.get("effect_size_min",0.2))
    for seg in seg_cols:
        for qid, gq in df.groupby("question_id"):
            groups = [_pd.to_numeric(x["answer_numeric"], errors="coerce").dropna() for _,x in gq.groupby(seg)]
            if len(groups) < 2 or any(len(x) < min_n for x in groups): continue
            if len(groups) == 2:
                t, p = stats.ttest_ind(groups[0], groups[1], equal_var=False, nan_policy='omit')
                effect = abs(groups[0].mean() - groups[1].mean())
            else:
                f, p = stats.f_oneway(*groups); effect = None
            if _np.isfinite(p) and p < alpha and (effect is None or effect >= effect_min):
                out.append({"id":f"cmp:{qid}:{seg}","type":"compare",
                            "title":f"Khác biệt theo {seg} ở Q{qid}",
                            "description":f"p={p:.3g} (rule-based).",
                            "metric":{"segment":seg},
                            "evidence":{"group_sizes":[int(len(x)) for x in groups]},
                            "significance":{"p":float(p),"effect":effect},
                            "severity":"high" if (effect and effect>=0.5) else "medium"})
    return out

def _ins_anomaly(df, rules):
    out = []
    # vì DB hiện chưa có duration_seconds nên bỏ qua speeders;
    # vẫn kiểm duplicate câu trả lời (xuất hiện >=3 lần)
    vc = df["answer_text"].str.strip().str.lower().value_counts()
    dups = vc[vc >= 3]
    if len(dups) > 0:
        out.append({"id":"anomaly:duplicates","type":"anomaly",
                    "title":"Lặp câu trả lời bất thường",
                    "description":"Có câu trả lời xuất hiện lặp (≥3).",
                    "metric":{"patterns":int(len(dups))},
                    "evidence":{"top_example": str(dups.index[0])[:160]},
                    "significance":{},"severity":"medium"})
    return out

def _run_engine(df, rules):
    ins = []
    ins += _ins_stat(df, rules)
    ins += _ins_trend(df, rules)
    ins += _ins_compare(df, rules)
    ins += _ins_anomaly(df, rules)
    order = {"anomaly":0,"compare":1,"trend":2,"stat":3}
    ins.sort(key=lambda x: (order.get(x["type"],9), x.get("severity","zz")))
    return ins

def _write_reports(insights, survey_id: int):
    os.makedirs("reports", exist_ok=True)
    jp = f"reports/{survey_id}_insights.json"
    mp = f"reports/{survey_id}_insights.md"
    with open(jp,"w",encoding="utf-8") as f: json.dump({"insights":insights,"count":len(insights)}, f, ensure_ascii=False, indent=2)
    lines = ["# Survey Insights\n"] + [
        f"## [{i['type'].upper()}] {i['title']}\n- {i['description']}\n- metric: `{i.get('metric',{})}`\n- evidence: `{i.get('evidence',{})}`\n"
        for i in insights
    ]
    with open(mp,"w",encoding="utf-8") as f: f.write("\n".join(lines))
    return {"json": jp, "md": mp}

@app.post("/ai/insights/config/validate", tags=["Data Analytics & Insights Engine"])
def ai_insights_config_validate(config_path: str = Query("config/rules.yml")):
    rules = _load_rules_from_file(config_path)
    return {"ok": True, "rules": rules}

@app.post("/ai/insights/run", tags=["Data Analytics & Insights Engine"])
def ai_insights_run(survey_id: int = Query(...), config_path: str = Query("config/rules.yml")):
    rules = _load_rules_from_file(config_path)
    df = _load_responses_df_v2(survey_id)
    insights = _run_engine(df, rules)
    payload = {"kind":"INSIGHTS", "survey_id": survey_id, "insights": insights, "count": len(insights)}
    _save_analysis(survey_id, payload, "INSIGHTS")
    paths = _write_reports(insights, survey_id)
    return {"ok": True, **payload, "reports": paths}

@app.get("/ai/insights/{survey_id}/latest", tags=["Data Analytics & Insights Engine"])
def ai_insights_latest(survey_id: int):
    rows = sql_all("""
        SELECT analysis_id, analysis_data, created_at
        FROM ai_analysis
        WHERE survey_id=%s
        ORDER BY created_at DESC, analysis_id DESC
        LIMIT 100
    """, (survey_id,))
    for r in rows or []:
        try:
            data = json.loads(r["analysis_data"]) if isinstance(r["analysis_data"], str) else r["analysis_data"]
            if data.get("kind") == "INSIGHTS":
                return {"ok": True, "data": data, "analysis_id": r["analysis_id"]}
        except Exception:
            continue
    raise HTTPException(status_code=404, detail="No INSIGHTS found")
# =====================================================================


# === SRP integration routes (dùng core tách riêng) ===
from fastapi import Depends
from sqlalchemy.orm import Session
from srp_core import SRPItem, SRPBatchRequest, SRPResult, srp_process_one, sha256

@app.post("/ai/srp/process", tags=["SRP"])
def ai_srp_process(req: SRPBatchRequest):
    known: dict[str, str] = {}
    out: list[SRPResult] = []
    for it in req.items:
        r = srp_process_one(it.text, known_hashes=known, tag_yaml=req.tag_rules_yaml)
        r.id = it.id
        out.append(r)
        known[sha256(r.text_clean)] = r.text_clean
    return {"ok": True, "results": [r.model_dump() for r in out]}

@app.post("/ai/srp/process/{survey_id}", tags=["SRP"])
def ai_srp_process_survey(survey_id: int, rules_yaml: str = "rules.yml", db: Session = Depends(get_db)):
    rows = fetch_answer_rows(db, survey_id)
    known: dict[str, str] = {}
    results = []
    for r in rows:
        res = srp_process_one(r.answer_text or "", known_hashes=known, rules_yaml=rules_yaml)
        res.id = str(r.answer_id)
        results.append(res.model_dump())
        known[sha256(res.text_clean)] = res.text_clean
    _save_analysis(survey_id, {"kind":"SRP","items":results,"count":len(results)}, "SRP")
    return {"ok": True, "survey_id": survey_id, "count": len(results), "results": results}

