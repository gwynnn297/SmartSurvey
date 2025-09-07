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
