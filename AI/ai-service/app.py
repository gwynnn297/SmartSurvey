from __future__ import annotations

import os
import re
import json
import math
import hashlib
import unicodedata
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

import numpy as np
import pymysql
import torch
import torch.nn.functional as F
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.sql import text

# sentence-transformers cho kNN
from sentence_transformers import SentenceTransformer
from sklearn.neighbors import NearestNeighbors
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# dự án sẵn có
from settings import settings
from db import init_db, SessionLocal, AiSentiment, Answer, Response, AiChatLog, ActivityLog
from sentiment_adapter import SentimentAdapter

# ============================================================
# BƯỚC 2: CHUẨN HOÁ VĂN BẢN (nâng cấp theo checklist)
# ============================================================
# Ánh xạ viết tắt/biến thể + emoji → từ thường
_ABBR = {
    "ko": "không", "k": "không", "k0": "không", "kh": "không",
    "dc": "được", "đc": "được", "ok": "ổn",
    "bt": "bình thường", "bthg": "bình thường", "bth": "bình thường",
    "tuyet": "tuyệt", "tuyetvoi": "tuyệt vời",
}
_EMO = {":))": "vui", ":)": "vui", ":D": "vui", ":(": "buồn", ":((": "buồn"}

SPACE_RE = re.compile(r"\s+")

def _normalize_unicode(s: str) -> str:
    # NFC/NFKC đều được; dùng NFKC để “đưa” ký tự hợp dạng
    return unicodedata.normalize("NFKC", s)

def _squash_repeats(s: str) -> str:
    # "tuyệtttt quá!!!" -> "tuyệt quá!!"
    s = re.sub(r"(.)\1{2,}", r"\1\1", s)
    s = re.sub(r"([!?.])\1{2,}", r"\1\1", s)
    return s

def _map_abbrev(tokens: List[str]) -> List[str]:
    out = []
    for t in tokens:
        out.append(_ABBR.get(t, t))
    return out

def _map_emoji(s: str) -> str:
    for k, v in _EMO.items():
        s = s.replace(k, f" {v} ")
    return s

def norm_text(t: str) -> str:
    """
    Chuẩn hoá nâng cao: unicode, emoji, viết tắt, URL/mention/hashtag, repeat...
    """
    if not t:
        return ""
    t = _normalize_unicode(t).lower().strip()
    t = _map_emoji(t)
    # xoá URL/mention/hashtag noise đơn giản
    t = re.sub(r"https?://\S+|www\.\S+", " ", t)
    t = re.sub(r"[@#]\S+", " ", t)
    t = _squash_repeats(t)
    # tách token đơn giản (từ/ số/ dấu)
    toks = re.findall(r"[a-zà-ỹ0-9]+|[^\w\s]", t, flags=re.UNICODE)
    toks = _map_abbrev(toks)
    # ghép lại, bỏ khoảng trắng thừa
    t = " ".join(toks)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t

# Giữ alias để các chỗ cũ dùng 'normalize()' vẫn chạy, nhưng giờ dùng logic mới
def normalize(s: str) -> str:
    return norm_text(s)

def sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

# Ranh giới nghịch liên từ (để tách mệnh đề kiểu “... nhưng ...”)
_ADVER = re.compile(
    r"\b(nhưng|tuy nhiên|song|mặc dù|mặc dù vậy|dù vậy|trái lại|ngược lại|tuy thế|dẫu vậy)\b",
    re.IGNORECASE,
)
def split_clauses(text: str) -> Tuple[List[str], bool]:
    # dùng norm_text để tách ổn định hơn
    t = norm_text(text)
    parts = _ADVER.split(t)
    if len(parts) >= 3:
        clauses = [parts[0]] + parts[2::2]
        clauses = [c.strip(" ,.;:!?") for c in clauses if c.strip()]
        return clauses, True
    return ([t] if t else []), False

# ============================================================
# DB helpers (PyMySQL thuần)
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
# Embedding + kNN
# ============================================================
_EMBED: Optional[SentenceTransformer] = None
def get_embed() -> SentenceTransformer:
    global _EMBED
    if _EMBED is None:
        # dùng multilingual-e5-base cho TViệt
        _EMBED = SentenceTransformer("intfloat/multilingual-e5-base")
    return _EMBED

