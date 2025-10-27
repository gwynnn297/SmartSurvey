# Raw JSON/Form Data Examples - Chi Tiết

## 1. COMPLETE SURVEY EXAMPLES

### Scenario 1: Survey chỉ có JSON (không file)
**Survey có: Multiple Choice + Single Choice + Boolean + Rating**

#### Create Questions:
```bash
# Question 1: Multiple Choice
POST /api/questions/1
{
  "questionText": "Bạn thích màu gì? (chọn nhiều)",
  "questionType": "multiple_choice",
  "isRequired": true
}

# Create options cho Question 1
POST /api/options/1
{"optionText": "Đỏ", "displayOrder": 1}

POST /api/options/1  
{"optionText": "Xanh", "displayOrder": 2}

POST /api/options/1
{"optionText": "Vàng", "displayOrder": 3}

# Question 2: Single Choice
POST /api/questions/1
{
  "questionText": "Giới tính của bạn?",
  "questionType": "single_choice", 
  "isRequired": true
}

# Create options cho Question 2
POST /api/options/2
{"optionText": "Nam", "displayOrder": 1}

POST /api/options/2
{"optionText": "Nữ", "displayOrder": 2}

# Question 3: Boolean
POST /api/questions/1
{
  "questionText": "Bạn có thích pizza không?",
  "questionType": "boolean_",
  "isRequired": true
}

# Create options cho Question 3 (Boolean)
POST /api/options/3
{"optionText": "Có", "displayOrder": 1}

POST /api/options/3
{"optionText": "Không", "displayOrder": 2}

# Question 4: Rating
POST /api/questions/1
{
  "questionText": "Đánh giá sản phẩm từ 1-5",
  "questionType": "rating",
  "isRequired": true
}
```

#### Submit Response:
```bash
POST /api/responses
Content-Type: application/json
Authorization: Bearer <token>

{
  "surveyId": 1,
  "answers": [
    {
      "questionId": 1,
      "questionType": "multiple_choice",
      "selectedOptionIds": [1, 3]
    },
    {
      "questionId": 2,
      "questionType": "single_choice", 
      "selectedOptionId": 1
    },
    {
      "questionId": 3,
      "questionType": "boolean_",
      "selectedOptionId": 1
    },
    {
      "questionId": 4,
      "questionType": "rating",
      "answerText": "4"
    }
  ]
}
```

---

### Scenario 2: Survey với File Upload
**Survey có: Text + File Upload**

#### Create Questions:
```bash
# Question 1: Open Ended
POST /api/questions/1
{
  "questionText": "Mô tả về bản thân",
  "questionType": "open_ended",
  "isRequired": true
}

# Question 2: File Upload
POST /api/questions/1
{
  "questionText": "Upload CV của bạn",
  "questionType": "file_upload", 
  "isRequired": true
}
```

#### Submit Response with Files:
```bash
POST /api/responses/with-files
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
surveyId: 1
answers: [{"questionId":1,"questionType":"open_ended","answerText":"Tôi là một developer"},{"questionId":2,"questionType":"file_upload","answerText":"CV của tôi"}]
file_2: [CV.pdf file]
```

---

### Scenario 3: Mixed Survey (All Types)
**Survey có tất cả question types**

#### Create Questions:
```bash
# Question 1: Multiple Choice 
POST /api/questions/1
{
  "questionText": "Sở thích của bạn? (chọn nhiều)",
  "questionType": "multiple_choice",
  "isRequired": true
}

# Options cho Q1:
POST /api/options/1
{"optionText": "Đọc sách", "displayOrder": 1}
POST /api/options/1  
{"optionText": "Xem phim", "displayOrder": 2}
POST /api/options/1
{"optionText": "Du lịch", "displayOrder": 3}
POST /api/options/1
{"optionText": "Thể thao", "displayOrder": 4}

# Question 2: Single Choice
POST /api/questions/1
{
  "questionText": "Trình độ học vấn?",
  "questionType": "single_choice",
  "isRequired": true  
}

# Options cho Q2:
POST /api/options/2
{"optionText": "Đại học", "displayOrder": 1}
POST /api/options/2
{"optionText": "Thạc sĩ", "displayOrder": 2}
POST /api/options/2
{"optionText": "Tiến sĩ", "displayOrder": 3}

# Question 3: Boolean
POST /api/questions/1
{
  "questionText": "Bạn có muốn nhận thông báo email?",
  "questionType": "boolean_",
  "isRequired": true
}

# Options cho Q3:
POST /api/options/3
{"optionText": "Có", "displayOrder": 1}
POST /api/options/3
{"optionText": "Không", "displayOrder": 2}

# Question 4: Ranking
POST /api/questions/1
{
  "questionText": "Xếp hạng các brand theo độ yêu thích",
  "questionType": "ranking",
  "isRequired": true
}

# Question 5: Date Time
POST /api/questions/1
{
  "questionText": "Ngày sinh của bạn",
  "questionType": "date_time",
  "isRequired": true
}

# Question 6: Open Ended
POST /api/questions/1
{
  "questionText": "Góp ý của bạn",
  "questionType": "open_ended",
  "isRequired": false
}

# Question 7: Rating
POST /api/questions/1
{
  "questionText": "Đánh giá dịch vụ (1-10)",
  "questionType": "rating", 
  "isRequired": true
}

# Question 8: File Upload
POST /api/questions/1
{
  "questionText": "Upload ảnh đại diện",
  "questionType": "file_upload",
  "isRequired": false
}

# Question 9: File Upload 2
POST /api/questions/1
{
  "questionText": "Upload giấy tờ tùy thân",
  "questionType": "file_upload",
  "isRequired": true
}
```

