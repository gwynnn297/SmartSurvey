SmartSurvey – AI Service (Sprint 3)

Dịch vụ AI phân tích sentiment cho câu trả lời khảo sát.
Cung cấp 2 API:
POST /ai/sentiment/{survey_id}: trigger phân tích (async job).
GET /ai/sentiment/{survey_id}: lấy kết quả % (positive/neutral/negative).

1) Yêu cầu môi trường
Python 3.11+ (đang dùng 3.13)
MySQL 8.x (charset utf8mb4)
(Tùy chọn) GPU/CUDA nếu muốn infer nhanh hơn

# vào thư mục ai-service
cd ai-service

# (khuyến nghị) tạo venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # PowerShell (Windows)
# source .venv/bin/activate    # macOS/Linux

# cài package
pip install -r requirements.txt

#Lưu ý:
Connection string sẽ là: mysql+pymysql://DB_USER:DB_PASS@DB_HOST:DB_PORT/DB_NAME?charset=utf8mb4
Nếu chưa có dữ liệu khảo sát trong MySQL, tạm dùng CSV tại: ../ai-research/data/survey_answers.csv (cột survey_id,answer_text).

# từ thư mục ai-service
python -m uvicorn app:app --reload
# Swagger: http://127.0.0.1:8000/docs

API Reference (cho controller/BE gọi)
POST /ai/sentiment/{survey_id}
Purpose: Trigger phân tích sentiment cho toàn bộ câu trả lời của survey.
Path params: survey_id: number
Body: trống (hoặc nhận theo nhu cầu sau này)
Response 200:
{ "survey_id": 1, "jobId": 123, "status": "QUEUED" }
GET /ai/sentiment/{survey_id}
Purpose: Lấy kết quả mới nhất đã lưu trong DB.
Response 200 (success):
{
  "survey_id": 1,
  "positive%": 0.72,
  "neutral%": 0.10,
  "negative%": 0.18,
  "sample_size": 50,
  "generated_at": "2025-09-27T09:42:43.381249"
}
#Response khi chưa có kết quả:
{ "error": "No sentiment found" }

## Chạy lệnh này trong mysql
USE smartsurvey;

ALTER TABLE activity_log 
MODIFY action_type ENUM(
  'login','logout',
  'create_survey','edit_survey','delete_survey',
  'add_question','edit_question','delete_question',
  'add_option','edit_option','delete_option',
  'submit_response',
  'ai_generate','ai_refresh_one','ai_refresh_all',
  'chat_ai','ai_query','ai_query_error','ai_eval'
);

## Chú ý Pin dependency để BE và local giống nhau
fastapi==0.115.0
uvicorn==0.30.6
SQLAlchemy==2.0.34
pymysql==1.1.1
scikit-learn==1.5.1
transformers==4.43.3
torch==2.3.1

## link checkoint : https://drive.google.com/drive/folders/1MLBOE-Ps7-oYyWvMzOb3ahjhvORgna-r?usp=sharing

## Sprint 4
1. Enhanced Text Analysis Service
Sprint 4 – Tính năng mới (Không cần train server)
Keywords: trích xuất n-gram bằng TF-IDF.
Basic Sentiment (rule-based): phân loại POS/NEU/NEG bằng từ điển + xử lý phủ định cơ bản.
Summary (Gemini + fallback): tóm tắt tiếng Việt bằng Gemini 2.5 Flash; khi quota/429 → fallback local.
Themes: gom nhóm chủ đề với TF-IDF → SVD → K-Means (hoặc truyền ?k=).
Lưu & truy xuất: ghi kết quả vào ai_analysis và hỗ trợ lấy bản mới nhất theo kind.
## KIND : (SUMMARY,INSIGHT,SENTIMENT)
## Smoke Test (5 bước)
Vào /docs gọi lần lượt:
POST /ai/keywords/{id}
POST /ai/basic-sentiment/{id}
POST /ai/themes/{id} (tùy chọn ?k=3)
POST /ai/summary/{id}
GET /ai/analysis/{id}/latest/SUMMARY

