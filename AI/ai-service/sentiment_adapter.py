# ai-service/sentiment_adapter.py
# Adapter đơn giản hoá – thay bằng model thật của bạn nếu muốn
from typing import List

class SentimentAdapter:
    def __init__(self):
        # Khởi tạo model/tham số ở đây nếu cần
        pass

    def predict_texts(self, texts: List[str]) -> List[str]:
        """
        Trả về list nhãn: 'POS' | 'NEU' | 'NEG'
        (demo rule-based rất đơn giản — thay bằng model thật của bạn)
        """
        out = []
        for t in texts:
            s = (t or "").lower()
            if any(w in s for w in ["tuyệt", "tốt", "hài lòng", "great", "good", "love"]):
                out.append("POS")
            elif any(w in s for w in ["tệ", "xấu", "không thích", "bad", "hate"]):
                out.append("NEG")
            else:
                out.append("NEU")
        return out
