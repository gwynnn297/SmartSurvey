# Test sau khi fix lỗi 401 - Hướng dẫn chi tiết

## ✅ Các vấn đề đã được sửa:

### 1. **Tạo các Controller còn thiếu**
- ✅ `DashboardController` - xử lý `/dashboard/overview`
- ✅ `SurveyController` - xử lý `/surveys`

### 2. **Cập nhật Spring Security Config**
- ✅ Thêm `/dashboard/**` và `/surveys/**` vào danh sách authenticated endpoints

### 3. **Sửa Response Interceptor**
- ✅ Chỉ xóa token khi thực sự cần thiết (auth endpoints)
- ✅ Không xóa token cho các endpoint khác (có thể chưa implement)

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

### Bước 3: Test Login và Dashboard

1. **Mở Developer Tools (F12) → Console tab**

2. **Đăng nhập** với tài khoản hợp lệ
   - Kiểm tra console logs:
   ```
   🔐 Login response data: {token: "...", user: {...}}
   💾 Saving token to localStorage: eyJhbGciOiJIUzI1NiJ9...
   ✅ Token verification - saved: Yes
   🎉 Login successful, navigating to dashboard
   ```

3. **Vào Dashboard** và kiểm tra:
   - Console logs:
   ```
   🏠 Dashboard: Starting to load data...
   🔑 Dashboard: Token check: Found
   📊 Dashboard: Calling getDashboardOverview...
   🔑 Request interceptor - Token from localStorage: Found
   ✅ Authorization header set: Bearer eyJhbGciOiJIUzI1NiJ9...
   📤 Request URL: /dashboard/overview
   ✅ Response received: 200 /dashboard/overview
   📋 Dashboard: Calling getSurveys...
   ✅ Response received: 200 /surveys
   🎉 Dashboard: Data loaded successfully
   ```

4. **Kiểm tra Network Tab**:
   - Tìm request `/dashboard/overview`
   - Kiểm tra Headers → phải có: `Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...`
   - Response phải là 200 OK

### Bước 4: Test Token Test Component
- Trên dashboard có component "Token Test"
- Click "Test Token" button
- Kết quả mong đợi: "✅ Token is working! API call successful."

## 🎯 Kết quả mong đợi:

### ✅ Thành công:
- Login thành công
- Dashboard load được data (dù là mock data)
- Không bị logout bất ngờ
- Console logs hiển thị đầy đủ thông tin debug
- Network tab hiển thị Authorization header

### ❌ Nếu vẫn lỗi:
1. **401 trên `/dashboard/overview`**:
   - Kiểm tra backend có chạy không
   - Kiểm tra endpoint có được tạo không

2. **401 trên `/surveys`**:
   - Tương tự như trên

3. **Token bị xóa**:
   - Kiểm tra response interceptor có hoạt động đúng không

## 🔧 Debug Commands:

### Kiểm tra token trong Console:
```javascript
// Kiểm tra token
console.log('Token:', localStorage.getItem('token'));

// Test API call trực tiếp
fetch('http://localhost:8080/dashboard/overview', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### Test endpoint trực tiếp:
```bash
# Test với curl (thay YOUR_TOKEN bằng token thực)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/dashboard/overview
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/surveys
```

## 📝 Ghi chú:
- Các endpoint hiện tại trả về mock data
- Sau này sẽ thay bằng service thực
- Token sẽ không bị xóa khi gọi các endpoint chưa implement
- Chỉ xóa token khi gọi `/auth/me` hoặc `/auth/change-password` bị 401







