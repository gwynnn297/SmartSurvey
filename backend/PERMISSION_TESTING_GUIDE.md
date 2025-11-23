# 📘 Hướng dẫn Test Phân Quyền - SmartSurvey Backend

> **Tài liệu này dành cho Frontend Team** để test các tính năng phân quyền trong hệ thống SmartSurvey.

---

## 📋 Mục lục

1. [Tổng quan hệ thống phân quyền](#1-tổng-quan-hệ-thống-phân-quyền)
2. [Các khái niệm cơ bản](#2-các-khái-niệm-cơ-bản)
3. [Luồng test từng bước](#3-luồng-test-từng-bước)
4. [Ví dụ JSON Request/Response](#4-ví-dụ-json-requestresponse)
5. [Test Cases chi tiết](#5-test-cases-chi-tiết)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Tổng quan hệ thống phân quyền

### 1.1. Hai lớp phân quyền

Hệ thống SmartSurvey sử dụng **2 lớp phân quyền độc lập**:

#### **Lớp 1: Role hệ thống** (Lưu trong bảng `users`)
- `admin`: Quản trị viên hệ thống
- `creator`: Người tạo khảo sát  
- `respondent`: Người trả lời khảo sát

#### **Lớp 2: Permission trên Survey** (Lưu trong bảng `survey_permissions`)
- `OWNER`: Chủ sở hữu - Toàn quyền kiểm soát
- `EDITOR`: Biên tập viên - Chỉnh sửa khảo sát
- `ANALYST`: Phân tích viên - Chỉ xem kết quả và phân tích
- `VIEWER`: Người xem - Chỉ xem thông tin cơ bản

### 1.2. Quy tắc quan trọng

✅ **User tạo survey LUÔN có quyền OWNER** trên survey đó (không phụ thuộc vào role hệ thống)

✅ **Permission trên survey độc lập với role hệ thống** - Một user có thể có nhiều permission khác nhau trên các survey khác nhau

✅ **Có 2 cách share survey:**
- **Permission độc lập**: User có quyền bất kể ở team nào
- **Team-restricted**: User chỉ có quyền khi còn là member của team

---

## 2. Các khái niệm cơ bản

### 2.1. Bảng quyền hạn của từng Permission

| Permission | Xem Survey | Chỉnh sửa | Xóa Survey | Xem Kết quả | Quản lý Permissions |
|------------|:----------:|:---------:|:----------:|:-----------:|:-------------------:|
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **EDITOR** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **ANALYST** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **VIEWER** | ✅ | ❌ | ❌ | ❌ | ❌ |

### 2.2. Hai cách Share Survey

#### **Cách 1: Share với User (Permission độc lập)**

**Đặc điểm:**
- Share trực tiếp với user cụ thể
- Không có `restrictedTeamId` (hoặc `restrictedTeamId = null`)
- User có quyền **bất kể** họ ở team nào
- Giống như Google Form - share với email cụ thể

**Ví dụ JSON:**
```json
{
  "teamAccess": [
    {
      "userId": 2,
      "permission": "EDITOR"
      // Không có restrictedTeamId = permission độc lập
    }
  ]
}
```

#### **Cách 2: Share với Team (Team-restricted Permission)**

**Đặc điểm:**
- Share với user nhưng **ràng buộc với team**
- Có `restrictedTeamId` (ID của team)
- User chỉ có quyền khi **còn là member** của team đó
- Nếu user rời khỏi team → permission tự động mất

**Ví dụ JSON:**
```json
{
  "teamAccess": [
    {
      "userId": 2,
      "permission": "EDITOR",
      "restrictedTeamId": 1  // User chỉ có quyền khi còn trong team 1
    }
  ]
}
```

**So sánh:**

| Đặc điểm | Permission độc lập | Team-restricted |
|----------|-------------------|-----------------|
| `restrictedTeamId` | `null` | Có giá trị (team ID) |
| Quyền khi rời team | ✅ Vẫn giữ nguyên | ❌ Tự động mất |
| Use case | Share với cá nhân | Share với team, quản lý theo nhóm |

---

## 3. Luồng test từng bước

### 🎯 **LUỒNG TEST CHÍNH**

```
Bước 1: Tạo tài khoản test
   ↓
Bước 2: Đăng nhập và lấy token
   ↓
Bước 3: Tạo survey
   ↓
Bước 4: Share survey với các user khác
   ↓
Bước 5: Test với các tài khoản khác nhau
   ↓
Bước 6: Test Team và Team-restricted Permission (Tùy chọn)
```

---

### **Bước 1: Tạo các tài khoản test**

**Mục đích:** Tạo ít nhất 4-5 tài khoản để test các permission khác nhau

**Cách 1: Đăng ký qua API (Khuyên dùng)**

```bash
# Tài khoản 1: Owner (sẽ tạo survey)
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123",
    "fullName": "Owner User"
  }'

# Tài khoản 2: Editor (sẽ được share với quyền EDITOR)
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@test.com",
    "password": "password123",
    "fullName": "Editor User"
  }'

# Tài khoản 3: Analyst (sẽ được share với quyền ANALYST)
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@test.com",
    "password": "password123",
    "fullName": "Analyst User"
  }'

# Tài khoản 4: Viewer (sẽ được share với quyền VIEWER)
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "viewer@test.com",
    "password": "password123",
    "fullName": "Viewer User"
  }'

# Tài khoản 5: No Access (không được share - để test unauthorized)
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "noaccess@test.com",
    "password": "password123",
    "fullName": "No Access User"
  }'
```

**Lưu ý:** 
- Tất cả tài khoản đăng ký mặc định có role `creator`
- Lưu lại `userId` từ response của mỗi request (cần dùng khi share survey)

---

### **Bước 2: Đăng nhập và lấy token**

**Mục đích:** Lấy JWT token để sử dụng cho các request tiếp theo

```bash
# Đăng nhập với tài khoản Owner
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123"
  }'
```

**Response mẫu:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 1,
  "email": "owner@test.com",
  "fullName": "Owner User",
  "role": "creator",
  "isActive": true
}
```

**⚠️ QUAN TRỌNG:** 
- Lưu `token` từ response → đây là `TOKEN_OWNER`
- Token này cần gửi trong header `Authorization: Bearer {token}` cho mọi request tiếp theo
- Token có thời hạn (mặc định 24 giờ)

---

### **Bước 3: Tạo survey mới**

**Mục đích:** Tạo một survey để test phân quyền

```bash
curl -X POST http://localhost:8080/surveys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "title": "Test Survey for Permissions",
    "description": "Survey để test phân quyền",
    "categoryId": 1
  }'
```

**Response mẫu:**
```json
{
  "id": 1,
  "title": "Test Survey for Permissions",
  "description": "Survey để test phân quyền",
  "status": "draft",
  "userId": 1,
  "userName": "Owner User",
  "categoryId": 1,
  "numberOfQuestions": 0,
  "createdAt": "2025-01-15T10:00:00"
}
```

**⚠️ QUAN TRỌNG:**
- Lưu `id` từ response → đây là `surveyId` (ví dụ: `1`)
- User tạo survey (owner@test.com) tự động có quyền `OWNER` trên survey này

---

### **Bước 4: Share survey với các user khác**

**Mục đích:** Chia sẻ survey với các user khác và gán permission cho họ

#### **4.1. Lấy userId của các user cần share**

Trước khi share, cần biết `userId` của các user. Có 2 cách:

**Cách 1: Dùng email trong request (Backend sẽ tự tìm userId)**
```json
{
  "teamAccess": [
    {
      "email": "editor@test.com",  // Dùng email thay vì userId
      "permission": "EDITOR"
    }
  ]
}
```

**Cách 2: Dùng userId trực tiếp (nếu đã biết userId)**
```json
{
  "teamAccess": [
    {
      "userId": 2,  // userId của editor@test.com
      "permission": "EDITOR"
    }
  ]
}
```

#### **4.2. Share survey (Permission độc lập)**

**Request:**
```bash
curl -X PUT http://localhost:8080/surveys/1/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "teamAccess": [
      {
        "email": "editor@test.com",
        "permission": "EDITOR"
      },
      {
        "email": "analyst@test.com",
        "permission": "ANALYST"
      },
      {
        "email": "viewer@test.com",
        "permission": "VIEWER"
      }
    ]
  }'
```

**Giải thích:**
- `surveyId = 1` (survey vừa tạo ở Bước 3)
- Không có `restrictedTeamId` → Permission độc lập (user có quyền bất kể ở team nào)
- `permission`: Chọn một trong `EDITOR`, `ANALYST`, `VIEWER`

**Response mẫu:**
```json
{
  "surveyId": 1,
  "users": [
    {
      "userId": 2,
      "email": "editor@test.com",
      "fullName": "Editor User",
      "permission": "EDITOR",
      "grantedBy": 1,
      "grantedByName": "Owner User",
      "updatedAt": "2025-01-15T10:30:00",
      "restrictedTeamId": null,
      "restrictedTeamName": null
    },
    {
      "userId": 3,
      "email": "analyst@test.com",
      "fullName": "Analyst User",
      "permission": "ANALYST",
      "grantedBy": 1,
      "grantedByName": "Owner User",
      "updatedAt": "2025-01-15T10:30:00",
      "restrictedTeamId": null,
      "restrictedTeamName": null
    },
    {
      "userId": 4,
      "email": "viewer@test.com",
      "fullName": "Viewer User",
      "permission": "VIEWER",
      "grantedBy": 1,
      "grantedByName": "Owner User",
      "updatedAt": "2025-01-15T10:30:00",
      "restrictedTeamId": null,
      "restrictedTeamName": null
    }
  ],
  "warnings": []
}
```

**✅ Kết quả:**
- 3 user đã được share survey với các permission tương ứng
- Mỗi user sẽ nhận được notification về việc survey được share

---

### **Bước 5: Test với các tài khoản khác nhau**

**Mục đích:** Kiểm tra xem các user có permission đúng không

#### **5.1. Test với Editor (editor@test.com)**

**Đăng nhập:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@test.com",
    "password": "password123"
  }'
```

Lưu token → `TOKEN_EDITOR`

**Test các quyền:**

```bash
# ✅ Test 1: Xem survey (should work - EDITOR có quyền xem)
curl -X GET http://localhost:8080/surveys/1 \
  -H "Authorization: Bearer TOKEN_EDITOR"
# Expected: 200 OK

# ✅ Test 2: Chỉnh sửa survey (should work - EDITOR có quyền edit)
curl -X PUT http://localhost:8080/surveys/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_EDITOR" \
  -d '{
    "title": "Updated Title by Editor"
  }'
# Expected: 200 OK

# ❌ Test 3: Xem kết quả (should fail - EDITOR không có quyền xem results)
curl -X GET http://localhost:8080/api/surveys/1/results/overview \
  -H "Authorization: Bearer TOKEN_EDITOR"
# Expected: 403 Forbidden hoặc 400 Bad Request với message "Bạn không có quyền..."

# ❌ Test 4: Xóa survey (should fail - EDITOR không có quyền xóa)
curl -X DELETE http://localhost:8080/surveys/1 \
  -H "Authorization: Bearer TOKEN_EDITOR"
# Expected: 403 Forbidden hoặc 400 Bad Request
```

#### **5.2. Test với Analyst (analyst@test.com)**

**Đăng nhập:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@test.com",
    "password": "password123"
  }'
