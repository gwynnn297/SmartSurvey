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

