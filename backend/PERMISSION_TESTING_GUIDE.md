# Hướng dẫn Test Phân Quyền Backend

Tài liệu này giúp Frontend team dễ dàng test các tính năng phân quyền trong hệ thống SmartSurvey.

## 📋 Mục lục

---

## 🔐 Tổng quan hệ thống phân quyền

Hệ thống SmartSurvey sử dụng **2 lớp phân quyền**:

### 1. **Role hệ thống (RoleEnum)** - Lưu trong bảng `users`
- `admin`: Quản trị viên hệ thống
- `creator`: Người tạo khảo sát
- `respondent`: Người trả lời khảo sát

### 2. **Permission trên Survey (SurveyPermissionRole)** - Lưu trong bảng `survey_permissions`
- `OWNER`: Chủ sở hữu - Toàn quyền kiểm soát
- `EDITOR`: Biên tập viên - Chỉnh sửa khảo sát
- `ANALYST`: Phân tích viên - Chỉ xem kết quả và phân tích
- `VIEWER`: Người xem - Chỉ xem thông tin cơ bản

**Lưu ý quan trọng:**
- User tạo survey (survey.user_id = user.user_id) **LUÔN** có quyền `OWNER` trên survey đó, không phụ thuộc vào role hệ thống
- Permission trên survey được quản lý độc lập với role hệ thống
- Một user có thể có nhiều permission khác nhau trên các survey khác nhau

### 3. **Hai cách Share Survey:**

#### a) **Share với User (Permission độc lập)**
- Share trực tiếp với user cụ thể
- Không có `restrictedTeamId` (hoặc `restrictedTeamId = null`)
- User có quyền **bất kể** họ ở team nào
- Giống như Google Form - share với email cụ thể

**Ví dụ:**
```json
{
  "teamAccess": [
    {
      "userId": 123,
      "permission": "EDITOR"
      // Không có restrictedTeamId = permission độc lập
    }
  ]
}
```

#### b) **Share với Team (Team-restricted Permission)**
- Share với user nhưng **ràng buộc với team**
- Có `restrictedTeamId` (ID của team)
- User chỉ có quyền khi **còn là member** của team đó
- Nếu user rời khỏi team → permission tự động mất
- Hữu ích khi muốn quản lý quyền theo team

**Ví dụ:**
```json
{
  "teamAccess": [
    {
      "userId": 123,
      "permission": "EDITOR",
      "restrictedTeamId": 456  // User chỉ có quyền khi còn trong team 456
    }
  ]
}
```



## 🎭 Các loại Role và Permission


### Permission trên Survey (SurveyPermissionRole)

| Permission | Mô tả | Quyền hạn |
|------------|-------|-----------|
| `OWNER` | Chủ sở hữu | - Xem survey<br>- Chỉnh sửa survey<br>- Xóa survey<br>- Xem kết quả<br>- Quản lý permissions (share survey) |
| `EDITOR` | Biên tập viên | - Xem survey<br>- Chỉnh sửa survey<br>- ❌ Không xóa survey<br>- ❌ Không xem kết quả<br>- ❌ Không quản lý permissions |
| `ANALYST` | Phân tích viên | - Xem survey<br>- ❌ Không chỉnh sửa survey<br>- Xem kết quả và phân tích<br>- ❌ Không quản lý permissions |
| `VIEWER` | Người xem | - Xem survey (thông tin cơ bản)<br>- ❌ Không chỉnh sửa<br>- ❌ Không xem kết quả<br>- ❌ Không quản lý permissions |

---

## 🔌 Các Endpoint và Yêu cầu Permission


### Survey Endpoints

| Endpoint | Method | Yêu cầu | Permission cần thiết |
|----------|--------|---------|---------------------|
| `/surveys` | GET | Authenticated | - Xem danh sách survey của mình (owned + shared) |
| `/surveys` | POST | Authenticated | - Tạo survey mới (bất kỳ user nào đã đăng nhập) |
| `/surveys/{id}` | GET | Authenticated | - `VIEWER`, `EDITOR`, `ANALYST`, `OWNER` |
| `/surveys/{id}` | PUT | Authenticated | - `EDITOR` hoặc `OWNER` |
| `/surveys/{id}` | DELETE | Authenticated | - Chỉ `OWNER` |
| `/surveys/{id}/public` | GET | Public | - Không cần authentication (để trả lời survey) |
| `/surveys/{id}/status` | GET | Public | - Không cần authentication |
| `/surveys/{id}/permissions` | GET | Authenticated | - Chỉ `OWNER` |
| `/surveys/{id}/permissions` | PUT | Authenticated | - Chỉ `OWNER` |
| `/surveys/{id}/permissions/{permissionId}` | DELETE | Authenticated | - Chỉ `OWNER` |