```

Lưu token → `TOKEN_ANALYST`

**Test các quyền:**

```bash
# ✅ Test 1: Xem survey (should work)
curl -X GET http://localhost:8080/surveys/1 \
  -H "Authorization: Bearer TOKEN_ANALYST"
# Expected: 200 OK

# ✅ Test 2: Xem kết quả (should work - ANALYST có quyền xem results)
curl -X GET http://localhost:8080/api/surveys/1/results/overview \
  -H "Authorization: Bearer TOKEN_ANALYST"
# Expected: 200 OK

# ❌ Test 3: Chỉnh sửa survey (should fail - ANALYST không có quyền edit)
curl -X PUT http://localhost:8080/surveys/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_ANALYST" \
  -d '{
    "title": "Updated Title"
  }'
# Expected: 403 Forbidden hoặc 400 Bad Request
```

#### **5.3. Test với Viewer (viewer@test.com)**

**Đăng nhập:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "viewer@test.com",
    "password": "password123"
  }'
```

Lưu token → `TOKEN_VIEWER`

**Test các quyền:**

```bash
# ✅ Test 1: Xem survey (should work)
curl -X GET http://localhost:8080/surveys/1 \
  -H "Authorization: Bearer TOKEN_VIEWER"
# Expected: 200 OK

# ❌ Test 2: Chỉnh sửa survey (should fail)
curl -X PUT http://localhost:8080/surveys/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_VIEWER" \
  -d '{
    "title": "Updated Title"
  }'
# Expected: 403 Forbidden

# ❌ Test 3: Xem kết quả (should fail)
curl -X GET http://localhost:8080/api/surveys/1/results/overview \
  -H "Authorization: Bearer TOKEN_VIEWER"
# Expected: 403 Forbidden
```

