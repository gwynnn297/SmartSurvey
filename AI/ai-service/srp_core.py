# srp_core.py
from __future__ import annotations
import re, unicodedata, hashlib
from typing import Optional, Dict, Any, List, Tuple
from pydantic import BaseModel
import unicodedata, re
from difflib import SequenceMatcher

# --- Các helper SRP (self-contained, không cần import từ app.py) ---
_ABBR = {
    "ko": "không", "k": "không", "k0": "không", "kh": "không",
    "dc": "được", "đc": "được", "ok": "ok",
    "bt": "bình thường", "bthg": "bình thường", "bth": "bình thường",
}
_EMO = {":))": "vui", ":)": "vui", ":D": "vui", ":(": "buồn", ":((": "buồn"}

def norm_text(t: str) -> str:
    if not t:
        return ""
    t = unicodedata.normalize("NFKC", t).lower().strip()
    for k, v in _EMO.items(): t = t.replace(k, f" {v} ")
    t = re.sub(r"https?://\S+|www\.\S+", " ", t)
    t = re.sub(r"[@#]\S+", " ", t)
    t = re.sub(r"(.)\1{2,}", r"\1\1", t)
    t = re.sub(r"([!?.])\1{2,}", r"\1\1", t)
    toks = re.findall(r"[a-zà-ỹ0-9]+|[^\w\s]", t, flags=re.UNICODE)
    toks = [_ABBR.get(tok, tok) for tok in toks]
    t = " ".join(toks)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t

def _norm_for_dupe(s: str) -> str:
    # NFKD + bỏ dấu
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    # lower + chỉ giữ chữ/số và khoảng trắng
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s{2,}", " ", s).strip()
    return s

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

VI_CHARS = set("ăâđêôơưáàạảãấầậẩẫắằặẳẵéèẹẻẽếềệểễíìịỉĩóòọỏõốồộổỗớờợởỡúùụủũứừựửữýỳỵỷỹ")
EN_CHARS = set("abcdefghijklmnopqrstuvwxyz")

def _is_vi_token(tok: str) -> bool:
    return any(ch in VI_CHARS for ch in tok)

def _is_en_token(tok: str) -> bool:
    import re
    return bool(re.fullmatch(r"[a-z]+", tok))

def srp_clean(text: str) -> str:
    if not text: return ""
    t = unicodedata.normalize("NFKC", text)
    t = t.replace("\u00a0", " ")
    t = norm_text(t)
    return t

def srp_lang_detect(text: str, en_min=0.20, en_max=0.80) -> tuple[str, float]:
    import re
    t = (text or "").lower()
    toks = re.findall(r"[a-zà-ỹ]+", t)
    if not toks:
        return "vi", 0.0

    vi_tokens = sum(1 for tok in toks if _is_vi_token(tok))
    en_tokens = sum(1 for tok in toks if _is_en_token(tok))
    total = max(1, vi_tokens + en_tokens)
    en_ratio = en_tokens / total

    if vi_tokens and en_tokens and en_min <= en_ratio <= en_max:
        return "mixed", en_ratio
    return ("en" if en_ratio > en_max else "vi"), en_ratio


def srp_quality_score(text: str, lang: str) -> tuple[int, dict]:
    t = text.strip()
    n_chars = len(t)
    n_words = len(t.split())
    has_punct = 1 if re.search(r"[.!?…]", t) else 0
    has_digit = 1 if re.search(r"\d", t) else 0
    has_url = 1 if re.search(r"https?://|www\.", t) else 0
    upper_ratio = sum(1 for c in t if c.isupper()) / max(1, n_chars)
    toks = re.findall(r"[a-zà-ỹ]+", t, flags=re.IGNORECASE)
    uniq_ratio = len(set(toks)) / max(1, len(toks))

    if n_words >= 20: 
        p_len = 3 
    elif n_words >= 8: 
        p_len = 2
    elif n_words >= 3:
        p_len = 1
    else:
        p_len = 0 
    p_clr = 3 if has_punct or n_words >= 15 else 2
    p_rel = 2 - min(1, has_url)
    p_spc = 1 if has_digit else 0
    p_clean = 1 if (upper_ratio < 0.5 and uniq_ratio > 0.5) else 0

    score = max(1, min(10, p_len + p_clr + p_rel + p_spc + p_clean))
    meta = {
        "length_words": n_words,
        "has_punct": bool(has_punct),
        "has_digit": bool(has_digit),
        "has_url": bool(has_url),
        "upper_ratio": round(upper_ratio, 3),
        "uniq_ratio": round(uniq_ratio, 3),
    }
    return score, meta

_TAG_RULES_DEFAULT = {
    "bug": [r"\blỗi\b", r"\bbug\b", r"\bcrash\b", r"\bđơ\b", r"\bkhông (mở|login|đăng nhập|chạy)\b"],
    "performance": [r"\bchậm\b", r"\blag\b", r"\bload mãi\b", r"\btreo\b"],
    "pricing": [r"\bgiá\b", r"\bđắt\b", r"\bpricing\b", r"\bchi phí\b"],
    "auth": [r"\bđăng nhập\b", r"\blogin\b", r"\b2fa\b", r"\bxác thực\b"],
    "ios": [r"\bios\b", r"\biphone\b", r"\bios \d+\b"],
    "android": [r"\bandroid\b"],
    "ux": [r"\bgiao diện\b", r"\bkhó dùng\b", r"\btrải nghiệm\b"],
    "feature-request": [r"\b(nên|muốn|cần) thêm\b", r"\btính năng\b", r"\bfeature\b"],
}

