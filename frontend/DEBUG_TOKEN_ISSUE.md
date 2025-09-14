# Debug Token Issue - Hướng dẫn kiểm tra lỗi 401

## Vấn đề
Sau khi login thành công, các API call tiếp theo bị lỗi 401 Unauthorized.

## Các bước debug

### 1. Kiểm tra Console Logs
Mở Developer Tools (F12) → Console tab và thực hiện các bước sau:

#### A. Login và kiểm tra token được lưu
1. Đăng nhập với tài khoản hợp lệ
2. Kiểm tra console logs:
   ```
   🔐 Login response data: {token: "...", user: {...}}
   💾 Saving token to localStorage: eyJhbGciOiJIUzI1NiJ9...
   ✅ Token verification - saved: Yes
   👤 User info saved: {name: "...", email: "...", ...}
   🎉 Login successful, navigating to dashboard
   ```

#### B. Kiểm tra Request Interceptor
Khi vào dashboard, kiểm tra logs:
   ```
   🔑 Request interceptor - Token from localStorage: Found
   ✅ Authorization header set: Bearer eyJhbGciOiJIUzI1NiJ9...
   📤 Request URL: /dashboard/overview
   📤 Request headers: {Authorization: "Bearer ...", Content-Type: "application/json"}
   ```

#### C. Kiểm tra Response
   ```
   ✅ Response received: 200 /dashboard/overview
   ```

### 2. Kiểm tra Network Tab
1. Mở Developer Tools (F12) → Network tab
2. Đăng nhập và vào dashboard
3. Tìm request `/surveys?page=1&limit=10`
4. Click vào request đó
5. Kiểm tra **Headers** tab:
   - Phải có: `Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...`
   - Nếu không có → Vấn đề ở interceptor
   - Nếu có nhưng vẫn 401 → Vấn đề ở backend

### 3. Kiểm tra localStorage
1. Mở Developer Tools (F12) → Application tab
2. Chọn Local Storage → http://localhost:3000
3. Kiểm tra:
   - `token`: Phải có giá trị JWT
   - `user`: Phải có thông tin user

### 4. Sử dụng Token Test Component
Trên dashboard có component TokenTest để test token:
1. Click "Test Token" button
2. Kiểm tra kết quả:
   - ✅ Token is working! → Token OK
   - ❌ Token test failed → Có vấn đề

### 5. Các lỗi thường gặp

#### A. Token không được lưu
**Triệu chứng**: Console không có log "Token verification - saved: Yes"
**Nguyên nhân**: Lỗi trong quá trình lưu token
**Giải pháp**: Kiểm tra localStorage có bị block không

#### B. Token không được gửi
**Triệu chứng**: Network tab không có Authorization header
**Nguyên nhân**: Interceptor không hoạt động
**Giải pháp**: Kiểm tra import apiClient

#### C. Token hết hạn
**Triệu chứng**: 401 với message "Token expired"
**Nguyên nhân**: Token JWT hết hạn
**Giải pháp**: Login lại

#### D. Token không hợp lệ
**Triệu chứng**: 401 với message "Invalid token"
**Nguyên nhân**: Token bị corrupt hoặc sai format
**Giải pháp**: Clear localStorage và login lại

### 6. Commands để test

#### Test token trong Console
```javascript
// Kiểm tra token
console.log('Token:', localStorage.getItem('token'));

// Test API call
fetch('http://localhost:8080/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

#### Clear và test lại
```javascript
// Clear token
localStorage.removeItem('token');
localStorage.removeItem('user');

// Reload page
window.location.reload();
```

### 7. Fix nhanh
Nếu vẫn gặp vấn đề, thử các bước sau:

1. **Clear browser cache**: Ctrl+Shift+Delete
2. **Hard refresh**: Ctrl+Shift+R
3. **Clear localStorage**: 
   ```javascript
   localStorage.clear();
   ```
4. **Restart backend**: 
   ```bash
   cd backend
   ./gradlew bootRun
   ```
5. **Restart frontend**:
   ```bash
   cd frontend
   npm start
   ```

## Kết quả mong đợi
Sau khi fix, bạn sẽ thấy:
- ✅ Token được lưu sau login
- ✅ Authorization header có trong mọi request
- ✅ API calls trả về 200 thay vì 401
- ✅ Dashboard load được data