#### **5.4. Test với No Access (noaccess@test.com)**

**Đăng nhập:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "noaccess@test.com",
    "password": "password123"
  }'
```

Lưu token → `TOKEN_NOACCESS`

**Test các quyền:**

```bash
# ❌ Test 1: Xem survey (should fail - không có permission)
curl -X GET http://localhost:8080/surveys/1 \
  -H "Authorization: Bearer TOKEN_NOACCESS"
# Expected: 403 Forbidden hoặc 400 Bad Request
```

---

### **Bước 6: Test Team và Team-restricted Permission (Tùy chọn)**

**Mục đích:** Test tính năng share survey với team (ràng buộc với team)

#### **6.1. Tạo Team**

**Đăng nhập với Owner:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123"
  }'
```

Lưu token → `TOKEN_OWNER`

**Tạo team:**
```bash
curl -X POST http://localhost:8080/api/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "name": "Marketing Team",
    "description": "Team Marketing của công ty"
  }'
```

**Response:**
```json
{
  "teamId": 1,
  "name": "Marketing Team",
  "description": "Team Marketing của công ty",
  "ownerId": 1,
  "ownerName": "Owner User",
  "memberCount": 1,
  "createdAt": "2025-01-15T10:00:00"
}
```

Lưu `teamId` → `1`