#### Submit Mixed Response:
```bash
POST /api/responses/with-files
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
surveyId: 1
answers: [{"questionId":1,"questionType":"multiple_choice","selectedOptionIds":[1,3,4]},{"questionId":2,"questionType":"single_choice","selectedOptionId":2},{"questionId":3,"questionType":"boolean_","selectedOptionId":1},{"questionId":4,"questionType":"ranking","rankingOrder":["Apple","Samsung","Xiaomi","Oppo"]},{"questionId":5,"questionType":"date_time","dateValue":"1990-05-15","timeValue":"08:30"},{"questionId":6,"questionType":"open_ended","answerText":"Dịch vụ rất tốt, nên cải thiện giao diện"},{"questionId":7,"questionType":"rating","answerText":"8"},{"questionId":8,"questionType":"file_upload","answerText":"Ảnh đại diện"},{"questionId":9,"questionType":"file_upload","answerText":"CMND mặt trước"}]
file_8: [avatar.jpg file]
file_9: [id_card.jpg file]
```

---

## 2. RAW CURL COMMANDS

### 2.1 Basic JSON Response
```bash
curl -X POST http://localhost:8080/api/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "surveyId": 1,
    "answers": [
      {
        "questionId": 1,
        "questionType": "multiple_choice",
        "selectedOptionIds": [1, 3]
      },
      {
        "questionId": 2,
        "questionType": "single_choice",
        "selectedOptionId": 2
      }
    ]
  }'
```

### 2.2 File Upload Response
```bash
curl -X POST http://localhost:8080/api/responses/with-files \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "surveyId=1" \
  -F 'answers=[{"questionId":1,"questionType":"open_ended","answerText":"Test"},{"questionId":2,"questionType":"file_upload","answerText":"My file"}]' \
  -F "file_2=@/path/to/document.pdf"
```

### 2.3 Mixed Content Response
```bash
curl -X POST http://localhost:8080/api/responses/with-files \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "surveyId=1" \
  -F 'answers=[
    {"questionId":1,"questionType":"multiple_choice","selectedOptionIds":[1,2]},
    {"questionId":2,"questionType":"boolean_","selectedOptionId":1},
    {"questionId":3,"questionType":"ranking","rankingOrder":["A","B","C"]},
    {"questionId":4,"questionType":"date_time","dateValue":"2025-10-27","timeValue":"14:30"},
    {"questionId":5,"questionType":"file_upload","answerText":"Document"}
  ]' \
  -F "file_5=@/path/to/file.pdf"
```

---

## 3. JAVASCRIPT/FETCH EXAMPLES

### 3.1 Simple JSON Submit
```javascript
const response = await fetch('/api/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    surveyId: 1,
    answers: [
      {
        questionId: 1,
        questionType: 'multiple_choice',
        selectedOptionIds: [1, 3]
      },
      {
        questionId: 2, 
        questionType: 'single_choice',
        selectedOptionId: 2
      },
      {
        questionId: 3,
        questionType: 'boolean_',
        selectedOptionId: 1
      },
      {
        questionId: 4,
        questionType: 'ranking',
        rankingOrder: ['Option A', 'Option B', 'Option C']
      },
      {
        questionId: 5,
        questionType: 'date_time',
        dateValue: '2025-10-27',
        timeValue: '14:30'
      },
      {
        questionId: 6,
        questionType: 'open_ended', 
        answerText: 'My answer text'
      },
      {
        questionId: 7,
        questionType: 'rating',
        answerText: '4'
      }
    ]
  })
});
```

### 3.2 File Upload Submit
```javascript
const formData = new FormData();
formData.append('surveyId', '1');

const answers = [
  {
    questionId: 1,
    questionType: 'open_ended',
    answerText: 'My description'
  },
  {
    questionId: 2,
    questionType: 'file_upload', 
    answerText: 'Document description'
  }
];

formData.append('answers', JSON.stringify(answers));
formData.append('file_2', fileInput.files[0]);

const response = await fetch('/api/responses/with-files', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### 3.3 Mixed Content Submit  
```javascript
const formData = new FormData();
formData.append('surveyId', '1');

