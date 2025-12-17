# 🤖 SmartSurvey AI Service

## 📋 Tổng quan

AI Survey Generator là một microservice sử dụng Google Gemini API để tự động tạo ra các khảo sát thông minh dựa trên prompt của người dùng. Service này được xây dựng bằng FastAPI và tích hợp với hệ thống SmartSurvey chính.

## 🚀 Tính năng chính

- ✅ **Tạo khảo sát tự động**: Sử dụng AI để tạo khảo sát từ prompt tiếng Việt
- ✅ **Đa dạng loại câu hỏi**: Hỗ trợ multiple_choice, open_ended, rating, boolean_
- ✅ **Kiểm soát số lượng**: Cho phép chỉ định chính xác số câu hỏi cần tạo (3-20)
- ✅ **Đối tượng mục tiêu**: Tối ưu câu hỏi theo target audience
- ✅ **Validation**: Kiểm tra tính hợp lệ của prompt và response
- ✅ **Health check**: Monitoring và kiểm tra trạng thái service

## 🛠️ Tech Stack

- **Framework**: FastAPI 0.104+
- **AI Provider**: Google Gemini Pro API
- **Language**: Python 3.11+
- **Validation**: Pydantic v2
- **HTTP Client**: HTTPX
- **CORS**: Hỗ trợ cross-origin requests

## 📦 Cài đặt và Setup

### 1. Clone repository

```bash
cd /Users/tt/Documents/SmartSurvey/AI/services/survey-generator
```

### 2. Cài đặt Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Cấu hình Environment Variables

Bạn có 2 cách để cấu hình biến môi trường:

#### Cách 1: Tạo file `.env` (Khuyến nghị)

Tạo file `.env` trong thư mục `/AI/services/survey-generator/`:

```bash
# Tạo file .env
cd /Users/tt/Documents/SmartSurvey/AI/services/survey-generator
touch .env
```

Sau đó mở file `.env` và thêm nội dung:

```env
# Required: Google Gemini API Key
GEMINI_API_KEY=YOUR_ACTUAL_API_KEY_HERE

# Optional: Service configuration
HOST=0.0.0.0
PORT=8002
DEBUG=true
```

#### Cách 2: Export trực tiếp trong terminal

```bash
# Required: Google Gemini API Key
export GEMINI_API_KEY="YOUR_ACTUAL_API_KEY_HERE"

# Optional: Service configuration
export HOST="0.0.0.0"
export PORT="8002"
export DEBUG="true"
```

> **⚠️ Quan trọng**: 
> - Phải có `GEMINI_API_KEY` để service hoạt động
> - File `.env` sẽ tự động được load khi chạy service
> - Export command chỉ có hiệu lực trong session terminal hiện tại

### 4. Khởi chạy Service

#### Cách 1: Sử dụng file `.env` (Khuyến nghị)
```bash
# Chạy từ thư mục survey-generator (không vào app/)
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

#### Cách 2: Export environment variables trước khi chạy
```bash
# Chạy từ thư mục survey-generator
export GEMINI_API_KEY="your-api-key"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

#### Cách 3: Inline environment variables (một lệnh)
```bash
# Chạy từ thư mục survey-generator
GEMINI_API_KEY=AIzaSyAGB9sSlWRf0BOxJaEOrb8sJX7wQGlIO6o python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8002
```

> **💡 Lưu ý**: 
> - Cách 1 (file `.env`) tiện lợi nhất và bảo mật hơn
> - Cách 3 (inline) như bạn đã dùng: `GEMINI_API_KEY=AIzaSyC2rBe8abSir3_J_oG2mskGDj6zBR2uNU0 python3 -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload`

### 5. Kiểm tra Service

Service sẽ chạy tại: `http://localhost:8002`

- **Health check**: `GET http://localhost:8002/health`
- **API Documentation**: `http://localhost:8002/docs`
- **OpenAPI Schema**: `http://localhost:8002/openapi.json`

## 📡 API Endpoints

### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "survey-generator", 
  "version": "1.0.0"
}
```

### 2. Validate Prompt
```http
GET /validate-prompt?prompt={your-prompt}
```

**Response:**
```json
{
  "valid": true,
  "message": "Prompt hợp lệ",
  "timestamp": 1728143768000,
  "prompt_length": 45,
  "detected_language": "vi"
}
```

### 3. Generate Survey (Main API)
```http
POST /generate
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Khảo sát sức khỏe nhân viên",
  "description": "Khảo sát về tình hình sức khỏe",
  "category_id": 1,
  "ai_prompt": "Tạo khảo sát về sức khỏe nhân viên với các câu hỏi về thể chất và tinh thần",
  "target_audience": "Nhân viên văn phòng 25-35 tuổi",
  "number_of_questions": 5
}
```

**Response Success:**
```json
{
  "success": true,
  "message": "Tạo khảo sát thành công",
  "survey_id": null,
  "generated_survey": {
    "title": "Khảo sát Sức khỏe và Hạnh phúc Nhân viên",
    "description": "Khảo sát này nhằm mục đích...",
    "questions": [
      {
        "question_text": "Bạn đánh giá sức khỏe của mình như thế nào?",
        "question_type": "rating",
        "is_required": true,
        "display_order": 1,
        "options": []
      },
      {
        "question_text": "Bạn có thường xuyên tập thể dục không?",
        "question_type": "multiple_choice", 
        "is_required": true,
        "display_order": 2,
        "options": [
          {
            "option_text": "Hàng ngày",
            "display_order": 1
          },
          {
            "option_text": "3-4 lần/tuần", 
            "display_order": 2
          }
        ]
      }
    ]
  },
  "error_details": null
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "AI tạo 3 câu hỏi nhưng bạn yêu cầu 5 câu hỏi. Vui lòng thử lại.",
  "survey_id": null,
  "generated_survey": null,
  "error_details": {
    "error_type": "question_count_mismatch",
    "actual_count": 3,
    "expected_count": 5,
    "suggestion": "Thử lại hoặc điều chỉnh prompt để rõ ràng hơn"
  }
}
```

## 🔧 Configuration

### Request Validation Rules

| Field | Type | Required | Min | Max | Description |
|-------|------|----------|-----|-----|-------------|
| `title` | string | ✅ | 1 | 100 | Tiêu đề khảo sát |
| `description` | string | ✅ | 1 | 500 | Mô tả khảo sát |
| `category_id` | integer | ✅ | - | - | ID danh mục |
| `ai_prompt` | string | ✅ | 10 | 1000 | Prompt cho AI |
| `target_audience` | string | ❌ | - | 200 | Đối tượng mục tiêu |
| `number_of_questions` | integer | ✅ | 3 | 20 | Số câu hỏi cần tạo |

### Question Types

| Type | Description | Has Options |
|------|-------------|-------------|
| `multiple_choice` | Trắc nghiệm nhiều lựa chọn | ✅ |
| `open_ended` | Câu hỏi mở | ❌ |
| `rating` | Đánh giá theo thang điểm | ❌ |
| `boolean_` | Đúng/Sai | ❌ |

### Category Mapping

```python
CATEGORY_MAPPING = {
    1: "Education",
    2: "Healthcare", 
    3: "Technology",
    4: "Business",
    5: "Entertainment"
    # Thêm mapping theo database
}
```

## 🐛 Troubleshooting

### Lỗi thường gặp

#### 1. "Gemini API key not found"
```bash
# Đảm bảo đã set environment variable
export GEMINI_API_KEY="your-api-key"
```

#### 2. "Connection refused" 
```bash
# Kiểm tra service có đang chạy không
curl http://localhost:8002/health
```

#### 3. "Question count mismatch"
- AI đôi khi tạo số câu hỏi không đúng yêu cầu
- Thử điều chỉnh prompt rõ ràng hơn
- Kiểm tra `number_of_questions` có hợp lệ (3-20)

#### 4. "Invalid prompt"
- Prompt phải có ít nhất 10 ký tự
- Sử dụng tiếng Việt rõ ràng
- Tránh ký tự đặc biệt không cần thiết

#### 5. "Rate Limit Exceeded (429)"
```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded for quota metric 'Generate Content API requests per minute'"
  }
}
```
**Nguyên nhân & Giải pháp:**
- **Quota bằng 0**: API key không có quota để tạo content
  - Kiểm tra billing trong [Google Cloud Console](https://console.cloud.google.com/)
  - Kích hoạt thanh toán cho project
- **Vượt quá giới hạn requests/minute**: 
  - ✨ **Auto-fallback**: Service tự động chuyển sang model khác khi hết quota
  - Fallback chain: `gemini-2.5-flash` (5 RPM) → `gemini-2.5-flash-lite` (10 RPM)
  - Free tier chỉ hỗ trợ 2 models này
  - Đợi 1 phút rồi thử lại
  - Giảm tần suất gọi API
- **API key hết hạn hoặc không hợp lệ**:
  - Tạo API key mới tại [Google AI Studio](https://makersuite.google.com/app/apikey)
  - Cập nhật API key trong environment variables

### ✨ Auto-Fallback Models (Mới!)

Service hỗ trợ **tự động chuyển đổi model** khi gặp rate limit (429) hoặc server error (503/500):

**Fallback Chain (theo thứ tự ưu tiên):**
1. **gemini-2.5-flash** - Chất lượng tốt nhất (5 RPM limit)
2. **gemini-2.5-flash-lite** - Nhanh hơn (10 RPM limit)

> **⚠️ Lưu ý:** Google AI Studio free tier chỉ hỗ trợ models **v2.5** (`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-flash-tts`). Các models v1.5 và gemma không khả dụng với free API key.

**Cách hoạt động:**
- Khi `gemini-2.5-flash` hết quota → tự động thử `gemini-2.5-flash-lite`
- Nếu vẫn fail → thử tiếp `gemini-1.5-flash`
- Cứ thế cho đến khi tìm được model khả dụng hoặc hết chain

**Logs ví dụ:**
```
⚠️ Model 'gemini-2.5-flash' gặp lỗi 429. Fallback sang 'gemini-2.5-flash-lite'...
✅ Fallback thành công với model 'gemini-2.5-flash-lite'
```

### Debug Mode

Để bật debug logging:

```bash
export DEBUG=true
GEMINI_API_KEY=your-key python3 -m uvicorn main:app --log-level debug
```

## 🔗 Tích hợp với Backend

Service này được gọi từ Spring Boot backend qua `SurveyGeneratorService`:

```java
// Backend configuration
@Value("${ai.survey-generator.base-url:http://localhost:8002}")
private String aiServiceBaseUrl;
```

**Endpoint mapping:**
- Backend: `POST /api/ai/generate-survey`  
- AI Service: `POST /generate`

## 📁 Cấu trúc Project

```
survey-generator/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── models/
│   │   └── survey_schemas.py # Pydantic models & validation
│   └── core/
│       └── gemini_client.py  # Gemini API integration
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## 🚦 Testing