#### **6.2. Gửi lời mời tham gia team**

```bash
# Gửi invitation cho editor@test.com
curl -X POST http://localhost:8080/api/teams/1/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "email": "editor@test.com"
  }'
```

#### **6.3. User chấp nhận invitation**

**Đăng nhập với Editor:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@test.com",
    "password": "password123"
  }'
```

Lưu token → `TOKEN_EDITOR`

**Xem danh sách invitations:**
```bash
curl -X GET http://localhost:8080/api/teams/invitations/me \
  -H "Authorization: Bearer TOKEN_EDITOR"
```

**Chấp nhận invitation:**
```bash
curl -X POST http://localhost:8080/api/teams/invitations/1/accept \
  -H "Authorization: Bearer TOKEN_EDITOR"
```

#### **6.4. Share survey với team (Team-restricted)**

**Đăng nhập lại với Owner:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123"
  }'
```

Lưu token → `TOKEN_OWNER`

**Share survey với restrictedTeamId:**
```bash
curl -X PUT http://localhost:8080/surveys/1/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "teamAccess": [
      {
        "userId": 2,
        "permission": "EDITOR",
        "restrictedTeamId": 1
      }
    ]
  }'
```

**Giải thích:**
- `userId: 2` = editor@test.com
- `restrictedTeamId: 1` = Marketing Team
- Editor chỉ có quyền EDITOR khi còn là member của team 1

