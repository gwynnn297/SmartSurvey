# Test Change Password - Hướng dẫn chi tiết

## ✅ Các vấn đề đã được sửa:

### 1. **Thêm ChangePassword route**
- ✅ Đã thêm route `/change-password` vào `App.jsx` với PrivateRoute protection

### 2. **Sửa ChangePasswordService**
- ✅ Sử dụng `apiClient` chung thay vì tạo instance riêng
- ✅ Thêm debug logging chi tiết
- ✅ Sửa lỗi syntax

### 3. **Cải thiện ChangePassword.jsx**
- ✅ Thêm debug logging
- ✅ Cải thiện error handling
- ✅ Token verification trước khi gọi API

### 4. **Backend đã sẵn sàng**
- ✅ Endpoint `/auth/change-password` đã tồn tại
- ✅ SecurityConfig đã cho phép endpoint này
- ✅ AuthService có method `changePassword`

## 🧪 Các bước test:

### Bước 1: Khởi động Backend
```bash
cd backend
./gradlew bootRun
```

### Bước 2: Khởi động Frontend
```bash
cd frontend
npm start
```

### Bước 3: Test Change Password Flow

1. **Mở Developer Tools (F12) → Console tab**

2. **Đăng nhập** với tài khoản hợp lệ

3. **Vào Profile page**:
   - Click vào nút "Hồ sơ" trên dashboard
   - Kiểm tra console logs:
   ```
   🏠 Profile: Starting to load profile...
   🔑 Profile: Token check: Found
   🔍 ProfileService: Getting profile...
   ✅ ProfileService: Profile response: {...}
   🎉 Profile: Profile loaded successfully
   ```

4. **Click nút "Đổi mật khẩu"**:
   - Kiểm tra console logs:
   ```
   🏠 ChangePassword: Starting change password process...
   🔑 ChangePassword: Token check: Found
   🔐 ChangePassword: Sending change password request: {...}
   🔑 Request interceptor - Token from localStorage: Found
   ✅ Authorization header set: Bearer eyJhbGciOiJIUzI1NiJ9...
   📤 Request URL: /auth/change-password
   ✅ Response received: 200 /auth/change-password
   ✅ ChangePassword: Change password response: {status: "success", message: "Đổi mật khẩu thành công"}
   ```

5. **Điền form đổi mật khẩu**:
   - Mật khẩu hiện tại: (mật khẩu đang dùng)
   - Mật khẩu mới: (mật khẩu mới)
   - Xác nhận mật khẩu: (mật khẩu mới)

6. **Submit form** và kiểm tra:
   - Console logs hiển thị đầy đủ
   - Thông báo thành công
   - Tự động redirect về profile sau 2 giây

## 🎯 Kết quả mong đợi:

### ✅ Thành công:
- Profile page load được
- Nút "Đổi mật khẩu" hoạt động
- Form đổi mật khẩu hiển thị
- API call thành công với Authorization header
- Thông báo thành công
- Redirect về profile

### ❌ Nếu vẫn lỗi:
1. **401 trên `/auth/change-password`**:
   - Kiểm tra token có được gửi không
   - Kiểm tra backend có chạy không

2. **Token bị xóa**:
   - Kiểm tra response interceptor có hoạt động đúng không

## 🔧 Debug Commands:

### Kiểm tra token trong Console:
```javascript
// Kiểm tra token
console.log('Token:', localStorage.getItem('token'));

// Test API call trực tiếp
fetch('http://localhost:8080/auth/change-password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    currentPassword: 'old_password',
    newPassword: 'new_password',
    confirmPassword: 'new_password'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### Test endpoint trực tiếp:
```bash
# Test với curl (thay YOUR_TOKEN bằng token thực)
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"old","newPassword":"new","confirmPassword":"new"}' \
  http://localhost:8080/auth/change-password
```

## 📝 Ghi chú:
- ChangePassword sử dụng apiClient chung (có interceptor)
- Token sẽ được gửi tự động trong mọi request
- Response interceptor sẽ xử lý lỗi 401 đúng cách
- Form validation hoạt động ở cả frontend và backend







