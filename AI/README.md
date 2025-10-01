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