**⚠️ Lưu ý:**
- User PHẢI là member của team trước khi share với `restrictedTeamId`
- Nếu user rời khỏi team, permission sẽ tự động mất
- Không thể chuyển từ permission độc lập sang team-restricted (phải xóa và tạo lại)

---

## 4. Ví dụ JSON Request/Response

### 4.1. Authentication

#### **Login Request**
```json
POST /auth/login
{
  "email": "owner@test.com",
  "password": "password123"
}
```

#### **Login Response**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 1,
  "email": "owner@test.com",
  "fullName": "Owner User",
  "role": "creator",
  "isActive": true
}
```

#### **Get Current User**
```json
GET /auth/me
Authorization: Bearer {token}

Response:
{
  "id": 1,
  "email": "owner@test.com",
  "fullName": "Owner User",
  "role": "creator",
  "isActive": true,
  "createdAt": "2025-01-15T10:00:00"
}
```

---

### 4.2. Survey

#### **Create Survey Request**
```json
POST /surveys
Authorization: Bearer {token}
{
  "title": "Test Survey for Permissions",
  "description": "Survey để test phân quyền",
  "categoryId": 1
}
```

#### **Create Survey Response**
```json
{
  "id": 1,
  "title": "Test Survey for Permissions",
  "description": "Survey để test phân quyền",
  "status": "draft",
  "userId": 1,
  "userName": "Owner User",
  "categoryId": 1,
  "categoryName": "Khảo sát khách hàng",
  "numberOfQuestions": 0,
  "createdAt": "2025-01-15T10:00:00",
  "updatedAt": "2025-01-15T10:00:00"
}
```

#### **Get Survey Detail Response**
```json
GET /surveys/1
Authorization: Bearer {token}

Response:
{
  "id": 1,
  "title": "Test Survey for Permissions",
  "description": "Survey để test phân quyền",
  "status": "draft",
  "userId": 1,
  "userName": "Owner User",
  "questions": [
    {
      "id": 1,
      "questionText": "Bạn có hài lòng với dịch vụ?",
      "questionType": "rating",
      "isRequired": true,
      "displayOrder": 1,
      "options": [...]
    }
  ],
  "createdAt": "2025-01-15T10:00:00"
}
```

#### **Update Survey Request**
```json
PUT /surveys/1
Authorization: Bearer {token}
{
  "title": "Updated Survey Title",
  "description": "Updated description",
  "status": "published"
}
```

---

### 4.3. Survey Permissions

#### **Share Survey Request (Permission độc lập)**
```json
PUT /surveys/1/permissions
Authorization: Bearer {token}
{
  "teamAccess": [
    {
      "email": "editor@test.com",
      "permission": "EDITOR"
    },
    {
      "userId": 3,
      "permission": "ANALYST"
    }
  ]
}
```

#### **Share Survey Request (Team-restricted)**
```json
PUT /surveys/1/permissions
Authorization: Bearer {token}
{
  "teamAccess": [
    {
      "userId": 2,
      "permission": "EDITOR",
      "restrictedTeamId": 1
    }
  ]
}
```

#### **Share Survey Response**
```json
{
  "surveyId": 1,
  "users": [
    {
      "userId": 2,
      "email": "editor@test.com",
      "fullName": "Editor User",
      "permission": "EDITOR",
      "grantedBy": 1,
      "grantedByName": "Owner User",
      "updatedAt": "2025-01-15T10:30:00",
      "restrictedTeamId": null,
      "restrictedTeamName": null
    }
  ],
  "warnings": []
}
```

#### **Get Survey Permissions Response**
```json
GET /surveys/1/permissions
Authorization: Bearer {token}

