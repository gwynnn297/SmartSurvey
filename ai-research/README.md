# SmartSurvey - AI Research (Sprint 1)

## Goal
- Prototype sentiment (pos/neu/neg) chạy trên sample CSV
- Kick-off summarization tiếng Việt (viT5)
- Dev container để tái lập môi trường nhanh

## Dev Container
- VSCode: Dev Containers
- Mở project → Ctrl+Shift+P → "Dev Containers: Reopen in Container"

## Run sentiment
```bash
python ai-research/scripts/sentiment_infer.py --input ai-research/data/sample_vi_sentiment.csv --output ai-research/data/predictions.csv

smartsurvey/
│
├── ai-research/
│ ├── data/ # Chứa dataset
│ │ ├── uit_vsfc_sentiment.csv # Dataset chuẩn đã xử lý
│ │ ├── sample_vi_sentiment.csv # Dataset mẫu (Sprint 1)
│ │ └── sample_vi_sentiment_labeled.csv
│ ├── scripts/
│ │ ├── sentiment_train_eval.py # Script huấn luyện & đánh giá
│ │ └── prepare_dataset.py # Script tải/chuẩn hóa dataset
│ └── reports/
│ ├── sentiment_report.md # Báo cáo kết quả (Sprint 2)
│ └── sentiment_metrics.json # File metrics chi tiết
└── README.md # Hướng dẫn này


## 📦 Cài đặt môi trường

Yêu cầu:
- Python 3.13 (đã test chạy với 3.13.2)
- Git
- (Tùy chọn) Kaggle CLI nếu muốn tải dataset trực tiếp

### Bước 1: Tạo môi trường ảo
```bash
python -m venv .venv
.\.venv\Scripts\activate   # Windows

📂 Dataset
1. Dataset nhỏ (Sprint 1)

Có sẵn trong ai-research/data/sample_vi_sentiment_labeled.csv.

2. Dataset UIT-VSFC (Sprint 2)

Đã tải từ Kaggle và convert thành CSV:
ai-research/data/uit_vsfc_sentiment.csv

python ai-research/scripts/sentiment_train_eval.py --data ai-research/data/uit_vsfc_sentiment.csv

Kết quả sẽ được lưu trong:
ai-research/reports/sentiment_report.md
ai-research/reports/sentiment_metrics.json