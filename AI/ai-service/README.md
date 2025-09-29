# AI Service – Sentiment API (Sprint 3)

## Chạy
python -m uvicorn app:app --reload   # từ thư mục ai-service/

## Nguồn dữ liệu (tạm)
CSV: ../ai-research/data/survey_answers.csv  (columns: survey_id, answer_text)

## API
POST /ai/sentiment/{survey_id}
  -> { "survey_id": 1, "jobId": 3, "status": "QUEUED" }

GET  /ai/sentiment/{survey_id}
  -> {
       "survey_id": 1,
       "positive%": 0.7,
       "neutral%": 0.1,
       "negative%": 0.2,
       "sample_size": 10,
       "generated_at": "2025-09-27T09:42:43.381249"
     }

## Ghi chú
- Lần đầu model load có thể chậm vài giây.
- Khi có DB `survey_answers`, sửa loader để đọc từ DB thay vì CSV.

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
    'chat_ai',
    'ai_query',      -- thêm mới
    'ai_sentiment'   -- thêm mới
  ) NOT NULL;