## Data Analytics & Insights Engine
1) POST /ai/insights/config/validate
Dùng để làm gì: Kiểm tra file cấu hình rule (ví dụ config/rules.yml) trước khi chạy thật.
Bạn nhận được: OK/ERR + thông tin khóa nào thiếu/sai kiểu (như lỗi trend.pct_change/monotonic_len bạn gặp trước đó).
Khi nào dùng:
Sau khi sửa rules.yml (bật/tắt compare, đổi ngưỡng alpha, effect_size_min, trend.pct_change, v.v.).
Trước khi commit để đảm bảo teammate pull về là chạy được ngay.
## Ví dụ (PowerShell):
Invoke-RestMethod -Method POST "http://127.0.0.1:8000/ai/insights/config/validate?config_path=config/rules.yml"
2) POST /ai/insights/run
Dùng để làm gì: Thực thi engine để sinh insights theo rule trên dữ liệu khảo sát.
Bạn nhận được: JSON tóm tắt (ok/kind/count) + đường dẫn report (vd. reports/1_insights.json, reports/1_insights.md).
Khi nào dùng:
Sau khi đã chuẩn bị dữ liệu (hoặc bảng materialized answers_analytical) & rules.yml hợp lệ.
Mỗi lần muốn refresh insight cho một survey.
## Ví dụ (PowerShell):
Invoke-RestMethod -Method POST "http://127.0.0.1:8000/ai/insights/run?survey_id=1&config_path=config/rules.yml"
3) GET /ai/insights/{survey_id}/latest
Dùng để làm gì: Lấy lại kết quả mới nhất đã chạy cho survey (không cần chạy lại).
Bạn nhận được: Điều kiện & danh sách insight đã lưu lần gần nhất (giúp hiển thị/dối chiếu nhanh).
## Ví dụ (PowerShell):
Invoke-RestMethod "http://127.0.0.1:8000/ai/insights/1/latest"


## Smart Response Processing giúp hệ thống hiểu và chuẩn hóa câu trả lời thô từ người dùng trước khi phân tích sâu hơn.
Pipeline xử lý từng câu gồm:
Text Cleaning – Chuẩn hóa tiếng Việt, bỏ ký tự thừa, emoji, link, dấu câu lộn xộn.
Language Detection – Phát hiện tiếng Việt / tiếng Anh / câu trộn (mixed).
Quality Scoring – Chấm điểm chất lượng câu trả lời (1–10) theo độ dài, rõ ràng, cụ thể, sạch.
Auto-categorization – Tự động gán tags theo chủ đề (bug, performance, pricing, auth, ios, android, …).
Duplicate Detection – Phát hiện câu trùng hoặc gần trùng (không dấu, sai chính tả nhẹ, viết khác cách)

## POST /ai/srp/process → test từng câu (VN, EN, mixed, duplicate).
{
  "items": [
    {
      "id": "m1",
      "text": "Mình ko mở được app, load mãi. Using iPhone 12 iOS 17"
    }
  ],
  "tag_rules_yaml": "config/rules.yml"
}
## POST /ai/srp/process/{survey_id} → xử lý batch thực tế.

## AI Service Integration & Optimization
Mục tiêu: Tối ưu hiệu suất, độ tin cậy và chi phí của các dịch vụ AI hiện có (Gemini, Sentiment, Summary).
- Response Caching (LRU + TTL) : Cache phản hồi Gemini cho sentiment và summary. Giảm 60–80% số lần gọi API lặp.
- Circuit Breaker + Retry : Khi Gemini lỗi liên tục → tự đóng mạch trong thời gian cooldown. Có retry + exponential backoff + jitter.
- Smart Rate Limiting : Cơ chế Token Bucket ngăn spam API. Giới hạn tần suất theo loại tác vụ (classify, summary).
- A/B Prompt Testing : Tự động chia traffic giữa 2 biến thể prompt (A/B) theo hash để so sánh độ chính xác và tốc độ.
- Metrics Endpoint : GET /ai/metrics hiển thị thống kê thời gian, tỉ lệ thành công, cache hit rate.
- Cost Optimization : Gộp batch, truncate prompt, cache dài TTL để tiết kiệm token và quota.

## Cách kiểm thử nhanh
Gọi các endpoint:
- POST /ai/basic-sentiment/{survey_id}
- POST /ai/summary/{survey_id}
## Mở GET /ai/metrics để xem:
- cache_hit tăng dần sau khi gọi lại cùng survey
- p95_ms < 5s
- success_rate ~100%


## Chatbot AI & Hybrid RAG (Smart Query)
Tính năng hỏi đáp thông minh dựa trên dữ liệu khảo sát, kết hợp giữa Rule-based (SQL) cho thống kê chính xác và Semantic Search (Vector DB) cho thấu hiểu ngữ nghĩa.
## Cài đặt & Cấu hình
- pip install chromadb

## API Reference
A. Nạp dữ liệu (Ingest) - Cần chạy trước khi chat
POST /ai/rag/ingest/{survey_id}
Chức năng: Đọc toàn bộ câu trả lời từ MySQL -> Tạo Vector (Gemini Embedding) -> Lưu vào ChromaDB.
Hiệu năng: Sử dụng Multi-threading (ThreadPoolExecutor) để xử lý song song, tốc độ nhanh gấp 8-10 lần so với tuần tự.
Response:
## JSON
{ "ok": true, "ingested": 150, "survey_id": 1 }
B. Chat với dữ liệu
POST /ai/chat
Body:
JSON
{
  "survey_id": 1,
  "question_text": "Khách hàng phàn nàn những gì về tính năng thanh toán?",
  "top_k": 5
}
Response:
JSON
{
  "answer_text": "Khách hàng thường gặp lỗi timeout khi thanh toán qua ví điện tử...",
  "context": ["Lỗi thanh toán momo...", "Không checkout được..."],
  "top_k": 5
}