### Question & Option Endpoints

| Endpoint | Method | Yêu cầu | Permission cần thiết |
|----------|--------|---------|---------------------|
| `/questions` | POST | Authenticated | - `EDITOR` hoặc `OWNER` |
| `/questions/{id}` | GET | Authenticated | - `VIEWER`, `EDITOR`, `ANALYST`, `OWNER` |
| `/questions/{id}` | PUT | Authenticated | - `EDITOR` hoặc `OWNER` |
| `/questions/{id}` | DELETE | Authenticated | - `EDITOR` hoặc `OWNER` |
| `/options` | POST | Authenticated | - `EDITOR` hoặc `OWNER` |
| `/options/{id}` | GET | Authenticated | - `VIEWER`, `EDITOR`, `ANALYST`, `OWNER` |
| `/options/{id}` | PUT | Authenticated | - `EDITOR` hoặc `OWNER` |
| `/options/{id}` | DELETE | Authenticated | - `EDITOR` hoặc `OWNER` |

### Response Endpoints

| Endpoint | Method | Yêu cầu | Permission cần thiết |
|----------|--------|---------|---------------------|
| `/responses` | POST | Public | - Không cần authentication (submit response) |
| `/responses/with-files` | POST | Public | - Không cần authentication (submit với files) |
| `/api/responses` | GET | Authenticated | - `ANALYST` hoặc `OWNER` (xem responses) |
| `/api/responses/{id}` | GET | Authenticated | - `ANALYST` hoặc `OWNER` |

### Statistics Endpoints

| Endpoint | Method | Yêu cầu | Permission cần thiết |
|----------|--------|---------|---------------------|
| `/api/surveys/{surveyId}/results/overview` | GET | Authenticated | - `ANALYST` hoặc `OWNER` |
| `/api/surveys/{surveyId}/results/timeline` | GET | Authenticated | - `ANALYST` hoặc `OWNER` |
| `/api/surveys/{surveyId}/results/charts` | GET | Authenticated | - `ANALYST` hoặc `OWNER` |
| `/api/surveys/{surveyId}/results/text-analysis` | GET | Authenticated | - `ANALYST` hoặc `OWNER` |
| `/api/surveys/{surveyId}/results/sentiment` | GET | Authenticated | - `ANALYST` hoặc `OWNER` |

### Dashboard Endpoints

| Endpoint | Method | Yêu cầu | Permission cần thiết |
|----------|--------|---------|---------------------|
| `/dashboard/overview` | GET | Authenticated | - Xem dashboard tổng quan của mình (owned surveys, shared surveys, teams, total responses) |

**Lưu ý:** Dashboard chỉ hiển thị thông tin của user hiện tại, bao gồm:
- Surveys mà user sở hữu
- Surveys được share với user (có permission)
- Teams mà user là owner hoặc member
- Tổng số responses của các surveys user có quyền xem

### Team Endpoints

| Endpoint | Method | Yêu cầu | Permission cần thiết |
|----------|--------|---------|---------------------|
| `/api/teams` | GET | Authenticated | - Xem danh sách teams của mình |
| `/api/teams` | POST | Authenticated | - Tạo team mới |
| `/api/teams/{teamId}` | GET | Authenticated | - Xem thông tin team |
| `/api/teams/{teamId}` | PUT | Authenticated | - Chỉ OWNER của team |
| `/api/teams/{teamId}/members` | GET | Authenticated | - OWNER hoặc MEMBER của team |
| `/api/teams/{teamId}/invitations` | POST | Authenticated | - Chỉ OWNER của team |
| `/api/teams/{teamId}/invitations` | GET | Authenticated | - Chỉ OWNER của team |
| `/api/teams/invitations/me` | GET | Authenticated | - Xem invitations của mình |
| `/api/teams/invitations/{invitationId}/accept` | POST | Authenticated | - Chấp nhận invitation |
| `/api/teams/invitations/{invitationId}/reject` | POST | Authenticated | - Từ chối invitation |
| `/api/teams/{teamId}/members/{memberId}` | DELETE | Authenticated | - Chỉ OWNER của team |
| `/api/teams/{teamId}/surveys` | GET | Authenticated | - OWNER hoặc MEMBER của team |