const answers = [
  {
    questionId: 1,
    questionType: 'multiple_choice',
    selectedOptionIds: [1, 3, 5]
  },
  {
    questionId: 2,
    questionType: 'single_choice', 
    selectedOptionId: 2
  },
  {
    questionId: 3,
    questionType: 'boolean_',
    selectedOptionId: 1
  },
  {
    questionId: 4,
    questionType: 'ranking',
    rankingOrder: ['Brand A', 'Brand B', 'Brand C', 'Brand D']
  },
  {
    questionId: 5,
    questionType: 'date_time',
    dateValue: '1990-05-15',
    timeValue: '08:30'
  },
  {
    questionId: 6,
    questionType: 'open_ended',
    answerText: 'This is my feedback'
  },
  {
    questionId: 7,
    questionType: 'rating',
    answerText: '8'
  },
  {
    questionId: 8,
    questionType: 'file_upload',
    answerText: 'My avatar'
  },
  {
    questionId: 9,
    questionType: 'file_upload',
    answerText: 'ID document'
  }
];

formData.append('answers', JSON.stringify(answers));
formData.append('file_8', avatarFile);
formData.append('file_9', idDocumentFile);

const response = await fetch('/api/responses/with-files', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

---

## 4. EXPECTED RESPONSE FORMATS

### 4.1 Success Response (JSON only)
```json
{
  "responseId": 123,
  "surveyId": 1,
  "userId": 456,
  "requestToken": "anonymous_token_xyz",
  "submittedAt": "2025-10-27T14:30:00",
  "answers": [
    {
      "answerId": 1,
      "questionId": 1,
      "selectedOptionIds": [1, 3],
      "answerText": null,
      "createdAt": "2025-10-27T14:30:00",
      "questionText": "Sở thích của bạn?",
      "uploadedFiles": null
    },
    {
      "answerId": 2, 
      "questionId": 2,
      "optionId": 2,
      "answerText": null,
      "createdAt": "2025-10-27T14:30:00",
      "questionText": "Trình độ học vấn?",
      "uploadedFiles": null
    },
    {
      "answerId": 3,
      "questionId": 4,
      "rankingOptionIds": [2, 1, 3],
      "answerText": null,
      "createdAt": "2025-10-27T14:30:00",
      "questionText": "Xếp hạng sở thích?",
      "uploadedFiles": null
    }
  ]
}
```

### 4.2 Success Response (with files)
```json
{
  "responseId": 124,
  "surveyId": 1, 
  "userId": 456,
  "requestToken": "anonymous_token_xyz",
  "submittedAt": "2025-10-27T14:35:00",
  "answers": [
    {
      "answerId": 3,
      "questionId": 8,
      "answerText": "File uploaded successfully: avatar.jpg",
      "createdAt": "2025-10-27T14:35:00",
      "questionText": "Upload ảnh đại diện",
      "uploadedFiles": [
        {
          "fileId": 1,
          "originalFileName": "avatar.jpg",
          "fileName": "uuid_20251027_143500_avatar.jpg", 
          "fileType": "image/jpeg",
          "fileSize": 256000,
          "downloadUrl": "/api/files/download/1",
          "uploadedAt": "2025-10-27T14:35:00"
        }
      ]
    },
    {
      "answerId": 4,
      "questionId": 9,
      "answerText": "File uploaded successfully: id_card.jpg",
      "createdAt": "2025-10-27T14:35:00", 
      "questionText": "Upload giấy tờ tùy thân",
      "uploadedFiles": [
        {
          "fileId": 2,
          "originalFileName": "id_card.jpg",
          "fileName": "uuid_20251027_143500_id_card.jpg",
          "fileType": "image/jpeg", 
          "fileSize": 512000,
          "downloadUrl": "/api/files/download/2",
          "uploadedAt": "2025-10-27T14:35:00"
        }
      ]
    }
  ]
}
```

---

## 5. ERROR RESPONSES

### 5.1 Validation Error
```json
{
  "message": "Question ID 1 is required but no answer provided",
  "timestamp": "2025-10-27T14:30:00"
}
```

### 5.2 File Upload Error
```json
{
  "message": "File size exceeds maximum limit of 10MB",
  "timestamp": "2025-10-27T14:30:00"
}
```

### 5.3 Authentication Error
```json
{
  "message": "Invalid or expired token",
  "timestamp": "2025-10-27T14:30:00"
}
```

---

**Lưu ý cho Frontend Developer:**

1. **File Upload Keys**: Luôn dùng format `file_{questionId}` cho file upload fields
2. **JSON trong FormData**: Answers phải được stringify thành JSON string
3. **Mixed Content**: Bắt buộc dùng `/responses/with-files` endpoint nếu có ít nhất 1 file upload question
4. **Boolean Logic**: Treat boolean như single choice với 2 options cố định
5. **Ranking Format**: Use `rankingOptionIds` array với option IDs (recommended) hoặc `rankingOrder` array với text values (legacy)
6. **Date/Time Format**: Date dùng YYYY-MM-DD, Time dùng HH:mm
7. **File Info**: Response sẽ có `uploadedFiles` array với đầy đủ metadata để hiển thị