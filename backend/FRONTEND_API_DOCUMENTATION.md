# API Documentation cho Frontend - Question Types và Response Handling

## Overview
Tài liệu này mô tả chi tiết các endpoints và format data cho tất cả question types, bao gồm cả file upload và mixed responses.

## Base URL
```
http://localhost:8080
```

## Authentication
Tất cả requests cần Bearer token trong header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 1. QUESTION MANAGEMENT

### 1.1 Tạo Question
```http
POST /questions/{surveyId}
Content-Type: application/json
```

**Request Body (cho tất cả question types):**
```json
{
  "questionText": "Câu hỏi của bạn",
  "questionType": "multiple_choice", // hoặc single_choice, ranking, boolean_, file_upload, date_time, open_ended, rating
  "isRequired": true
}
```

**Response:**
```json
{
  "id": 1,
  "surveyId": 1,
  "surveyTitle": "Survey Title",
  "questionText": "Câu hỏi của bạn",
  "questionType": "multiple_choice",
  "questionTypeDescription": "Trắc nghiệm nhiều lựa chọn",
  "isRequired": true,
  "displayOrder": 1,
  "createdAt": "2025-10-27T10:00:00",
  "updatedAt": "2025-10-27T10:00:00"
}
```

### 1.2 Tạo Options (cho multiple_choice, single_choice, boolean_, ranking)
```http
POST /options/{questionId}
Content-Type: application/json
```

**Request Body:**
```json
{
  "optionText": "Option A",

}
```

**Lưu ý đặc biệt cho Boolean Questions:**
- Tạo 2 options: "Yes" và "No" hoặc "Có" và "Không"
- Frontend nên tự động tạo 2 options này khi question type là `boolean_`

---

## 2. RESPONSE SUBMISSION

### 2.1 Submit Response (chỉ JSON - không có file)
```http
POST /responses
Content-Type: application/json
```

**Request Body:**
```json
{
  "surveyId": 1,
  "answers": [
    {
      "questionId": 1,
      
      "selectedOptionIds": [1, 3, 5]
    },
    {
      "questionId": 2, 
      
      "selectedOptionId": 2
    },
    {
      "questionId": 3,
      
      "selectedOptionId": 1
    },
    {
      "questionId": 4,
     
      "rankingOptionIds": [2, 1, 3]
    },
    {
      "questionId": 5,
    
      "dateValue": "2025-10-27",
      "timeValue": "14:30"
    },
    {
      "questionId": 6,
     
      "answerText": "Đây là câu trả lời dạng text"
    },
    {
      "questionId": 7,
     
      "answerText": "4"
    }
  ]
}
```

### 2.2 Submit Response với Files (Mixed Content)
```http
POST /responses/with-files
Content-Type: multipart/form-data
```

**Form Data:**
```
surveyId: 1
answers: [JSON string của các answers như trên]
file_8: [File object cho question ID 8]
file_9: [File object cho question ID 9]
```

**Ví dụ answers JSON string cho mixed content:**
```json
[
  {
    "questionId": 1,
    
    "selectedOptionIds": [1, 3]
  },
  {
    "questionId": 2,
    
    "selectedOptionId": 2
  },
  {
    "questionId": 8,
    
    "answerText": "File sẽ được upload"
  },
  {
    "questionId": 9, 
    
    "answerText": "Một file khác"
  }
]
```

---

## 3. RESPONSE FORMAT CHI TIẾT

### 3.1 Multiple Choice Response
```json
{
  "questionId": 1,
  
  "selectedOptionIds": [1, 3, 5]
}
```

### 3.2 Single Choice Response  
```json
{
  "questionId": 2,
  
  "selectedOptionId": 2
}
```

### 3.3 Boolean Response
```json
{
  "questionId": 3,
  
  "selectedOptionId": 1  // 1 = Yes/Có, 2 = No/Không
}
```

### 3.4 Ranking Response
```json
{
  "questionId": 4,
  
  "rankingOptionIds": [3, 1, 2]  // Option IDs in ranking order (best to worst)
}
```

**Hoặc legacy format (backward compatibility):**
```json
```

### 3.5 Date Time Response
```json
{
  "questionId": 5,
  "questionType": "date_time",
  "dateValue": "2025-10-27",      // YYYY-MM-DD format
  "timeValue": "14:30"            // HH:mm format  
}
```

### 3.6 Open Ended Response
```json
{
  "questionId": 6,
  "questionType": "open_ended",
  "answerText": "Đây là câu trả lời dạng text tự do"
}
```

### 3.7 Rating Response
```json
{
  "questionId": 7,
  "questionType": "rating", 
  "answerText": "4"  // Giá trị rating dạng string
}
```

### 3.8 File Upload Response
```json
{
  "questionId": 8,
  "questionType": "file_upload",
  "answerText": "File description hoặc để trống"
}
```

---

## 4. RESPONSE OUTPUT FORMAT