**Lưu ý về Team Endpoints:**
- Chỉ OWNER của team mới có quyền: cập nhật team, gửi invitation, xóa member
- OWNER và MEMBER đều có thể: xem thông tin team, xem members, xem surveys được share với team
- User có thể xem danh sách invitations của mình và chấp nhận/từ chối

### Notification Endpoints

| Endpoint | Method | Yêu cầu | Permission cần thiết |
|----------|--------|---------|---------------------|
| `/api/notifications` | GET | Authenticated | - Xem tất cả notifications của mình |
| `/api/notifications/unread` | GET | Authenticated | - Xem notifications chưa đọc |
| `/api/notifications/unread/count` | GET | Authenticated | - Đếm số notifications chưa đọc |
| `/api/notifications/{notificationId}/read` | PUT | Authenticated | - Đánh dấu notification là đã đọc (chỉ notification của mình) |
| `/api/notifications/read-all` | PUT | Authenticated | - Đánh dấu tất cả notifications là đã đọc |

**Lưu ý về Notification:**
- User chỉ có thể xem và quản lý notifications của chính mình
- Notifications được tạo tự động khi:
  - Survey được share với user
  - Permission của user trên survey thay đổi
  - Permission bị xóa
  - Có các hoạt động liên quan đến user

---

## 🧪 Hướng dẫn Test

### Bước 1: Tạo các tài khoản test

Tạo ít nhất 3-4 tài khoản với các role khác nhau:

```sql
-- Tài khoản 1: Creator (sẽ là OWNER của survey)


-- Tài khoản 2: Creator (sẽ được share với quyền EDITOR)

-- Tài khoản 3: Creator (sẽ được share với quyền ANALYST)


-- Tài khoản 4: Creator (sẽ được share với quyền VIEWER)

```

**Hoặc đăng ký qua API:**

```bash
# Tạo tài khoản Owner
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123",
    "fullName": "Owner User"
  }'

# Tạo tài khoản Editor
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@test.com",
    "password": "password123",
    "fullName": "Editor User"
  }'

# Tạo tài khoản Analyst
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@test.com",
    "password": "password123",
    "fullName": "Analyst User"
  }'

# Tạo tài khoản Viewer
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "viewer@test.com",
    "password": "password123",
    "fullName": "Viewer User"
  }'
```

### Bước 2: Tạo Survey và Share Permissions

1. **Đăng nhập với tài khoản Owner:**

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123"
  }'
```

Lưu token từ response: `TOKEN_OWNER`

2. **Tạo survey mới:**

```bash
curl -X POST http://localhost:8080/surveys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "title": "Test Survey for Permissions",
    "description": "Survey để test phân quyền"
  }'
```

Lưu `surveyId` từ response

3. **Share survey với các user khác (Permission độc lập - không ràng buộc team):**

```bash
curl -X PUT http://localhost:8080/surveys/{surveyId}/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "teamAccess": [
      {
        "userId": <editor_user_id>,
        "permission": "EDITOR"
      },
      {
        "userId": <analyst_user_id>,
        "permission": "ANALYST"
      },
      {
        "userId": <viewer_user_id>,
        "permission": "VIEWER"
      }
    ]
  }'
```

**Lưu ý:** Khi không có `restrictedTeamId`, permission là độc lập (giống Google Form) - user có quyền bất kể họ ở team nào.

### Bước 2b: Share Survey với Team (Team-restricted Permission)

**Team-restricted permission:** User chỉ có quyền khi còn là member của team được chỉ định. Nếu user rời khỏi team, quyền sẽ tự động mất.

1. **Tạo Team:**

```bash
# Đăng nhập với tài khoản Owner
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123"
  }'
```

Lưu token: `TOKEN_OWNER`

```bash
# Tạo team mới
curl -X POST http://localhost:8080/api/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "name": "Marketing Team",
    "description": "Team Marketing của công ty"
  }'
```

Lưu `teamId` từ response

2. **Thêm members vào team:**

```bash
# Gửi lời mời tham gia team
curl -X POST http://localhost:8080/api/teams/{teamId}/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "email": "editor@test.com"
  }'

# Gửi lời mời cho user khác
curl -X POST http://localhost:8080/api/teams/{teamId}/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "email": "analyst@test.com"
  }'
```

3. **User chấp nhận lời mời:**

```bash
# Đăng nhập với editor@test.com
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@test.com",
    "password": "password123"
  }'