Response:
{
  "surveyId": 1,
  "users": [
    {
      "userId": 2,
      "email": "editor@test.com",
      "fullName": "Editor User",
      "permission": "EDITOR",
      "grantedBy": 1,
      "grantedByName": "Owner User",
      "updatedAt": "2025-01-15T10:30:00",
      "restrictedTeamId": null,
      "restrictedTeamName": null
    }
  ],
  "warnings": []
}
```

---

### 4.4. Team

#### **Create Team Request**
```json
POST /api/teams
Authorization: Bearer {token}
{
  "name": "Marketing Team",
  "description": "Team Marketing của công ty"
}
```

#### **Create Team Response**
```json
{
  "teamId": 1,
  "name": "Marketing Team",
  "description": "Team Marketing của công ty",
  "ownerId": 1,
  "ownerName": "Owner User",
  "memberCount": 1,
  "createdAt": "2025-01-15T10:00:00"
}
```

#### **Send Team Invitation Request**
```json
POST /api/teams/1/invitations
Authorization: Bearer {token}
{
  "email": "editor@test.com"
}
```

#### **Get Team Members Response**
```json
GET /api/teams/1/members
Authorization: Bearer {token}

Response:
[
  {
    "memberId": 1,
    "userId": 1,
    "email": "owner@test.com",
    "fullName": "Owner User",
    "role": "OWNER",
    "joinedAt": "2025-01-15T10:00:00"
  },
  {
    "memberId": 2,
    "userId": 2,
    "email": "editor@test.com",
    "fullName": "Editor User",
    "role": "MEMBER",
    "joinedAt": "2025-01-15T10:30:00"
  }
]
```

---

### 4.5. Dashboard

#### **Get Dashboard Overview Response**
```json
GET /dashboard/overview
Authorization: Bearer {token}

Response:
{
  "ownedSurveys": 5,
  "sharedSurveys": 3,
  "totalSurveys": 8,
  "activeSurveys": 2,
  "totalResponses": 150,
  "totalTeams": 2,
  "sharedSurveysDetail": [
    {
      "surveyId": 10,
      "title": "Shared Survey 1",
      "permission": "EDITOR",
      "sharedVia": "user"
    }
  ],
  "recentActivity": [
    {
      "actionType": "create_survey",
      "description": "Tạo khảo sát mới: Test Survey",
      "targetId": 1,
      "targetTable": "surveys",
      "createdAt": "2025-01-15T10:00:00"
    }
  ]
}
```

---

### 4.6. Notifications

#### **Get Notifications Response**
```json
GET /api/notifications
Authorization: Bearer {token}

Response:
[
  {
    "notificationId": 1,
    "type": "SURVEY_SHARED",
    "title": "Survey được chia sẻ với bạn",
    "message": "Owner User đã chia sẻ survey \"Test Survey\" với bạn với quyền EDITOR.",
    "relatedEntityType": "surveys",
    "relatedEntityId": 1,
    "isRead": false,
    "createdAt": "2025-01-15T10:30:00"
  }
]
```

#### **Get Unread Count**
```json
GET /api/notifications/unread/count
Authorization: Bearer {token}