### Manual Testing

```bash
# Test health
curl http://localhost:8002/health

# Test validation
curl "http://localhost:8002/validate-prompt?prompt=Tạo khảo sát về sức khỏe"

# Test generation
curl -X POST http://localhost:8002/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Survey",
    "description": "Test description",
    "category_id": 1,
    "ai_prompt": "Tạo khảo sát về sức khỏe nhân viên",
    "target_audience": "Nhân viên văn phòng",
    "number_of_questions": 5
  }'
```

### Integration Testing

Service này tích hợp với Spring Boot backend. Test full flow:

```bash
# Với JWT token hợp lệ
curl -X POST http://localhost:8080/api/ai/generate-survey \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "title": "Test Survey",
    "description": "Test description", 
    "categoryId": 1,
    "aiPrompt": "Tạo khảo sát về sức khỏe nhân viên",
    "targetAudience": "Nhân viên văn phòng",
    "numberOfQuestions": 5
  }'
```

## 📞 Support

Nếu gặp vấn đề:

1. **Check logs**: Xem terminal output khi chạy service
2. **Verify API key**: Đảm bảo Gemini API key hợp lệ
3. **Test endpoints**: Dùng `/health` và `/docs` để kiểm tra
4. **Check integration**: Verify backend có thể kết nối được

## 📝 Development Notes

- Service sử dụng auto-reload trong development mode
- Response được cached ngắn hạn để tăng performance  
- Gemini API có rate limit, cần xử lý appropriately
- Logging được cấu hình để debug dễ dàng

---

## Endpoints

- POST /generate — tạo N câu hỏi: body theo SurveyGenerationRequest. Trả success=true + data.questions[] đã chuẩn hoá (type/options/score). Low-quality sẽ trả success=false + error_details.low_quality.
- POST /refresh_question — làm mới 1 câu hỏi nhanh với question_type, có thể truyền previous_question/previous_options để tránh trùng lặp.
- GET /templates — xem danh sách templates & supported types.
- GET /validate-prompt?prompt=... — check prompt nhanh (optional).
- GET /health — healthcheck.
multiple_choice, single_choice, ranking, rating, open_ended, boolean_


**Version**: 1.0.0  
**Last Updated**: October 2025  
**Maintainer**: SmartSurvey Development Team