```

Lưu token: `TOKEN_EDITOR`

```bash
# Xem danh sách invitations
curl -X GET http://localhost:8080/api/teams/invitations/me \
  -H "Authorization: Bearer TOKEN_EDITOR"

# Chấp nhận invitation (lấy invitationId từ response trên)
curl -X POST http://localhost:8080/api/teams/invitations/{invitationId}/accept \
  -H "Authorization: Bearer TOKEN_EDITOR"
```

4. **Share survey với team (Team-restricted):**

```bash
# Đăng nhập lại với Owner
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123"
  }'
```

Lưu token: `TOKEN_OWNER`

```bash
# Share survey với user trong team (có restrictedTeamId)
curl -X PUT http://localhost:8080/surveys/{surveyId}/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_OWNER" \
  -d '{
    "teamAccess": [
      {
        "userId": <editor_user_id>,
        "permission": "EDITOR",
        "restrictedTeamId": <teamId>
      },
      {
        "userId": <analyst_user_id>,
        "permission": "ANALYST",
        "restrictedTeamId": <teamId>
      }
    ]
  }'
```

**Lưu ý quan trọng:**
- Khi share với `restrictedTeamId`, user **PHẢI** là member của team đó
- Nếu user rời khỏi team, permission sẽ tự động mất
- Không thể chuyển từ permission độc lập sang team-restricted (và ngược lại) - phải xóa và tạo lại

### Bước 3: Test với các tài khoản khác nhau

Đăng nhập với từng tài khoản và test các endpoint:

```bash
# Đăng nhập với Editor
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@test.com",
    "password": "password123"
  }'
```

Lưu token: `TOKEN_EDITOR`

```bash
# Test xem survey (should work - EDITOR có quyền xem)
curl -X GET http://localhost:8080/surveys/{surveyId} \
  -H "Authorization: Bearer TOKEN_EDITOR"

# Test chỉnh sửa survey (should work - EDITOR có quyền edit)
curl -X PUT http://localhost:8080/surveys/{surveyId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_EDITOR" \
  -d '{
    "title": "Updated Title"
  }'

# Test xem kết quả (should fail - EDITOR không có quyền xem results)
curl -X GET http://localhost:8080/api/surveys/{surveyId}/results/overview \
  -H "Authorization: Bearer TOKEN_EDITOR"

# Test xóa survey (should fail - EDITOR không có quyền xóa)
curl -X DELETE http://localhost:8080/surveys/{surveyId} \
  -H "Authorization: Bearer TOKEN_EDITOR"
```

---

## 📄 Ví dụ JSON Request/Response

### 1. Authentication

#### Login Request
```json
POST /auth/login
{
  "email": "owner@test.com",
  "password": "password123"
}
```

#### Login Response
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

#### Get Current User Response
```json
GET /auth/me
{
  "id": 1,
  "email": "owner@test.com",
  "fullName": "Owner User",
  "role": "creator",
  "isActive": true,
  "createdAt": "2025-01-15T10:00:00"
}
```

### 2. Survey

#### Create Survey Request
```json
POST /surveys
{
  "title": "Test Survey for Permissions",
  "description": "Survey để test phân quyền",
  "categoryId": 1,
  "aiPrompt": "Tạo khảo sát về mức độ hài lòng"
}
```

#### Create Survey Response
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

#### Get Survey Detail Response
```json
GET /surveys/1
{
  "id": 1,
  "title": "Test Survey for Permissions",
  "description": "Survey để test phân quyền",
  "status": "draft",
  "userId": 1,
  "userName": "Owner User",
  "categoryId": 1,
  "categoryName": "Khảo sát khách hàng",
  "questions": [
    {
      "id": 1,
      "questionText": "Bạn có hài lòng với dịch vụ?",
      "questionType": "rating",
      "isRequired": true,
      "displayOrder": 1,
      "options": [
        {
          "id": 1,
          "text": "1"
        },
        {
          "id": 2,
          "text": "2"
        }
      ]
    }
  ],
  "createdAt": "2025-01-15T10:00:00",
  "updatedAt": "2025-01-15T10:00:00"
}
```

#### Update Survey Request
```json
PUT /surveys/1
{
  "title": "Updated Survey Title",
  "description": "Updated description",
  "status": "published"
}
```

#### Update Survey Response
```json
{
  "id": 1,
  "title": "Updated Survey Title",
  "description": "Updated description",
  "status": "published",
  "userId": 1,
  "userName": "Owner User",
  "updatedAt": "2025-01-15T11:00:00"
}
```

### 3. Survey Permissions

#### Share Survey Request (Permission độc lập)
```json
PUT /surveys/1/permissions
{
  "teamAccess": [
    {
      "userId": 2,
      "permission": "EDITOR"
    },
    {
      "email": "analyst@test.com",
      "permission": "ANALYST"
    },
    {
      "userId": 4,
      "permission": "VIEWER"
    }
  ]
}
```

#### Share Survey Request (Team-restricted)
```json
PUT /surveys/1/permissions
{
  "teamAccess": [
    {
      "userId": 2,
      "permission": "EDITOR",
      "restrictedTeamId": 1
    },
    {
      "userId": 3,
      "permission": "ANALYST",
      "restrictedTeamId": 1
    }
  ]
}
```

#### Share Survey Response
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
      "restrictedTeamId": 1,
      "restrictedTeamName": "Marketing Team"
    }
  ],
  "warnings": []
}
```

