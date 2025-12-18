from __future__ import annotations

import os
import json
import re
import hashlib
import threading
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
from urllib.parse import urlparse, unquote
load_dotenv()

# === ChromaDB (vector store) — LAZY LOAD ===
# Không import chromadb ở global scope để tránh crash khi server chưa cài.
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "survey_answers")
_CHROMA_CLIENT = None  # lazy singleton

def _get_chroma_client():
    """Khởi tạo PersistentClient khi cần; không làm app crash ở startup."""
    global _CHROMA_CLIENT
    if _CHROMA_CLIENT is not None:
        return _CHROMA_CLIENT
    try:
        import chromadb  # import khi cần
        _CHROMA_CLIENT = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        return _CHROMA_CLIENT
    except Exception as e:
        print(f"[chroma] init error (lazy): {e}")
        return None

def get_chroma_collection():
    """
    Lấy (hoặc tạo) collection 'survey_answers' với cosine distance.
    Metadata store: survey_id, answer_id, question_id ...
    """
    client = _get_chroma_client()
    if client is None:
        return None
    try:
        return client.get_collection(name=CHROMA_COLLECTION)
    except Exception:
        try:
            return client.create_collection(
                name=CHROMA_COLLECTION,
                metadata={"hnsw:space": "cosine"}  # cosine similarity
            )
        except Exception as e:
            print(f"[chroma] create_collection error: {e}")
            return None

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

# --- OpenAI (CHỈ dùng cho CHAT trả lời theo RAG; các phần khác vẫn giữ Gemini) ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
OPENAI_MAX_OUTPUT_TOKENS = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "450"))

def _extract_openai_output_text(resp: dict) -> str:
    # Một số SDK có field output_text; raw JSON thường có output[].
    ot = resp.get("output_text")
    if isinstance(ot, str) and ot.strip():
        return ot.strip()
    out_chunks = []
    for item in (resp.get("output") or []):
        if item.get("type") != "message":
            continue
        for c in (item.get("content") or []):
            if c.get("type") == "output_text":
                t = c.get("text") or ""
                if t:
                    out_chunks.append(t)
    return "\n".join(out_chunks).strip()

def call_openai_text(prompt: str, timeout: float, max_retry: int = 4, temperature: float = 0.2) -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("Missing OPENAI_API_KEY")
    url = "https://api.openai.com/v1/responses"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENAI_CHAT_MODEL,
        "input": prompt,
        "temperature": float(temperature),
        "max_output_tokens": int(OPENAI_MAX_OUTPUT_TOKENS),
    }

    for attempt in range(max_retry + 1):
        try:
            with httpx.Client(timeout=timeout) as client:
                r = client.post(url, headers=headers, json=payload)
                # 429: rate limit; 5xx: retry
                if r.status_code in (429, 500, 502, 503, 504):
                    raise RuntimeError(f"OpenAIHTTP{r.status_code}")
                r.raise_for_status()
                data = r.json()
                return _extract_openai_output_text(data)
        except Exception:
            if attempt >= max_retry:
                raise
            back = min(3.0, (0.2 * (2 ** attempt))) + random.uniform(0, 0.2)
            _t.sleep(back)

def _gen_answer_from_ctx(question: str, contexts: list[str], history: str = "") -> str:
    if not contexts:
        return "Chưa đủ ngữ cảnh để trả lời."
    max_chars = int(os.getenv("RAG_MAX_CTX_CHARS","5000"))

    # Gộp & cắt context theo giới hạn ký tự
    ctx = contexts[:]
    joined_ctx = "\n- ".join(ctx)
    if len(joined_ctx) > max_chars:
        joined_ctx = joined_ctx[:max_chars]

    # Lịch sử hội thoại (có thể rỗng)
    hist_str = (history or "").strip()
    if hist_str and len(hist_str) > max_chars:
        hist_str = hist_str[-max_chars:]  # cắt phần cuối cùng (gần hiện tại)

    # Prompt cấu trúc theo yêu cầu
    prompt = (
        "[ROLE]\n"
        "Bạn là trợ lý phân tích phản hồi khảo sát TIẾNG VIỆT. "
        "Chỉ dựa vào NGỮ CẢNH và LỊCH SỬ CHAT để trả lời ngắn gọn, có căn cứ. "
        "Nếu không đủ thông tin, hãy trả lời: 'Chưa đủ thông tin'.\n\n"
        "[CONTEXT]\n"
        f"- {joined_ctx}\n\n"
        "[CHAT HISTORY]\n"
        f"{(hist_str if hist_str else '(Không có)')}\n\n"
        "[CURRENT QUESTION]\n"
        f"{question}"
    )

    try:
        txt = call_openai_text(
            prompt,
            timeout=float(os.getenv("EXT_SENTI_TIMEOUT", "12.0")),
            max_retry=int(os.getenv("EXT_SENTI_MAX_RETRY", "4")),
            temperature=0.2,
        )
        return txt or "Chưa đủ thông tin."
    except Exception:

        return "Chưa đủ thông tin."

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
    return pymysql.connect(**_get_db_connect_args())


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

