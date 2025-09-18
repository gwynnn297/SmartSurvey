# User Management API Documentation

## Overview
This document describes the new User Management API that replaces the old profile system.

## Endpoints

### Create User
**POST** `/api/users`

Creates a new user in the system.

#### Request Body
```json
{
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "password": "password123",
  "role": "creator"
}
```

#### Request Fields
- `fullName` (required): User's full name (max 255 characters)
- `email` (required): User's email address (must be unique, max 255 characters)
- `password` (required): User's password (min 6 characters, max 255 characters)
- `role` (optional): User's role - "admin", "creator", or "respondent" (defaults to "creator")

#### Response (Success - 201 Created)
```json
{
  "userId": 1,
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "role": "creator",
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00",
  "updatedAt": "2024-01-15T10:30:00"
}
```

#### Response (Error - 400 Bad Request)
```json
{
  "message": "Email đã được sử dụng: john.doe@example.com",
  "status": "error"
}
```

#### Validation Errors
- Empty fullName: "Họ tên không được để trống"
- Invalid email: "Email không hợp lệ"
- Empty email: "Email không được để trống"
- Short password: "Mật khẩu phải có ít nhất 6 ký tự"
- Empty password: "Mật khẩu không được để trống"

## Security
- The endpoint requires authentication (JWT token)
- Passwords are automatically hashed using BCrypt
- The response never includes the password hash

## Database Schema
The API uses the existing `users` table with the following structure:
- `user_id`: Primary key (auto-increment)
- `full_name`: User's full name
- `email`: User's email (unique)
- `password_hash`: Hashed password
- `role`: User role (admin/creator/respondent)
- `is_active`: Account status
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

## Example Usage

### cURL Example
```bash
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fullName": "Jane Smith",
    "email": "jane.smith@example.com",
    "password": "securepassword123",
    "role": "respondent"
  }'
```

### JavaScript Example
```javascript
const response = await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    password: 'securepassword123',
    role: 'respondent'
  })
});

const user = await response.json();
console.log('Created user:', user);
```

---

# Survey API (Sprint 2)

## Overview
Các endpoint quản lý khảo sát của user hiện tại. Tất cả yêu cầu cần JWT. Mọi response sử dụng DTO chuẩn, không trả về entity thô. Các thao tác create/update/delete được ghi vào bảng `activity_log` với action_type tương ứng (`create_survey`, `edit_survey`, `delete_survey`).

## DTO Summary
- SurveyResponseDTO
```json
{
  "id": 12,
  "title": "Khảo sát sự hài lòng",
  "description": "Mô tả...",
  "status": "draft|published|archived",
  "aiPrompt": "Gợi ý AI...",
  "categoryId": 3,
  "categoryName": "Marketing",
  "userId": 5,
  "userName": "Nguyễn Văn A",
  "createdAt": "2025-09-18T10:20:11",
  "updatedAt": "2025-09-18T10:20:11"
}
```

### Tạo khảo sát
**POST** `/surveys`

Request (SurveyCreateRequestDTO):
```json
{
  "title": "Khảo sát sản phẩm",
  "description": "Thu thập ý kiến khách hàng",
  "categoryId": 3,
  "aiPrompt": "Hãy gợi ý 5 câu hỏi về trải nghiệm người dùng"
}
```
Response 200 (SurveyResponseDTO): như cấu trúc ở trên.

Validation lỗi ví dụ:
```json
{ "message": "Tiêu đề khảo sát không được để trống", "status": "error" }
```

### Danh sách khảo sát của tôi
**GET** `/surveys`

Response 200:
```json
[
  { "id":1, "title":"Khảo sát A", "status":"draft", "categoryId":null, "aiPrompt":null, "createdAt":"...", "updatedAt":"..." },
  { "id":2, "title":"Khảo sát B", "status":"draft", "categoryId":3, "aiPrompt":"Gợi ý...", "createdAt":"...", "updatedAt":"..." }
]
```

### Chi tiết khảo sát
**GET** `/surveys/{id}`
Response 200: SurveyResponseDTO
404/400 error (IdInvalidException):
```json
{ "message": "Không tìm thấy khảo sát", "status": "error" }
```

### Cập nhật khảo sát
**PUT** `/surveys/{id}`

Request (SurveyUpdateRequestDTO - tất cả optional):
```json
{
  "title": "Khảo sát sản phẩm (v2)",
  "description": "Bổ sung chỉ số NPS",
  "categoryId": 4,
  "status": "published",
  "aiPrompt": "Đề xuất 3 câu hỏi NPS"
}
```
Response 200: SurveyResponseDTO (đã cập nhật)

### Xóa khảo sát
**DELETE** `/surveys/{id}`
Response 200 (SurveyDeleteResponseDTO):
```json
{ "id": 12, "message": "Xóa khảo sát thành công" }
```

## Ghi Activity Log
Tự động tạo bản ghi:
- POST /surveys -> action_type: `create_survey`
- PUT /surveys/{id} -> action_type: `edit_survey`
- DELETE /surveys/{id} -> action_type: `delete_survey`

Trường được lưu: user_id, action_type, target_id (survey_id), target_table="surveys", description="...".

# Category API (Chuẩn hóa ngoại lệ)

**GET** `/categories` -> 200: List<Category>

**POST** `/categories`
```json
{ "categoryName": "Marketing" }
```
Lỗi trùng tên:
```json
{ "message": "Tên danh mục đã tồn tại", "status": "error" }
```

**PUT** `/categories/{id}` cập nhật `categoryName`.

**DELETE** `/categories/{id}` -> 200:
```json
{ "message": "Xóa danh mục thành công" }
```

Các lỗi NOT FOUND / VALIDATION giờ dùng `IdInvalidException` và trả về dạng chuẩn qua `GlobalException` (nếu đã cấu hình). Nếu chưa, cần bổ sung chuẩn hóa JSON error wrapper.

---

## Ghi chú mở rộng (Backlog)
- Phân trang GET /surveys: sẽ dùng `SurveyPaginationDTO` trong tương lai (`page`, `size`, `total`, `items`).
- Chuẩn hóa tất cả error response vào một ErrorDTO chung.
- Thêm bộ lọc theo trạng thái & category: `/surveys?status=published&categoryId=3`.
- Bổ sung Swagger/OpenAPI.