#### Get Survey Permissions Response
```json
GET /surveys/1/permissions
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

### 4. Team

#### Create Team Request
```json
POST /api/teams
{
  "name": "Marketing Team",
  "description": "Team Marketing của công ty"
}
```

#### Create Team Response
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

#### Get Team Response
```json
GET /api/teams/1
{
  "teamId": 1,
  "name": "Marketing Team",
  "description": "Team Marketing của công ty",
  "ownerId": 1,
  "ownerName": "Owner User",
  "memberCount": 2,
  "createdAt": "2025-01-15T10:00:00"
}
```

#### Send Team Invitation Request
```json
POST /api/teams/1/invitations
{
  "email": "editor@test.com"
}
```

#### Send Team Invitation Response
```json
{
  "invitationId": 1,
  "teamId": 1,
  "teamName": "Marketing Team",
  "invitedUserId": 2,
  "invitedUserEmail": "editor@test.com",
  "invitedBy": 1,
  "invitedByName": "Owner User",
  "status": "pending",
  "createdAt": "2025-01-15T10:00:00"
}
```

#### Get Team Members Response
```json
GET /api/teams/1/members
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

#### Get My Invitations Response
```json
GET /api/teams/invitations/me
[
  {
    "invitationId": 1,
    "teamId": 1,
    "teamName": "Marketing Team",
    "invitedUserId": 2,
    "invitedUserEmail": "editor@test.com",
    "invitedBy": 1,
    "invitedByName": "Owner User",
    "status": "pending",
    "createdAt": "2025-01-15T10:00:00"
  }
]
```

### 5. Dashboard

#### Get Dashboard Overview Response
```json
GET /dashboard/overview
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
    },
    {
      "surveyId": 11,
      "title": "Shared Survey 2",
      "permission": "ANALYST",
      "sharedVia": "team"
    }
  ],
  "recentActivity": [
    {
      "actionType": "create_survey",
      "description": "Tạo khảo sát mới: Test Survey",
      "targetId": 1,
      "targetTable": "surveys",
      "createdAt": "2025-01-15T10:00:00"
    },
    {
      "actionType": "update_survey",
      "description": "Cập nhật khảo sát: Test Survey",
      "targetId": 1,
      "targetTable": "surveys",
      "createdAt": "2025-01-15T09:30:00"
    }
  ]
}
```

### 6. Notifications

#### Get Notifications Response
```json
GET /api/notifications
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
  },
  {
    "notificationId": 2,
    "type": "SURVEY_PERMISSION_CHANGED",
    "title": "Quyền truy cập survey đã thay đổi",
    "message": "Owner User đã thay đổi quyền của bạn trên survey \"Test Survey\" từ EDITOR sang ANALYST.",
    "relatedEntityType": "surveys",
    "relatedEntityId": 1,
    "isRead": false,
    "createdAt": "2025-01-15T11:00:00"
  }
]
```

#### Get Unread Notifications Response
```json
GET /api/notifications/unread
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

#### Get Unread Count Response
```json
GET /api/notifications/unread/count
5
```

### 7. Statistics

#### Get Survey Overview Response
```json
GET /api/surveys/1/results/overview
{
  "surveyId": 1,
  "totalResponses": 50,
  "completionRate": 0.85,
  "averageCompletionTime": 300,
  "lastResponseAt": "2025-01-15T12:00:00"
}
```