def _db_params_from_url(url: str) -> dict:
    """
    Parse DATABASE_URL / DB_URL kiểu:
      mysql+pymysql://user:pass@host:3306/dbname
      mysql://user:pass@host:3306/dbname
      sqlite:///path/to/file.db  (KHÔNG dùng cho pymysql)
    Trả về dict tham số cho pymysql.connect(...)
    """
    u = urlparse(url)
    # sqlite không dùng ở đây (pymysql), nhưng ta vẫn guard:
    if u.scheme.startswith("sqlite"):
        raise ValueError("DATABASE_URL trỏ sqlite — không hợp lệ cho pymysql.connect")

    host = u.hostname or "127.0.0.1"
    port = u.port or 3306
    user = unquote(u.username or "root")
    password = unquote(u.password or "")
    # path trả về "/dbname"
    database = (u.path or "").lstrip("/") or ""
    return {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "database": database,
    }

def _get_db_connect_args() -> dict:
    """
    Ưu tiên:
      1) DATABASE_URL hoặc DB_URL (URL đầy đủ)
      2) Nhóm DB_* rời rạc
      3) Fallback tạm thời: nhóm MYSQL_* (compat cũ)
    """
    # 1) URL ưu tiên cao nhất
    url = os.getenv("DATABASE_URL") or os.getenv("DB_URL")
    if url:
        try:
            params = _db_params_from_url(url)
        except Exception as e:
            raise RuntimeError(f"Invalid DATABASE_URL/DB_URL: {e}")
    else:
        # 2) Bộ DB_…
        host = os.getenv("DB_HOST") or os.getenv("MYSQL_HOST") or "127.0.0.1"
        port = int(os.getenv("DB_PORT") or os.getenv("MYSQL_PORT") or 3306)
        user = os.getenv("DB_USER") or os.getenv("MYSQL_USER") or "root"
        password = os.getenv("DB_PASS") or os.getenv("MYSQL_PWD") or ""
        database = os.getenv("DB_NAME") or os.getenv("MYSQL_DB") or ""

        params = {
            "host": host,
            "port": port,
            "user": user,
            "password": password,
            "database": database,
        }

    # Thêm defaults chung cho mọi kết nối pymysql
    params.update({
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    })
    return params

# ============================================================
# Gọi GEMINI (Structured Output JSON)
# ============================================================

