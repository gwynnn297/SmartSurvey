# sentiment_adapter.py
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any

import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

from settings import settings


def _normalize_label(s: str) -> str:
    s = (s or "").strip().upper()
    if s in {"POS", "POSITIVE", "LABEL_2", "LABEL2"}:
        return "POS"
    if s in {"NEG", "NEGATIVE", "LABEL_0", "LABEL0"}:
        return "NEG"
    return "NEU"


@dataclass
class SentimentResult:
    labels: List[str]
    probs: List[Dict[str, float]]  # mỗi phần tử: {"NEG": p, "NEU": p, "POS": p}


class SentimentAdapter:
    def __init__(self, batch_size: int = 16, max_length: int = 256) -> None:
        self.batch_size = batch_size
        self.max_length = max_length

        # --- Quyết định dùng checkpoint local hay model online
        model_dir = Path(settings.MODEL_DIR) if settings.MODEL_DIR else None
        if model_dir and model_dir.exists():
            model_path = str(model_dir)          # dùng str() để tránh edge-case Windows
            local_only = True
        else:
            model_path = settings.HF_MODEL_NAME  # repo id trên Hub
            local_only = False

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=local_only)
            self.model = AutoModelForSequenceClassification.from_pretrained(model_path, local_files_only=local_only)
        except Exception as e:
            raise RuntimeError(
                f"Load model failed from '{model_path}' (local_only={local_only}). "
                "Kiểm tra MODEL_DIR/HF_MODEL_NAME và các file: config.json, "
                "model.safetensors (hoặc pytorch_model.bin), tokenizer_config.json. "
                f"Nguyên nhân gốc: {e}"
            ) from e

        # --- Device
        self.device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
        self.model.to(self.device)
        self.model.eval()

        # --- id2label: ép key về int để không lệch "0"/"1"/"2"
        raw_map = getattr(self.model.config, "id2label", None) or {}
        id2label: Dict[int, str] = {}
        for k, v in raw_map.items():
            try:
                k_int = int(k)
            except Exception:
                continue
            id2label[k_int] = _normalize_label(v)

        # Fallback nếu checkpoint không có id2label
        if not id2label:
            n = int(getattr(self.model.config, "num_labels", 3))
            if n == 3:
                id2label = {0: "NEG", 1: "NEU", 2: "POS"}
            elif n == 2:
                id2label = {0: "NEG", 1: "POS"}
            else:
                id2label = {i: "NEU" for i in range(n)}

        self.id2label = id2label
        self.num_labels = int(getattr(self.model.config, "num_labels", len(self.id2label) or 3))
        self.neutral_threshold = float(settings.NEUTRAL_THRESHOLD)

    # ---------- Public API ----------
    def predict_texts(self, texts: List[str]) -> SentimentResult:
        texts = [t if isinstance(t, str) else "" for t in texts]
        probs_all: List[Dict[str, float]] = []
        labels_all: List[str] = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            enc = self.tokenizer(
                batch,
                truncation=True,
                padding=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            enc = {k: v.to(self.device) for k, v in enc.items()}
            with torch.no_grad():
                logits = self.model(**enc).logits
                if self.num_labels >= 3:
                    prob = F.softmax(logits, dim=-1).cpu().numpy()
                    for row in prob:
                        d = {
                            "NEG": float(row[self._idx_of("NEG")]),
                            "NEU": float(row[self._idx_of("NEU")]),
                            "POS": float(row[self._idx_of("POS")]),
                        }
                        probs_all.append(d)
                        labels_all.append(max(d, key=d.get))
                elif self.num_labels == 2:
                    # Nhị phân: coi nhãn 1 là POS, 0 là NEG; NEU theo threshold
                    prob = F.softmax(logits, dim=-1).cpu().numpy()
                    for row in prob:
                        p_neg = float(row[self._idx_of("NEG", fallback=0)])
                        p_pos = float(row[self._idx_of("POS", fallback=1)])
                        # phân bổ "trung lập" nếu 1 - max < threshold
                        top = max(p_neg, p_pos)
                        if 1 - top < self.neutral_threshold:
                            # rõ ràng đủ mạnh → giữ POS/NEG
                            label = "POS" if p_pos >= p_neg else "NEG"
                            d = {"NEG": p_neg, "NEU": 0.0, "POS": p_pos}
                        else:
                            # không đủ mạnh → NEU
                            label = "NEU"
                            d = {"NEG": p_neg, "NEU": 1.0 - top, "POS": p_pos}
                        probs_all.append(d)
                        labels_all.append(label)
                else:
                    raise RuntimeError(f"Unsupported num_labels={self.num_labels}")

        return SentimentResult(labels=labels_all, probs=probs_all)

    # ---------- Helpers ----------
    def _idx_of(self, label: str, fallback: int | None = None) -> int:
        # Tìm chỉ số theo id2label; nếu không thấy dùng fallback
        for idx, lab in self.id2label.items():
            if lab == label:
                return idx
        if fallback is None:
            raise KeyError(f"Label '{label}' not found in id2label={self.id2label}")
        return fallback
