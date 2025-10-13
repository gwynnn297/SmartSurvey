# Public Survey API Documentation

## Tổng quan
API này cung cấp các endpoint công khai để lấy thông tin survey và kiểm tra trạng thái survey mà không cần authentication.

## Base URL
```
http://localhost:8080/api/surveys
```

## Endpoints

### 1. Get Survey Public
Lấy thông tin survey công khai để người dùng trả lời.

**Endpoint:** `GET /api/surveys/{id}/public`

**Parameters:**
- `id` (path parameter): ID của survey (Long)

**Authentication:** Không cần

**Response:**

**200 OK - Survey khả dụng:**
```json
{
  "id": 1,
  "title": "Khảo sát về sức khỏe nhân viên",
  "description": "Khảo sát đánh giá tình trạng sức khỏe và môi trường làm việc",
  "status": "published",
  "categoryName": "Sức khỏe",
  "createdAt": "2024-01-15T10:30:00",
  "updatedAt": "2024-01-15T10:30:00",
  "questions": [
    {
      "id": 1,
      "text": "Bạn có hài lòng với môi trường làm việc hiện tại không?",
      "type": "multiple_choice",
      "required": true,
      "order": 1,
      "options": [
        {
          "id": 1,
          "text": "Rất hài lòng"
        },
        {
          "id": 2,
          "text": "Hài lòng"
        },
        {
          "id": 3,
          "text": "Trung bình"
        },
        {
          "id": 4,
          "text": "Không hài lòng"
        }
      ]
    }
  ]
}
```

**404 Not Found - Survey không tồn tại hoặc không khả dụng:**
```json
{
  "timestamp": "2024-01-15T10:30:00",
  "status": 404,
  "error": "Not Found",
  "message": "Survey not found"
}
```

### 2. Check Survey Status
Kiểm tra trạng thái survey có thể trả lời không.

**Endpoint:** `GET /api/surveys/{id}/status`

**Parameters:**
- `id` (path parameter): ID của survey (Long)

**Authentication:** Không cần

**Response:**

**200 OK - Survey đang hoạt động:**
```json
{
  "status": "active",
  "message": "Khảo sát đang hoạt động và có thể trả lời",
  "surveyId": 1,
  "title": "Khảo sát về sức khỏe nhân viên"
}
```

**403 Forbidden - Survey đã đóng:**
```json
{
  "status": "closed",
  "message": "Khảo sát đang ở trạng thái nháp, chưa được xuất bản",
  "surveyId": 1,
  "title": "Khảo sát về sức khỏe nhân viên"
}
```

**404 Not Found - Survey không tồn tại:**
```json
{
  "status": "not_found",
  "message": "Không tìm thấy khảo sát với ID: 999",
  "surveyId": 999
}
```

## Trạng thái Survey

| Status | Mô tả | HTTP Code |
|--------|-------|-----------|
| `active` | Survey đang hoạt động, có thể trả lời | 200 |
| `closed` | Survey đã đóng (draft/archived) | 403 |
| `not_found` | Survey không tồn tại | 404 |

## Các trường hợp lỗi

### Validation Errors
- **400 Bad Request**: ID không hợp lệ
- **404 Not Found**: Survey không tồn tại
- **403 Forbidden**: Survey không khả dụng để trả lời

### Business Logic
- Chỉ survey có status `published` mới có thể được truy cập qua API public
- Survey ở trạng thái `draft` hoặc `archived` sẽ trả về 403 Forbidden

## Performance Requirements
- Response time < 2 seconds
- API không require authentication
- Handle concurrent requests

## Testing

### Test Cases
1. **Valid published survey**: Trả về thông tin survey đầy đủ
2. **Draft survey**: Trả về 404 Not Found cho public API
3. **Archived survey**: Trả về 403 Forbidden
4. **Non-existent survey**: Trả về 404 Not Found
5. **Invalid ID format**: Trả về 400 Bad Request

### Postman Collection
Sử dụng file `SmartSurvey_AI_API_Tests.postman_collection.json` để test các endpoints.

### Unit Tests
Các unit tests được viết trong `SurveyControllerPublicTest.java` với coverage đầy đủ cho tất cả test cases.

## Security Considerations
- Các endpoint này không expose thông tin nhạy cảm như AI prompt, user info
- Không cần authentication nhưng vẫn validate input parameters
- Log đầy đủ access attempts để monitoring

## Integration Notes
- API này được thiết kế để frontend có thể gọi mà không cần JWT token
- Phù hợp cho việc embed survey vào các trang web khác
- Có thể được sử dụng bởi mobile app hoặc third-party applications