def encode(texts: List[str]) -> np.ndarray:
    # e5 cần prefix "query: "
    model = get_embed()
    inputs = [f"query: {t}" for t in texts]
    vecs = model.encode(inputs, convert_to_numpy=True, normalize_embeddings=True, batch_size=32)
    return vecs.astype("float32")

class KNNIndex:
    def __init__(self):
        self.nn: Optional[NearestNeighbors] = None
        self.X: Optional[np.ndarray] = None
        self.labels: List[int] = []
        self.hashes: List[str] = []

    def fit(self, X: np.ndarray, labels: List[int], hashes: List[str]):
        if X.shape[0] == 0:
            self.nn = None
            self.X = None
            self.labels = []
            self.hashes = []
            return
        self.nn = NearestNeighbors(n_neighbors=min(5, X.shape[0]), metric="cosine")
        self.nn.fit(X)
        self.X = X
        self.labels = labels
        self.hashes = hashes

    def query(self, qvec: np.ndarray) -> Tuple[List[int], List[float]]:
        if self.nn is None or self.X is None or self.X.shape[0] == 0:
            return [], []
        dist, idx = self.nn.kneighbors(qvec, return_distance=True)
        sims = (1.0 - dist[0]).tolist()
        ids = idx[0].tolist()
        labs = [self.labels[i] for i in ids]
        return labs, sims

KNN = KNNIndex()
KNN_SIM_TH = 0.86   # đủ giống thì nhận

# ============================================================
# PhoBERT adapter + Calibration (Bước 8)
# ============================================================
_ADAPTER: Optional[SentimentAdapter] = None
def get_adapter() -> SentimentAdapter:
    global _ADAPTER
    if _ADAPTER is None:
        print("[adapter] Booting with MODEL_DIR =", settings.MODEL_DIR)
        _ADAPTER = SentimentAdapter()
        cfg = getattr(_ADAPTER.model, "config", None)
        if cfg is not None and hasattr(cfg, "id2label"):
            print("[adapter] id2label =", cfg.id2label)
    return _ADAPTER

# Calibration: đọc calib.json (temperature)
CALIB_PATH = Path("./calib.json")
_CALIB_CACHE = {"temperature": 1.0, "mtime": 0.0}

def get_temperature() -> float:
    try:
        st = CALIB_PATH.stat()
        if st.st_mtime != _CALIB_CACHE["mtime"]:
            t = 1.0
            with CALIB_PATH.open("r", encoding="utf-8") as f:
                cfg = json.load(f)
                t = float(cfg.get("temperature", 1.0))
                if t <= 0:
                    t = 1.0
            _CALIB_CACHE.update({"temperature": t, "mtime": st.st_mtime})
    except FileNotFoundError:
        _CALIB_CACHE.update({"temperature": 1.0, "mtime": 0.0})
    except Exception:
        # nếu lỗi parse: giữ cache cũ
        pass
    return float(_CALIB_CACHE["temperature"])

NEG, NEU, POS = 0, 1, 2

def model_predict(text: str) -> Tuple[int, float, Dict[str, Any]]:
    adapter = get_adapter()
    out = adapter.predict(text)
    # dạng dict
    if isinstance(out, dict):
        lab = str(out.get("label", out.get("pred_label", "neutral"))).lower()
        score = float(out.get("score", out.get("prob", out.get("confidence", 0.5))))
        m = {"negative": NEG, "neg": NEG, "0": NEG,
             "neutral": NEU, "neu": NEU, "1": NEU,
             "positive": POS, "pos": POS, "2": POS}
        lid = m.get(lab, NEU)
        return int(lid), float(score), {"raw": out}
    # dạng (label_id, prob)
    if isinstance(out, (list, tuple)) and len(out) >= 2:
        return int(out[0]), float(out[1]), {}
    # fallback
    return NEU, 0.5, {"raw": str(out)}