def _load_tag_rules_yaml(path: str | None) -> dict | None:
    if not path: return None
    try:
        import yaml, pathlib
        p = pathlib.Path(path)
        if not p.is_file(): return None
        with p.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data.get("tag_rules") or None
    except Exception:
        return None

def srp_auto_tags(text: str, yaml_path: str | None = None) -> list[str]:
    rules = _load_tag_rules_yaml(yaml_path) or _TAG_RULES_DEFAULT
    tags: list[str] = []
    for tag, patterns in rules.items():
        for pat in patterns:
            if re.search(pat, text, flags=re.IGNORECASE):
                tags.append(tag); break
    # de-dup, giữ thứ tự
    seen = set(); out = []
    for t in tags:
        if t not in seen: out.append(t); seen.add(t)
    return out

def _shingles(s: str, n: int) -> set[str]:
    if len(s) < n:
        return {s}
    return {s[i:i+n] for i in range(len(s)-n+1)}

def srp_duplicate_check(
    text: str,
    corpus_hashes: dict[str, str],
    jaccard_thresh: float = 0.85,
    seq_ratio_thresh: float = 0.86
):
    # exact dup trên text sạch (hash)
    t_hash = sha256(text)
    if t_hash in corpus_hashes:
        return True, t_hash

    # near-dup trên bản đã bỏ dấu
    t_norm = _norm_for_dupe(text)
    n = 2 if len(t_norm) < 20 else 3
    s1 = _shingles(t_norm, n)

    for h, t2 in corpus_hashes.items():
        t2_norm = _norm_for_dupe(t2)
        s2 = _shingles(t2_norm, n)

        inter = len(s1 & s2)
        uni = len(s1 | s2) or 1
        jacc = inter / uni

        # thêm tiêu chí chuỗi/biên tập
        seqr = SequenceMatcher(None, t_norm, t2_norm).ratio()

        if jacc >= jaccard_thresh or seqr >= seq_ratio_thresh:
            return True, h

    return False, None


# ---- Pydantic models + orchestrator ----
class SRPItem(BaseModel):
    id: str | None = None
    text: str

class SRPBatchRequest(BaseModel):
    items: list[SRPItem]
    tag_rules_yaml: str | None = None

class SRPResult(BaseModel):
    id: str | None
    text_clean: str
    lang: str
    code_mix_ratio: float
    quality_score: int
    tags: list[str]
    duplicate: bool
    duplicate_of: str | None
    meta: dict

def srp_process_one(raw_text: str, known_hashes: dict[str, str], tag_yaml: str | None = None, rules_yaml: str | None = None) -> SRPResult:
    clean = srp_clean(raw_text)

    cfg = load_srp_config(rules_yaml)
    th = get_thresholds(cfg)

    # tag rules: ưu tiên srp.tag_rules; nếu không có thì đọc file chuyên biệt tag_yaml; fallback default
    tag_rules = (cfg.get("tag_rules") if cfg else None)
    if tag_rules is None:
        tag_rules = _load_tag_rules_yaml(tag_yaml) or _TAG_RULES_DEFAULT

    lang, mix_ratio = srp_lang_detect(clean, en_min=th["code_mix_en_min"], en_max=th["code_mix_en_max"])
    q, meta = srp_quality_score(clean, lang)
    # dùng rules trực tiếp, bỏ qua file khác
    tags = []
    for tag, patterns in tag_rules.items():
        for pat in patterns:
            if re.search(pat, clean, flags=re.IGNORECASE):
                tags.append(tag); break
    # duplicate theo ngưỡng từ rules.yml
    is_dup, dup_of = srp_duplicate_check(clean, known_hashes, jaccard_thresh=th["near_dup_jaccard"])

    return SRPResult(
        id=None,
        text_clean=clean,
        lang=lang,
        code_mix_ratio=round(float(mix_ratio), 4),
        quality_score=int(q),
        tags=list(dict.fromkeys(tags)),
        duplicate=bool(is_dup),
        duplicate_of=dup_of,
        meta=meta
    )


def load_srp_config(path: str | None) -> dict:
    """
    Đọc file YAML tổng hợp. Trả về dict rỗng nếu không có.
    Kỳ vọng cấu trúc có khối 'srp' với 'tag_rules' và 'thresholds'.
    """
    if not path: return {}
    try:
        import yaml, pathlib
        p = pathlib.Path(path)
        if not p.is_file(): return {}
        with p.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data.get("srp") or {}
    except Exception:
        return {}

def get_thresholds(cfg: dict) -> dict:
    th = (cfg.get("thresholds") or {})
    return {
        "code_mix_en_min": float(th.get("code_mix_en_min", 0.20)),
        "code_mix_en_max": float(th.get("code_mix_en_max", 0.80)),
        "near_dup_jaccard": float(th.get("near_dup_jaccard", 0.85)),
    }

def _strip_accents(s: str) -> str:
    # chuyển "bị đơ" -> "bi do"
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))