### 4.1 Response Success (JSON only)
```json
{
  "responseId": 1,
  "surveyId": 1,
  "userId": 1,
  "requestToken": "anonymous_user_token",
  "submittedAt": "2025-10-27T10:00:00",
  "answers": [
    {
      "answerId": 1,
      "questionId": 1,
      "selectedOptionIds": [1, 3, 5],
      "answerText": null,
      "createdAt": "2025-10-27T10:00:00",
      "questionText": "Bạn thích màu gì?",
      "uploadedFiles": null
    },
    {
      "answerId": 2,
      "questionId": 2,
      "optionId": 2,
      "answerText": null,
      "createdAt": "2025-10-27T10:00:00", 
      "questionText": "Giới tính của bạn?",
      "uploadedFiles": null
    }
  ]
}
```

### 4.2 Response Success (với files)
```json
{
  "responseId": 1,
  "surveyId": 1,
  "userId": 1,
  "requestToken": "anonymous_user_token",
  "submittedAt": "2025-10-27T10:00:00",
  "answers": [
    {
      "answerId": 3,
      "questionId": 8,
      "answerText": "File uploaded successfully: document.pdf",
      "createdAt": "2025-10-27T10:00:00",
      "questionText": "Upload CV của bạn",
      "uploadedFiles": [
        {
          "fileId": 1,
          "originalFileName": "document.pdf",
          "fileName": "uuid_timestamp_document.pdf",
          "fileType": "application/pdf",
          "fileSize": 1024000,
          "downloadUrl": "/api/files/download/1",
          "uploadedAt": "2025-10-27T10:00:00"
        }
      ]
    }
  ]
}
```

---

## 5. FILE MANAGEMENT

### 5.1 Download File
```http
GET /files/download/{fileId}
```

**Response:** File binary data với appropriate headers

### 5.2 Get File Info
```http
GET /files/info/{fileId}
```

**Response:**
```json
{
  "fileId": 1,
  "originalFileName": "document.pdf",
  "fileName": "uuid_timestamp_document.pdf", 
  "fileType": "application/pdf",
  "fileSize": 1024000,
  "downloadUrl": "/api/files/download/1",
  "uploadedAt": "2025-10-27T10:00:00"
}
```

---

## 6. FRONTEND IMPLEMENTATION NOTES

### 6.1 Question Type Handling
- **multiple_choice**: Cho phép chọn nhiều options, gửi `selectedOptionIds` array
- **single_choice**: Cho phép chọn 1 option, gửi `selectedOptionId` single value
- **boolean_**: Tự động tạo 2 options (Yes/No), treat như single_choice
- **ranking**: Input dạng drag-drop, gửi `rankingOptionIds` array theo thứ tự preference (recommended) hoặc `rankingOrder` array cho legacy format
- **date_time**: 2 input fields (date picker + time picker)
- **open_ended**: Textarea cho text tự do
- **rating**: Slider hoặc star rating, gửi value dạng string
- **file_upload**: File input, cần dùng multipart/form-data endpoint

### 6.2 Mixed Content Strategy
Khi survey có cả file upload và các question types khác:
1. Sử dụng endpoint `/responses/with-files`
2. Gửi `answers` dạng JSON string trong form data
3. Gửi files với key format `file_{questionId}`

### 6.3 Validation Requirements
- **isRequired**: Check trước khi submit
- **Multiple choice**: Ít nhất 1 option được chọn
- **Single choice/Boolean**: Exactly 1 option được chọn  
- **Date time**: Validate format date/time
- **File upload**: Check file size, type nếu cần

### 6.4 Error Handling
Tất cả APIs trả về error format:
```json
{
  "message": "Error description",
  "timestamp": "2025-10-27T10:00:00"
}
```

---

## 7. TESTING với POSTMAN

### 7.1 Import Collections
- `postman_complete_survey_test.json` - Complete test suite
- `postman_file_upload_test.json` - File upload specific tests
- `postman_mixed_questions_test.json` - Mixed content tests

### 7.2 Environment Variables
```
base_url: http://localhost:8080/api
auth_token: <your-jwt-token>
```

---

## 8. SECURITY CONSIDERATIONS

- Tất cả endpoints cần authentication trừ các endpoint public
- File uploads được validate type và size
- CORS đã được config cho frontend development
- Rate limiting có thể được apply

---

**Lưu ý quan trọng:**
1. **File uploads** bắt buộc phải dùng `/responses/with-files` endpoint
2. **Mixed surveys** (có cả file và non-file questions) dùng chung endpoint `/responses/with-files`
3. **Pure JSON surveys** (không có file) có thể dùng `/responses` endpoint đơn giản hơn
4. **Boolean questions** về logic giống single choice nhưng frontend nên UI khác
5. **Ranking questions** cần implement drag-drop interface
6. **File info** được trả về trong response để frontend hiển thị