def _logits_for_text(t: str, adapter: SentimentAdapter) -> np.ndarray:
    tok = getattr(adapter, "tokenizer", None)
    mdl = getattr(adapter, "model", None)
    if tok is None or mdl is None:
        # fallback nếu không có model/tokenizer
        lid, prob, _ = model_predict(t)
        if lid == NEG:
            p = np.array([max(prob, 1e-3), 1e-3, 1e-3], dtype=np.float32)
        elif lid == POS:
            p = np.array([1e-3, 1e-3, max(prob, 1e-3)], dtype=np.float32)
        else:
            p = np.array([1e-3, max(prob, 1e-3), 1e-3], dtype=np.float32)
        return np.log(p)
    inputs = tok(t, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        out = mdl(**inputs)
        logits = out.logits.squeeze().cpu().numpy()
    return logits

def _probs(t: str, adapter: SentimentAdapter) -> np.ndarray:
    lg = _logits_for_text(t, adapter)
    T = max(1e-6, get_temperature())  # Bước 8: temperature scaling
    lg = lg / T
    e = np.exp(lg - lg.max())
    return (e / e.sum()).astype(np.float32)

# store prototype embeddings (tùy chọn; để trống nếu không dùng)
PROTOS_PATH = Path("./prototypes.json")
_PROTOS: Optional[Dict[str, List[List[float]]]] = None
def load_protos() -> Dict[str, List[List[float]]]:
    global _PROTOS
    if _PROTOS is None:
        if PROTOS_PATH.exists():
            _PROTOS = json.loads(PROTOS_PATH.read_text(encoding="utf-8"))
        else:
            _PROTOS = {}
    return _PROTOS

def embed_roberta(texts: List[str], tok, model) -> np.ndarray:
    if not texts:
        return np.zeros((0, 768), dtype=np.float32)
    model.eval()
    with torch.no_grad():
        batch = tok(texts, padding=True, truncation=True, max_length=128, return_tensors="pt")
        for k in batch:
            if hasattr(batch[k], "to"):
                batch[k] = batch[k].to(model.device)
        out = model.roberta(**batch, output_hidden_states=True, return_dict=True)
        last = out.last_hidden_state
        mask = batch["attention_mask"].unsqueeze(-1)
        emb = (last * mask).sum(1) / (mask.sum(1).clamp(min=1))
        emb = F.normalize(emb, p=2, dim=1)
        return emb.cpu().numpy().astype(np.float32)

def proto_knn_label(t: str, adapter: SentimentAdapter, k: int = 7) -> Tuple[Optional[int], float]:
    protos = load_protos()
    if not protos:
        return None, 0.0
    emb = embed_roberta([t], adapter.tokenizer, adapter.model)[0]
    best_lbl, best_score = None, -1e9
    for lbl, vecs in protos.items():
        if not vecs:
            continue
        V = np.asarray(vecs, dtype=np.float32)
        sims = np.dot(V, emb)
        score = float(np.sort(sims)[-k:].mean())
        if score > best_score:
            best_score = score
            best_lbl = int(lbl)
    return best_lbl, best_score

HEDGE_PATTERNS = ["tùy", "tuỳ", "khó nói chắc", "khó nói", "còn sớm", "tạm ổn", "để xem", "có lúc", "đôi khi"]

def looks_neutral(norm_text: str) -> bool:
    return any(p in norm_text for p in HEDGE_PATTERNS)

def resolve_label(text: str, adapter: SentimentAdapter,
                  tau: float = 0.5, margin: float = 0.08, alpha: float = 1.8,
                  use_protos: bool = True) -> Tuple[int, Dict[str, Any]]:
    probs = _probs(text, adapter)              # [neg, neu, pos]
    order = list(np.argsort(probs)[::-1])
    maxp, gap = float(probs[order[0]]), float(probs[order[0]] - probs[order[1]])

    # đủ tự tin
    if maxp >= tau and gap >= margin:
        return int(order[0]), {"route": "confident", "probs": probs.tolist()}

    # tách mệnh đề
    clauses, has_adv = split_clauses(text)
    if has_adv and len(clauses) >= 2:
        after = clauses[-1]
        p0 = probs
        p1 = _probs(after, adapter)
        log_mix = np.log(np.maximum(p0, 1e-8)) + alpha * np.log(np.maximum(p1, 1e-8))
        pmix = np.exp(log_mix - log_mix.max()); pmix = pmix / pmix.sum()
        lid = int(np.argmax(pmix))
        return lid, {"route": "clause_mix", "probs": pmix.tolist(), "clauses": clauses}

    # prototype (nếu có)
    if use_protos:
        lidp, score = proto_knn_label(text, adapter)
        if lidp is not None:
            return int(lidp), {"route": "proto_knn", "proto_score": float(score)}

    return int(np.argmax(probs)), {"route": "fallback", "probs": probs.tolist()}

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
    print("[startup] MODEL_DIR =", settings.MODEL_DIR)

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
    c = {NEG: 0, NEU: 0, POS: 0}
    for l in labels:
        c[l] = c.get(l, 0) + 1
    pct = lambda n: (n * 100.0 / total) if total else 0.0
    return {
        "total_responses": total,
        "positive_percent": pct(c[POS]),
        "neutral_percent": pct(c[NEU]),
        "negative_percent": pct(c[NEG]),
        "counts": {"POS": c[POS], "NEU": c[NEU], "NEG": c[NEG]},
        "sample_size": total,
    }

# core: cache → kNN → resolver/model → log
def classify_and_log(survey_id: int, question_id: Optional[int], answer_id: Optional[int], raw: str) -> int:
    nt = norm_text(raw)       # dùng chuẩn hoá nâng cao
    th = sha256(nt)

    # cache: nếu đã có final_label
    row = sql_one(
        "SELECT final_label, pred_conf FROM ai_inference WHERE text_hash=%s AND final_label IS NOT NULL LIMIT 1",
        (th,),
    )
    if row:
        log_inference(survey_id, question_id, answer_id, raw, nt, "cache-final",
                      int(row["final_label"]), float(row["pred_conf"]), int(row["final_label"]),
                      "cached", {"note": "cache"})
        return int(row["final_label"])

    # kNN
    labs, sims = KNN.query(encode([nt]))
    if labs and sims[0] >= KNN_SIM_TH:
        lab = int(labs[0]); conf = float(sims[0])
        log_inference(survey_id, question_id, answer_id, raw, nt, "knn", lab, conf, lab, "cached",
                      {"knn_top_sim": conf})
        return lab

    # model + resolver
    adapter = get_adapter()
    lid, info = resolve_label(raw, adapter, tau=0.5, margin=0.08, alpha=1.8, use_protos=True)

    # Tính confidence thực tế hơn để phục vụ auto-audit (Bước 5)
    conf = 0.66
    if isinstance(info, dict):
        if "probs" in info:
            conf = float(max(info["probs"]))
        elif info.get("route") == "proto_knn":
            conf = float((info.get("proto_score", 0.0) + 1.0) / 2.0)

    final_lab = lid
    # nếu mơ hồ / từ ngữ lưng chừng -> NEU
    if looks_neutral(nt):
        final_lab = NEU
    status = "needs_review" if final_lab != lid else "ok"

    log_inference(survey_id, question_id, answer_id, raw, nt, "model", lid, conf, final_lab, status, info)
    return final_lab

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
                       description=f"Recomputed with cache/kNN/resolver"))
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
# Chat (RAG nội bộ đơn giản)
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
        return f"Có {count} câu trả lời Không/No trong survey {survey_id}."
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
        q_norm = norm_text(req.question_text)  # dùng chuẩn hoá mới
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