def call_external_sentiment(text: str, retries: int | None = None) -> Tuple[int, float, Dict[str, Any]]:
    """
    Backward-compatible:
      returns (label_id: 0/1/2, confidence: float, extra: dict)
      0=negative, 1=neutral, 2=positive
    """
    if not EXT_URL or not EXT_KEY:
        return 1, 0.0, {"error": "Missing EXT_SUMM_URL/EXT_SENTI_KEY"}

    body = {
        "contents": [{
            "parts": [{"text": (
                "Bạn là bộ phân tích cảm xúc tiếng Việt.\n"
                "Hãy trả về JSON đúng schema {label, confidence}.\n"
                "label ∈ [negative, neutral, positive]; confidence ∈ [0,1].\n"
                f"Văn bản: {text}"
            )}]
        }],
        "generationConfig": {
            "temperature": 0, "topP": 1, "topK": 1, "candidateCount": 1,
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

    use_retries = EXT_MAX_RETRY if retries is None else retries
    try:
        # dùng wrapper httpx (có retry/backoff/circuit-breaker)
        j = call_gemini_json(
            EXT_URL, EXT_KEY, body,
            timeout=EXT_TIMEOUT, max_retry=int(use_retries)
        )
        txt = j["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(txt)
        label = str(parsed.get("label", "neutral")).lower()
        conf  = float(parsed.get("confidence", 0.0))
        label_id = {"negative":0, "neutral":1, "positive":2}.get(label, 1)
        return label_id, conf, {"api": j, "parsed": parsed}
    except Exception as e:
        # giữ kiểu trả về để backward-compatible
        return 1, 0.0, {"error": f"external_call_failed: {e}"}

# ============== Embedding (Gemini text-embedding-004) ==============
EXT_EMB_URL   = os.getenv("EXT_EMB_URL")
EXT_EMB_KEY   = os.getenv("EXT_EMB_KEY") or os.getenv("EXT_SENTI_KEY")
EXT_EMB_MODEL = os.getenv("EXT_EMB_MODEL", "text-embedding-004")
EXT_EMB_DIM   = int(os.getenv("EXT_EMB_DIM", "768"))

def _embed_vi(text: str) -> list[float]:
    if not text or not EXT_EMB_URL or not EXT_EMB_KEY:
        return []
    payload = {"model": EXT_EMB_MODEL, "content": {"parts": [{"text": text[:4000]}]}}
    data = call_gemini_json(
        EXT_EMB_URL, EXT_EMB_KEY, payload,
        timeout=float(os.getenv("EXT_SENTI_TIMEOUT","12.0")),
        max_retry=int(os.getenv("EXT_SENTI_MAX_RETRY","4"))
    )
    try:
        vals = None
        emb = data.get("embedding")
        if isinstance(emb, dict):
            vals = emb.get("values")
        elif isinstance(emb, list) and emb and isinstance(emb[0], dict):
            vals = emb[0].get("values")

        if vals is None:
            embs = data.get("embeddings")
            if isinstance(embs, list) and embs and isinstance(embs[0], dict):
                vals = embs[0].get("values")

        vec = [float(x) for x in (vals or [])][:EXT_EMB_DIM]
        return vec if vec else []
    except Exception:
        return []

# ============================================================
# FastAPI app
# ============================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==== on_startup (cập nhật) ====
@app.on_event("startup")
def on_startup():
    if os.getenv("DATABASE_URL") or os.getenv("DB_URL"):
        print("[startup] DB Connected (via DATABASE_URL/DB_URL)")
    else:
        # Không có URL hợp nhất -> rơi về bộ biến rời rạc
        print("[startup] DB Connected (via DB_* / MYSQL_*)")
    print("[startup] External sentiment only (Gemini)")

    # Tự động migrate Chroma nếu bật cờ MIGRATE_ON_BOOT=1
    try:
        migrate_flag = os.getenv("MIGRATE_ON_BOOT", "0")
        if migrate_flag == "1":
            print("[startup] MIGRATE_ON_BOOT=1 → spawning migrate thread...")

            # import hàm main từ migrate_chroma.py ngay tại đây
            try:
                from migrate_chroma import main as migrate_main
            except Exception as e:
                print(f"[startup][migrate] cannot import migrate_chroma.main: {e}")
            else:
                def _run_migrate():
                    try:
                        print("[startup][migrate] BEGIN")
                        migrate_main()  # chạy migrate (upsert theo batch, idempotent)
                        print("[startup][migrate] DONE")
                    except Exception as ex:
                        print(f"[startup][migrate] ERROR: {ex}")

                t = threading.Thread(
                    target=_run_migrate,
                    name="migrate_chroma_thread",
                    daemon=True,   # không chặn quá trình tắt server
                )
                t.start()
        else:
            print(f"[startup] MIGRATE_ON_BOOT={migrate_flag} → skip migrate.")
    except Exception as e:
        print(f"[startup] migrate bootstrap error: {e}")

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

def _embed_upsert(survey_id: int, answer_id: int, text_norm: str, vec: list[float]):
    sql_exec(
        """
        INSERT INTO ai_embed(survey_id, answer_id, text_norm, text_hash, vec_json)
        VALUES (%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE text_norm=VALUES(text_norm),
                                text_hash=VALUES(text_hash),
                                vec_json=VALUES(vec_json),
                                created_at=NOW()
        """,
        (survey_id, answer_id, text_norm, sha256(text_norm), json.dumps(vec)),
    )

def _embed_rows_by_survey(survey_id: int) -> list[dict]:
    return sql_all(
        "SELECT answer_id, text_norm, vec_json FROM ai_embed WHERE survey_id=%s",
        (survey_id,)
    )


# ============================================================
# Rule-based Stats Chat (VI)
# ============================================================

import statistics as _stats
from collections import Counter as _Counter

# cache siêu nhẹ theo survey cho thống kê đơn giản
_STATS_CACHE: dict[tuple[int, str], tuple[float, str]] = {}
# nhớ intent gần nhất theo user_id để follow-up
_USER_CTX: dict[int, dict] = {}

def _total_responses(db: Session, survey_id: int) -> int:
    return db.execute(text("""
        SELECT COUNT(*) FROM answers a
        JOIN responses r ON r.response_id = a.response_id
        WHERE r.survey_id = :sid AND TRIM(COALESCE(a.answer_text,'')) <> ''
    """), {"sid": survey_id}).scalar() or 0

def _count_contains(db: Session, survey_id: int, kw: str) -> int:
    return db.execute(text("""
        SELECT COUNT(*) FROM answers a
        JOIN responses r ON r.response_id = a.response_id
        WHERE r.survey_id = :sid AND a.answer_text LIKE :kw
    """), {"sid": survey_id, "kw": f"%{kw}%"}).scalar() or 0

def _top1_answer(db: Session, survey_id: int) -> tuple[str, int]:
    row = db.execute(text("""
        SELECT LOWER(TRIM(a.answer_text)) AS t, COUNT(*) AS c
        FROM answers a JOIN responses r ON r.response_id = a.response_id
        WHERE r.survey_id = :sid AND TRIM(COALESCE(a.answer_text,'')) <> ''
        GROUP BY t ORDER BY c DESC LIMIT 1
    """), {"sid": survey_id}).mappings().fetchone()
    return (row["t"], int(row["c"])) if row else ("", 0)

def _topn_answers(db: Session, survey_id: int, n: int = 3) -> list[tuple[str,int]]:
    rows = db.execute(text("""
        SELECT LOWER(TRIM(a.answer_text)) AS t, COUNT(*) AS c
        FROM answers a JOIN responses r ON r.response_id = a.response_id
        WHERE r.survey_id = :sid AND TRIM(COALESCE(a.answer_text,'')) <> ''
        GROUP BY t ORDER BY c DESC LIMIT :n
    """), {"sid": survey_id, "n": n}).mappings().fetchall()
    return [(r["t"], int(r["c"])) for r in rows or []]

def _numeric_series(db, survey_id: int) -> list[float]:
    rows = db.execute(text("""
        SELECT a.answer_text
        FROM answers a
        JOIN responses r ON r.response_id = a.response_id
        WHERE r.survey_id = :sid
    """), {"sid": survey_id}).mappings().fetchall()  # dùng mappings()
    out = []
    for r in rows or []:
        txt = (r.get("answer_text") or "").strip()
        m = re.search(r"(-?\d+(?:[.,]\d+)?)", txt)
        if m:
            try:
                out.append(float(m.group(1).replace(",", ".")))
            except:
                pass
    return out

def _nps_score(db: Session, survey_id: int) -> tuple[float,int,int,int,int]:
    """Giả định thang 0–10: 9–10 = promoter; 0–6 = detractor; 7–8 = passive"""
    arr = _numeric_series(db, survey_id)
    n = len(arr)
    if not n: return (0.0, 0, 0, 0, 0)
    promoters  = sum(1 for x in arr if x >= 9)
    detractors = sum(1 for x in arr if x <= 6)
    passives   = n - promoters - detractors
    nps = (promoters/n - detractors/n) * 100.0
    return (nps, n, promoters, passives, detractors)

# —— Parser intent rất thực dụng (không cần NLP nặng) ——
def parse_query_vi(q: str) -> dict:
    q = (q or "").lower().strip()
    # tổng số
    if re.search(r"\b(có bao nhiêu|tổng(?: số)? (?:câu )?trả lời|bao nhiêu người)\b", q):
        return {"intent": "total"}
    # hài lòng / không hài lòng / yes / no
    if re.search(r"\b(tỷ lệ|ti le|tỉ lệ)\b.*\b(hài lòng|hai long|thoả mãn|thoa man|tốt|tot|ổn|on)\b", q):
        return {"intent": "ratio_contains", "kw": "hài lòng"}
    if re.search(r"\b(tỷ lệ|ti le|tỉ lệ)\b.*\b(không hài lòng|khong hai long|tệ|te|không|khong)\b", q):
        return {"intent": "ratio_contains", "kw": "không"}
    if re.search(r"\b(tỷ lệ|ti le|tỉ lệ)\b.*\b(đồng ý|dong y|yes)\b", q):
        return {"intent": "ratio_contains", "kw": "đồng ý"}
    if re.search(r"\b(tỷ lệ|ti le|tỉ lệ)\b.*\b(không|khong|no)\b", q):
        return {"intent": "ratio_contains", "kw": "không"}
    # phổ biến nhất / top n
    if re.search(r"(phổ biến nhất|pho bien nhat|câu trả lời phổ biến|cau tra loi pho bien|hay gặp nhất)", q):
        m = re.search(r"top\s*(\d+)", q)
        return {"intent": "topn", "n": int(m.group(1)) if m else 1}
    # trung bình / trung vị / mode / min / max
    if re.search(r"(trung bình|trung binh|average|mean)", q): return {"intent": "avg"}
    if re.search(r"(trung vị|trung vi|median)", q):         return {"intent": "median"}
    if re.search(r"(mode|phương thức|gia trị lặp nhiều)", q): return {"intent": "mode"}
    if re.search(r"(cao nhất|max|lớn nhất)", q):            return {"intent": "max"}
    if re.search(r"(thấp nhất|min|nhỏ nhất)", q):           return {"intent": "min"}
    # NPS
    if re.search(r"\b(nps|net promoter)\b", q):              return {"intent": "nps"}
    # đếm chứa từ khoá tuỳ biến: "bao nhiêu ... 'abc'"
    m = re.search(r"bao nhiêu.*?(?:chứa|co|có)\s+['\"]?([a-z0-9à-ỹ\s]+)['\"]?", q)
    if m: return {"intent": "count_contains", "kw": m.group(1).strip()}
    m = re.search(r"(top\s*\d+|phổ biến|hay gặp).*(không hài lòng|không|lỗi|lag|chậm|khó|tệ|kém)", q, re.I)
    if m:
        n = re.search(r"top\s*(\d+)", q, re.I)
        return {"intent": "topn_negative", "n": int(n.group(1)) if n else 3}

    m = re.search(r"(top\s*\d+|phổ biến|hay gặp).*(hài lòng|tốt|đẹp|nhanh|ổn|ưng|mượt)", q, re.I)
    if m:
        n = re.search(r"top\s*(\d+)", q, re.I)
        return {"intent": "topn_positive", "n": int(n.group(1)) if n else 3}
    return {"intent": "unknown"}

def _answer_stat_query(db: Session, survey_id: int, q: str) -> Optional[str]:
    it = parse_query_vi(q)
    intent = it.get("intent")
    if intent == "unknown": 
        return None
    elif intent in {"topn_negative", "topn_positive"}:
        n = max(1, min(int(it.get("n", 3)), 10))
        target = 0 if intent == "topn_negative" else 2  # 0=NEG, 2=POS
        rows = db.execute(text("""
            SELECT LOWER(TRIM(a.answer_text)) AS t, COUNT(*) AS c
            FROM answers a
            JOIN responses r   ON r.response_id = a.response_id
            JOIN ai_inference inf ON inf.answer_id=a.answer_id AND inf.survey_id=r.survey_id
            WHERE r.survey_id=:sid
            AND TRIM(COALESCE(a.answer_text,'')) <> ''
            AND COALESCE(inf.final_label, inf.pred_label)=:lbl
            GROUP BY t HAVING t <> ''
            ORDER BY c DESC
            LIMIT :n
        """), {"sid": survey_id, "lbl": target, "n": n}).mappings().fetchall()
        items = [(r["t"], int(r["c"])) for r in rows or []]
        if not items:
            return "Không có câu trả lời phù hợp."
        bullets = [f"“{t}” ({c} lần)" for t,c in items]
        return f"Top {n} lý do {'không hài lòng' if target==0 else 'hài lòng'}: " + "; ".join(bullets) + "."


    # follow-up: nếu user không truyền filter mới, dùng lại intent trước đó
    # (chỉ hoạt động khi có user_id, xử lý ở endpoint)
    # cache theo (survey_id, intent_repr)
    key = (survey_id, json.dumps(it, ensure_ascii=False))
    if key in _STATS_CACHE:
        return _STATS_CACHE[key][1]

    total = _total_responses(db, survey_id)
    if total == 0:
        ans = "Chưa có câu trả lời hợp lệ trong survey này."
        _STATS_CACHE[key] = (_time.time(), ans); return ans

    if intent == "total":
        ans = f"Tổng cộng có {total} câu trả lời."
    elif intent == "ratio_contains":
        kw = it["kw"]
        n = _count_contains(db, survey_id, kw)
        pct = round(n * 100.0 / total, 2)
        ans = f"Tỷ lệ câu trả lời chứa “{kw}” là {pct}% ({n}/{total})."
    elif intent == "count_contains":
        kw = it["kw"]; n = _count_contains(db, survey_id, kw)
        ans = f"Có {n} câu trả lời chứa “{kw}”."
    elif intent == "topn":
        n = max(1, min(int(it.get("n", 1)), 10))
        items = _topn_answers(db, survey_id, n)
        if not items:
            ans = "Không có câu trả lời phổ biến."
        else:
            bullets = "; ".join([f"“{t}” ({c} lần)" for t, c in items])
            ans = f"Các câu trả lời phổ biến nhất: {bullets}."
    elif intent in {"avg","median","mode","min","max"}:
        arr = _numeric_series(db, survey_id)
        if not arr:
            ans = "Không có dữ liệu số để tính."
        else:
            if intent == "avg":    ans = f"Điểm trung bình là {round(_stats.fmean(arr),2)} (n={len(arr)})."
            if intent == "median": ans = f"Trung vị là {round(_stats.median(arr),2)}."
            if intent == "mode":
                try: ans = f"Mode là {round(_stats.mode(arr),2)}."
                except:  # multiple modes
                    cnt = _Counter(arr).most_common(1)[0]
                    ans = f"Mode là {round(cnt[0],2)} (xuất hiện {cnt[1]} lần)."
            if intent == "min":    ans = f"Giá trị nhỏ nhất là {round(min(arr),2)}."
            if intent == "max":    ans = f"Giá trị lớn nhất là {round(max(arr),2)}."
    elif intent == "nps":
        nps, n, pro, pas, det = _nps_score(db, survey_id)
        ans = f"NPS = {round(nps,1)} (promoters={pro}, passives={pas}, detractors={det}, n={n})."
    else:
        return None

    _STATS_CACHE[key] = (_time.time(), ans)
    return ans


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


@app.post("/ai/chat", response_model=ChatResponse, tags=["Chat AI/RAG"])
def ai_chat(req: ChatRequest, db: Session = Depends(get_db)):
    try:
        user_id = int(req.user_id) if req.user_id is not None else 0
        q_raw = req.question_text or ""
        q_norm = norm_text(q_raw)

        # (A) Với câu hỏi dạng thống kê rule-based, vẫn ưu tiên như cũ
        stat_ans = _answer_stat_query(db, req.survey_id, q_norm)
        if stat_ans:
            answer, topk_ctx = stat_ans, []
        else:
            # (B) Truy xuất ngữ cảnh top-k như cũ (Chroma → TF-IDF fallback)
            collection = get_chroma_collection()
            if collection is None:
                raise HTTPException(status_code=503, detail="Vector store chưa sẵn sàng (ChromaDB).")

            vec_q = _embed_vi(q_norm)
            env_topk = int(os.getenv("RAG_TOP_K", "5"))
            topk = max(1, min(int(req.top_k or env_topk), 20))
            min_sim = float(os.getenv("RAG_MIN_SIM", "0.25"))

            topk_ctx: list[str] = []
            if vec_q:
                try:
                    res = collection.query(
                        query_embeddings=[vec_q],
                        n_results=topk * 3,
                        where={"survey_id": int(req.survey_id)},
                        include=["documents", "distances", "metadatas"],
                    )
                    docs = (res.get("documents") or [[]])[0]
                    dists = (res.get("distances") or [[]])[0]
                    items = []
                    for d, doc in zip(dists, docs):
                        try:
                            sim = 1.0 - float(d)  # cosine similarity
                        except Exception:
                            sim = 0.0
                        items.append((sim, doc))
                    items.sort(key=lambda x: x[0], reverse=True)
                    items = [(s, t) for (s, t) in items if s >= min_sim]
                    topk_ctx = [t for _, t in items[:topk]]
                except Exception as e:
                    print(f"[ai_chat] chroma query error: {e}")

            # (C) Lấy lịch sử hội thoại từ DB (tối đa 12 cặp Q/A)
            history = get_chat_history(db, user_id=user_id, survey_id=req.survey_id, limit=12)

            if topk_ctx:
                # Gọi Open AI với cả CONTEXT + HISTORY
                answer = _gen_answer_from_ctx(q_norm, topk_ctx, history=history)
            else:
                # Fallback TF-IDF nếu vecto rỗng hoặc Chroma fail
                texts = [r.answer_text for r in fetch_answer_rows(db, req.survey_id)]
                topk_ctx = retrieve_topk(texts, q_norm, req.top_k)
                # craft_answer là local — không cần history
                answer = craft_answer(q_norm, topk_ctx)

        # (D) Trả kết quả - KHÔNG lưu DB ở đây, để Backend Java service lưu
        now = datetime.utcnow()
        
        # Log activity nhưng không lưu chat log (Backend sẽ lưu)
        db.add(ActivityLog(
            user_id=req.user_id, action_type="ai_query",
            target_id=None, target_table="ai_chat_logs",
            description=f"AI chat for survey_id={req.survey_id}",
        ))
        db.commit()

        return ChatResponse(
            survey_id=req.survey_id, question_text=req.question_text,
            answer_text=answer, context=topk_ctx,
            top_k=req.top_k, created_at=now,
        )
    except Exception as e:
        db.rollback()
        db.add(ActivityLog(
            user_id=req.user_id, action_type="ai_query_error",
            target_id=None, target_table="ai_chat_logs",
            description=f"Error: {e}",
        ))
        db.commit()
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI chat: {e}")

print("[startup] EXT_SENTI_URL =", os.getenv("EXT_SENTI_URL"))
print("[startup] EXT_SENTI_KEY set? ", bool(os.getenv("EXT_SENTI_KEY")))


# ============================ Conversational Memory ============================

def get_chat_history(db: Session, user_id: Optional[int], survey_id: int, limit: int = 12) -> str:
    """
    Lấy 'limit' bản ghi chat gần nhất của user trong survey, theo thời gian tăng dần
    và chuẩn hoá về chuỗi:
        User: ...
        AI: ...
        User: ...
        AI: ...
    Trả về chuỗi rỗng nếu chưa có lịch sử.
    """
    if not user_id:
        return ""

    # Lấy các entry mới nhất rồi đảo ngược để ra (cũ -> mới)
    rows = (
        db.query(AiChatLog)
        .filter(AiChatLog.survey_id == survey_id)
        .filter(AiChatLog.user_id == user_id)
        .order_by(AiChatLog.chat_id.desc())
        .limit(max(1, int(limit)))
        .all()
    )
    if not rows:
        return ""

    rows = list(reversed(rows))
    parts: list[str] = []
    for r in rows:
        q = (r.question_text or "").strip()
        a = (r.ai_response or "").strip()
        if q:
            parts.append(f"User: {q}")
        if a:
            parts.append(f"AI: {a}")
    return "\n".join(parts).strip()


# ================== RAG INGEST (đã tối ưu hoá đa luồng) ==================
from concurrent.futures import ThreadPoolExecutor, as_completed

@app.post("/ai/rag/ingest/{survey_id}", tags=["Chat AI/RAG"])
def rag_ingest(survey_id: int, db: Session = Depends(get_db)):
    """
    Lấy các câu trả lời text từ MySQL (answers/responses) → embed (Gemini) song song → upsert Chroma theo batch.
    - Dùng ThreadPoolExecutor để gọi _embed_vi song song (mặc định 8 luồng).
    - Metadata chứa survey_id để filter trước-lọc khi query.
    """
    rows = fetch_answer_rows(db, survey_id)
    if not rows:
        return {"ok": False, "message": "Không có câu trả lời hợp lệ."}

    collection = get_chroma_collection()
    if collection is None:
        raise HTTPException(status_code=503, detail="Vector store chưa sẵn sàng (ChromaDB).")

    BATCH = int(os.getenv("RAG_INGEST_BATCH", "200"))
    MAX_WORKERS = int(os.getenv("EMBED_MAX_WORKERS", "8"))  # 5–10 gợi ý
    added = 0

    buf_ids: List[str] = []
    buf_embs: List[List[float]] = []
    buf_metas: List[Dict[str, Any]] = []
    buf_docs: List[str] = []

    def _flush():
        nonlocal added, buf_ids, buf_embs, buf_metas, buf_docs
        if not buf_ids:
            return
        try:
            collection.upsert(
                ids=buf_ids,
                embeddings=buf_embs,
                metadatas=buf_metas,
                documents=buf_docs,
            )
            added += len(buf_ids)
        except Exception as e:
            print(f"[rag_ingest] upsert batch error: {e}")
        finally:
            buf_ids, buf_embs, buf_metas, buf_docs = [], [], [], []

    def _worker(r):
        raw = r.answer_text or ""
        nt = norm_text(raw)
        vec = _embed_vi(nt)  # call Gemini
        if not vec:
            return None
        cid = f"{survey_id}:{int(r.answer_id)}"
        meta = {
            "survey_id": int(survey_id),
            "answer_id": int(r.answer_id),
            "question_id": int(r.question_id) if r.question_id is not None else None,
        }
        return (cid, vec, meta, nt)

    # Nộp job theo lô để tránh backlog quá lớn (ổn định bộ nhớ)
    CHUNK = MAX_WORKERS * 25  # tuỳ chỉnh
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i+CHUNK]
        with ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="embed") as ex:
            futures = [ex.submit(_worker, r) for r in chunk]
            for fut in as_completed(futures):
                try:
                    item = fut.result()
                except Exception as e:
                    print(f"[rag_ingest] worker error: {e}")
                    continue
                if not item:
                    continue
                cid, vec, meta, nt = item
                buf_ids.append(cid); buf_embs.append(vec); buf_metas.append(meta); buf_docs.append(nt)
                if len(buf_ids) >= BATCH:
                    _flush()

    _flush()
    return {"ok": True, "ingested": added, "survey_id": survey_id}

# ===================== SPRINT 4 ADDITIONS ====================
# 1) Keywords (TF-IDF)
# 2) Basic Sentiment (rule-based, tiếng Việt)
# 3) Summary (Gemini)
# 4) Themes (TF-IDF -> SVD -> KMeans)
# 5) Get latest analysis by kind


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

def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b: return 0.0
    import numpy as np
    va = np.array(a, dtype=float); vb = np.array(b, dtype=float)
    na = np.linalg.norm(va); nb = np.linalg.norm(vb)
    if na == 0 or nb == 0: return 0.0
    return float(va.dot(vb) / (na*nb))

def _build_rag_answer(question: str, contexts: list[str]) -> str:
    # Có thể dùng Gemini generate; để tiết kiệm, mình dùng template nhẹ (không tốn token).
    if not contexts:
        return "Hiện chưa có ngữ cảnh phù hợp để trả lời."
    bullets = "\n".join(f"- {c}" for c in contexts[:3])
    return f"Dưới đây là thông tin liên quan tới câu hỏi “{question}”:\n{bullets}\nTóm lại, câu trả lời dựa trên các phản hồi tiêu biểu ở trên."

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