Response:
5
```

---

### 4.7. Error Responses

#### **401 Unauthorized**
```json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "JWT token không hợp lệ hoặc đã hết hạn",
  "path": "/surveys/1"
}
```

#### **403 Forbidden (Permission Error)**
```json
{
  "status": 403,
  "error": "Forbidden",
  "message": "Bạn không có quyền chỉnh sửa survey này",
  "path": "/surveys/1"
}
```

#### **404 Not Found**
```json
{
  "status": 404,
  "error": "Not Found",
  "message": "Không tìm thấy khảo sát",
  "path": "/surveys/999"
}
```

---

## 5. Test Cases chi tiết

### Test Case 1: OWNER - Toàn quyền

**User:** owner@test.com  
**Permission:** OWNER (tự động vì là người tạo survey)

| Action | Endpoint | Expected Result |
|--------|----------|----------------|
| Xem survey | `GET /surveys/{id}` | ✅ 200 OK |
| Chỉnh sửa survey | `PUT /surveys/{id}` | ✅ 200 OK |
| Xóa survey | `DELETE /surveys/{id}` | ✅ 200 OK |
| Xem kết quả | `GET /api/surveys/{id}/results/overview` | ✅ 200 OK |
| Quản lý permissions | `GET /surveys/{id}/permissions` | ✅ 200 OK |
| Share survey | `PUT /surveys/{id}/permissions` | ✅ 200 OK |

---

### Test Case 2: EDITOR - Chỉnh sửa

**User:** editor@test.com  
**Permission:** EDITOR

| Action | Endpoint | Expected Result |
|--------|----------|----------------|
| Xem survey | `GET /surveys/{id}` | ✅ 200 OK |
| Chỉnh sửa survey | `PUT /surveys/{id}` | ✅ 200 OK |
| Thêm question | `POST /questions` | ✅ 200 OK |
| Xóa survey | `DELETE /surveys/{id}` | ❌ 403/400 Forbidden |
| Xem kết quả | `GET /api/surveys/{id}/results/overview` | ❌ 403/400 Forbidden |
| Quản lý permissions | `GET /surveys/{id}/permissions` | ❌ 403/400 Forbidden |

---

### Test Case 3: ANALYST - Xem kết quả

**User:** analyst@test.com  
**Permission:** ANALYST

| Action | Endpoint | Expected Result |
|--------|----------|----------------|
| Xem survey | `GET /surveys/{id}` | ✅ 200 OK |
| Chỉnh sửa survey | `PUT /surveys/{id}` | ❌ 403/400 Forbidden |
| Xem kết quả | `GET /api/surveys/{id}/results/overview` | ✅ 200 OK |
| Xem charts | `GET /api/surveys/{id}/results/charts` | ✅ 200 OK |
| Xem sentiment | `GET /api/surveys/{id}/results/sentiment` | ✅ 200 OK |
| Xóa survey | `DELETE /surveys/{id}` | ❌ 403/400 Forbidden |

---

### Test Case 4: VIEWER - Chỉ xem

**User:** viewer@test.com  
**Permission:** VIEWER

| Action | Endpoint | Expected Result |
|--------|----------|----------------|
| Xem survey | `GET /surveys/{id}` | ✅ 200 OK |
| Chỉnh sửa survey | `PUT /surveys/{id}` | ❌ 403/400 Forbidden |
| Xem kết quả | `GET /api/surveys/{id}/results/overview` | ❌ 403/400 Forbidden |
| Xóa survey | `DELETE /surveys/{id}` | ❌ 403/400 Forbidden |

---

### Test Case 5: No Permission - Không có quyền

**User:** noaccess@test.com  
**Permission:** null (không có permission)

| Action | Endpoint | Expected Result |
|--------|----------|----------------|
| Xem survey | `GET /surveys/{id}` | ❌ 403/400 Forbidden |
| Chỉnh sửa survey | `PUT /surveys/{id}` | ❌ 403/400 Forbidden |
| Xem kết quả | `GET /api/surveys/{id}/results/overview` | ❌ 403/400 Forbidden |

---

### Test Case 6: Public Endpoints - Không cần authentication

| Action | Endpoint | Expected Result |
|--------|----------|----------------|
| Xem survey public | `GET /surveys/{id}/public` | ✅ 200 OK (không cần token) |
| Check status | `GET /surveys/{id}/status` | ✅ 200 OK (không cần token) |
| Submit response | `POST /responses` | ✅ 200 OK (không cần token) |

---

### Test Case 7: Team-restricted Permission

**Scenario:** Share survey với user trong team (có `restrictedTeamId`)

**Setup:**
1. Tạo team "Marketing Team"
2. Thêm `editor@test.com` vào team
3. Share survey với `editor@test.com` với `restrictedTeamId` = teamId

**User:** editor@test.com (member của team)  
**Permission:** EDITOR (team-restricted)

| Action | Endpoint | Expected Result |
|--------|----------|----------------|
| Xem survey (khi còn trong team) | `GET /surveys/{id}` | ✅ 200 OK |
| Chỉnh sửa survey (khi còn trong team) | `PUT /surveys/{id}` | ✅ 200 OK |
| Xem survey (sau khi rời team) | `GET /surveys/{id}` | ❌ 403/400 Forbidden |
| Chỉnh sửa survey (sau khi rời team) | `PUT /surveys/{id}` | ❌ 403/400 Forbidden |

**Lưu ý:** Khi user rời khỏi team, permission team-restricted sẽ tự động mất.

---

## 6. Troubleshooting

### Lỗi 401 Unauthorized

**Nguyên nhân:**
- Token không hợp lệ hoặc đã hết hạn
- Không gửi token trong header

**Giải pháp:**
```bash
# Kiểm tra token
curl -X GET http://localhost:8080/auth/test-token \
  -H "Authorization: Bearer YOUR_TOKEN"