# ============================================================
# Correct & kNN reload
# ============================================================
class CorrectionIn(BaseModel):
    final_label: int  # 0/1/2

@app.post("/ai/analysis/{inference_id}/correct")
def correct_analysis(inference_id: int, body: CorrectionIn):
    row = sql_one("SELECT * FROM ai_inference WHERE inference_id=%s", (inference_id,))
    if not row:
        raise HTTPException(404, "inference_id not found")

    # 1) cập nhật inference
    sql_exec("UPDATE ai_inference SET final_label=%s, status='corrected' WHERE inference_id=%s",
             (int(body.final_label), inference_id))

    # 2) upsert vào kho chuẩn vàng (ai_training_samples)
    nt = row["norm_text"]; h = row["text_hash"]; y = int(body.final_label)
    ex = sql_one("SELECT sample_id FROM ai_training_samples WHERE text_hash=%s", (h,))
    if ex:
        sql_exec("UPDATE ai_training_samples SET label=%s WHERE sample_id=%s", (y, ex["sample_id"]))
    else:
        v = encode([nt])[0]
        sql_exec(
            "INSERT INTO ai_training_samples (text, norm_text, text_hash, label, embed, source) VALUES (%s,%s,%s,%s,%s,'review')",
            (row["raw_text"], nt, h, y, v.tobytes()),
        )
    return {"ok": True}

