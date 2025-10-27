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

## TASK AI-Powered Survey Generation Enhancement
Tổng quan về TASK : 
Mục tiêu: Sinh câu hỏi khảo sát theo topic + industry một cách động, không set cứng; có validator tránh câu dẫn dắt/cảm tính; lưu lịch sử; hoạt động được cả khi Gemini lỗi (fallback).
Nguồn dữ liệu cấu hình:
ai_survey_industry: chứa code, templates (JSON), is_active.
ai_survey_rule: chứa rule_type (BLOCK|LEADING), pattern, lang, is_active (có thể dùng industry_code nếu muốn áp dụng rule theo ngành).
Sinh câu hỏi:
Ưu tiên gọi Gemini (use_llm=true), trả về JSON Array câu hỏi; nếu lỗi/quota → fallback (TF-IDF chọn từ templates).
Validator: làm sạch khoảng trắng, thêm ? nếu thiếu, loại câu LEADING/BLOCK, loại trùng, lọc độ dài an toàn.
Lưu lịch sử: bảng ai_survey_gen_history (không ràng buộc FK cứng với surveys; có cột survey_id nullable để bạn gắn khi cần).

API chi tiết (hoạt động & cách dùng)
## A. POST /ai/survey/templates/seed
Làm gì: Seed tối thiểu 5 industry (general, education, retail, fintech, healthcare) vào ai_survey_industry.templates.
Hoạt động: Upsert code=name=industry, templates = mảng câu hỏi mẫu (có {topic}).
Khi nào dùng: Thiết lập ban đầu môi trường / thêm nhanh các template mặc định.
Kỳ vọng: Trả { ok: true, seeded: [...industry] }.
## B. POST /ai/survey/templates/upsert
Body ví dụ:
{
  "industry": "education",
  "templates": [
    "Bạn đánh giá mức độ rõ ràng của nội dung {topic} như thế nào?",
    "Tốc độ/khối lượng bài tập của {topic} có phù hợp không?"
  ]
}
Làm gì: Upsert mảng templates cho 1 industry cụ thể.
Hoạt động: Ghi vào ai_survey_industry.templates và bật is_active=1.
Khi nào dùng: Quản trị nội dung template theo ngành.

## C. GET /ai/survey/templates
Làm gì: Liệt kê các pack hiện có (industry, số câu, trạng thái).
Hoạt động: Đọc từ ai_survey_industry (đếm JSON_LENGTH(templates)).
Khi nào dùng: FE trang admin / QA kiểm tra dữ liệu đã seed/upsert.

## D. POST /ai/survey/rules/add
Body ví dụ:
{"rule_type":"BLOCK","pattern":"tuyệt đối","lang":"vi","is_active":true} 
hoặc :
{"rule_type":"LEADING","pattern":"có phải","lang":"vi","is_active":true}

Làm gì: Thêm rule kiểm duyệt (BLOCK = cấm từ ngữ cảm tính/cường điệu; LEADING = cấm câu dẫn dắt).
Hoạt động: Upsert vào ai_survey_rule; cache được reload.
Khi nào dùng: Điều chỉnh chất lượng sinh câu hỏi mà không sửa code.

## E. POST /ai/survey/config/reload
Làm gì: Reload cache cấu hình trong RAM.
Hoạt động: Nạp lại templates_by_industry + rules từ DB vào _CFG.
Khi nào dùng: Sau khi seed/upsert/rule add; hoặc khi muốn áp dụng thay đổi ngay.

## F. POST /ai/survey/generate
Body ví dụ : 
{
  "topic": "Chất lượng lớp học Python",
  "industry": "education",
  "n": 8,
  "language": "vi",
  "use_llm": true,
  "survey_id": 1,      // optional: gắn lịch sử vào survey thực tế
  "user_id": 12        // optional: ghi activity log
}
Làm gì: Sinh n câu hỏi cho topic/ngành.
Hoạt động:
Nếu use_llm=true và GEMINI_KEY hợp lệ → gọi Gemini (schema JSON array), lấy danh sách câu hỏi.
Nếu Gemini lỗi/quota/timeout → fallback TF-IDF từ templates của industry.
Áp validator (chống LEADING/BLOCK, thêm ?, loại trùng, lọc độ dài).
Nếu sau khi lọc chưa đủ n, tự bù thêm bằng fallback đến đủ n.
Lưu lịch sử vào ai_survey_gen_history (có source = gemini|fallback) + tùy survey_id.
Khi nào dùng: FE click “Generate” trên màn hình tạo/sửa khảo sát.
Response mẫu:
{
  "topic": "Chất lượng lớp học Python",
  "industry": "education",
  "language": "vi",
  "n": 8,
  "questions": ["...?", "...?"],
  "source": "gemini",
  "validation": {"unique": 8, "total": 8},
  "history_id": 123
}


