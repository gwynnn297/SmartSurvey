# ai-service/analysis.py
from collections import Counter
from typing import List, Dict

# map nhãn tuỳ adapter – sửa cho khớp adapter của bạn
LABEL_MAP = {
    "POS": "positive",
    "NEU": "neutral",
    "NEG": "negative",
    "positive": "positive",
    "neutral": "neutral",
    "negative": "negative",
}

def aggregate_sentiment(labels: List[str]) -> Dict[str, float]:
    """
    Nhận list nhãn đầu ra ['POS','NEG','NEU', ...] và trả về tỉ lệ.
    """
    norm = [LABEL_MAP.get(x, x).lower() for x in labels if x]
    c = Counter(norm)
    n = sum(c.values()) or 1
    return {
        "positive": c.get("positive", 0) / n,
        "neutral":  c.get("neutral", 0)  / n,
        "negative": c.get("negative", 0) / n,
        "sample_size": n,
    }