@app.post("/ai/reload-knn", summary="Reload Knn")
def reload_knn():
    """
    Nạp lại index kNN từ:
      - ai_training_samples (ưu tiên)
      - cộng thêm ai_calib_items (nếu có) cho các mẫu 'đinh' (neutral/hedge,…)
    """
    try:
        # 1) Lấy từ ai_training_samples
        rows = sql_all("SELECT norm_text, text_hash, label, embed FROM ai_training_samples ORDER BY sample_id ASC")
        texts: List[str] = []
        labels: List[int] = []
        hashes: List[str] = []
        embs: List[Optional[np.ndarray]] = []
        need_encode_idx_ts: List[int] = []

        for i, r in enumerate(rows):
            nt = (r["norm_text"] or "").strip()
            if not nt:
                continue
            texts.append(nt)
            labels.append(int(r["label"]))
            hashes.append(r["text_hash"])
            if r["embed"] is None:
                embs.append(None)
                need_encode_idx_ts.append(i)
            else:
                embs.append(np.frombuffer(r["embed"], dtype="float32"))

        # 1.1) Mã hoá phần thiếu embed và lưu lại DB
        if need_encode_idx_ts:
            new_vecs = encode([texts[i] for i in need_encode_idx_ts])
            with _conn() as con:
                with con.cursor() as cur:
                    for j, row_i in enumerate(need_encode_idx_ts):
                        cur.execute(
                            "UPDATE ai_training_samples SET embed=%s WHERE text_hash=%s",
                            (new_vecs[j].tobytes(), hashes[row_i]),
                        )
                con.commit()
            # điền vào mảng embs
            j = 0
            for t in range(len(embs)):
                if embs[t] is None:
                    embs[t] = new_vecs[j]
                    j += 1

        # 2) Cộng thêm từ ai_calib_items (nếu có)
        try:
            rows_cal = sql_all("SELECT text, norm_text, label FROM ai_calib_items")
            hash_set = set(hashes)
            cal_texts: List[str] = []
            cal_labels: List[int] = []
            cal_hashes: List[str] = []

            for r in rows_cal:
                nt = (r.get("norm_text") or "").strip()
                if not nt:
                    nt = norm_text(r.get("text") or "")
                if not nt:
                    continue
                h = sha256(nt)
                if h in hash_set:
                    continue
                cal_texts.append(nt)
                cal_labels.append(int(r["label"]))
                cal_hashes.append(h)
                hash_set.add(h)

            if cal_texts:
                cal_vecs = encode(cal_texts)
                for v, yl, hh, tt in zip(cal_vecs, cal_labels, cal_hashes, cal_texts):
                    texts.append(tt)
                    labels.append(yl)
                    hashes.append(hh)
                    embs.append(v)
        except Exception:
            # nếu bảng không tồn tại: bỏ qua
            pass

        X = np.vstack(embs).astype("float32") if embs else np.zeros((0, 768), dtype="float32")
        KNN.fit(X, labels, hashes)
        return {"ok": True, "index": {"samples": len(texts), "dim": int(X.shape[1]) if X.size else 0}}
    except Exception as e:
        raise HTTPException(500, f"reload_knn failed: {e}")