# Đăng nhập lại để lấy token mới
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@test.com", "password": "password123"}'
```

---

### Lỗi 403 Forbidden / 400 Bad Request với message "Bạn không có quyền..."

**Nguyên nhân:**
- User không có permission cần thiết cho action đó
- Permission chưa được share đúng cách

**Giải pháp:**
1. Kiểm tra permission của user:
```bash
# Lấy thông tin survey (sẽ trả về permission nếu có)
curl -X GET http://localhost:8080/surveys/{id} \
  -H "Authorization: Bearer TOKEN"
```

2. Kiểm tra trong database:
```sql
-- Xem permissions của survey
SELECT sp.*, u.email, u.full_name 
FROM survey_permissions sp
JOIN users u ON sp.user_id = u.user_id
WHERE sp.survey_id = {surveyId};

-- Xem owner của survey
SELECT s.survey_id, s.title, u.email as owner_email
FROM surveys s
JOIN users u ON s.user_id = u.user_id
WHERE s.survey_id = {surveyId};
```

---

### User không thấy survey trong danh sách

**Nguyên nhân:**
- User không phải owner và cũng không được share permission
- Permission đã bị xóa

**Giải pháp:**
- Owner cần share survey với user đó
- Kiểm tra trong database xem permission có tồn tại không

---

### Permission không hoạt động sau khi share

**Nguyên nhân:**
- Token cũ, cần đăng nhập lại
- Permission chưa được lưu đúng

**Giải pháp:**
1. Đăng nhập lại để refresh token
2. Kiểm tra permission trong database
3. Kiểm tra log backend để xem lỗi chi tiết

---

## 💡 Tips cho Frontend

1. **Lưu token vào localStorage/sessionStorage** sau khi đăng nhập
2. **Gửi token trong header** mọi request: `Authorization: Bearer {token}`
3. **Xử lý 401**: Redirect về trang login khi token hết hạn
4. **Xử lý 403**: Hiển thị message "Bạn không có quyền thực hiện hành động này"
5. **Kiểm tra permission trước khi hiển thị UI**: 
   - Ẩn nút "Xóa" nếu không phải OWNER
   - Ẩn tab "Kết quả" nếu không phải ANALYST hoặc OWNER
   - Ẩn nút "Chia sẻ" nếu không phải OWNER
6. **Test với nhiều tài khoản** để đảm bảo permission hoạt động đúng

---

**Chúc bạn test thành công! 🎉**




