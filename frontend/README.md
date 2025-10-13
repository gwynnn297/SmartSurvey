# SmartSurvey Frontend

Ứng dụng React hiện đại để tạo và quản lý khảo sát thông minh với hỗ trợ AI và giao diện drag-and-drop.

## 🚀 Tính năng chính

### 🔐 Xác thực người dùng
- Đăng nhập/Đăng ký với JWT authentication
- Quản lý profile người dùng
- Đổi mật khẩu và quên mật khẩu
- Bảo vệ route với PrivateRoute

### 📊 Dashboard thông minh
- Tổng quan thống kê khảo sát (KPI cards)
- Danh sách khảo sát với trạng thái real-time
- Quản lý khảo sát (xem, chỉnh sửa, xóa)
- Tạo khảo sát mới với 2 phương thức

### 🤖 Tạo khảo sát bằng AI
- Gợi ý câu hỏi thông minh dựa trên ngữ cảnh
- Tối ưu hóa mục tiêu khảo sát
- Tiết kiệm thời gian tạo khảo sát

### ✍️ Tạo khảo sát thủ công
- Giao diện drag-and-drop để sắp xếp câu hỏi
- Hỗ trợ nhiều loại câu hỏi (trắc nghiệm, tự luận)
- Quản lý tùy chọn câu trả lời
- Lưu bản nháp và xuất bản

### 🎨 Giao diện hiện đại
- Responsive design với Tailwind CSS
- Drag-and-drop interface với @dnd-kit
- Animations và transitions mượt mà
- Dark/Light mode support

## 🛠️ Công nghệ sử dụng

- **Frontend Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.2
- **Routing**: React Router DOM 7.8.2
- **HTTP Client**: Axios 1.11.0
- **Drag & Drop**: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- **Styling**: Tailwind CSS 4.1.13
- **Linting**: ESLint 9.33.0

## 📦 Cài đặt

### Yêu cầu hệ thống
- Node.js >= 18.0.0
- npm >= 8.0.0

### Cài đặt dependencies

```bash
# Cài đặt tất cả dependencies
npm install

# Cài đặt @dnd-kit/core (nếu chưa có)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers

# Cài đặt thư viện để hiển thi biểu đồ
npm install recharts

# Cài đặt thư viện mã QR 
npm install qrcode.react    
```
# Cài đặt thư viện icon
npm i @fortawesome/fontawesome-free
### Chạy ứng dụng

```bash
# Development mode
npm run dev

# Build production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint```
Trước khi chạy backend
$env:DB_USERNAME = "root"
$env:DB_PASSWORD = password
$env:MYSQL_HOST  = "localhost"

## 🏗️ Cấu trúc dự án

```
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── api/
│   │   └── aiSurveyApi.js          # API cho AI survey generation
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── HeaderComponent.jsx     # Header component
│   │   └── Survey/
│   │       ├── SurveyTaker.jsx     # Component tham gia khảo sát
│   │       └── SurveyViewer.jsx    # Component xem khảo sát
│   ├── layouts/
│   │   └── MainLayout.jsx          # Layout chính
│   ├── pages/
│   │   ├── ChangePassword/         # Đổi mật khẩu
│   │   ├── dashboard/              # Dashboard chính
│   │   ├── ForgotPassword/         # Quên mật khẩu
│   │   ├── home/                   # Trang chủ
│   │   ├── login/                  # Đăng nhập
│   │   ├── Profile/                # Quản lý profile
│   │   ├── register/               # Đăng ký
│   │   └── Survey/
│   │       ├── CreateAI.jsx        # Tạo khảo sát bằng AI
│   │       └── CreateSurvey.jsx    # Tạo khảo sát thủ công
│   ├── redux/                      # State management (nếu cần)
│   ├── services/
│   │   ├── authService.js          # Authentication service
│   │   ├── changePasswordService.js
│   │   ├── profileService.js
│   │   ├── questionSurvey.js
│   │   ├── surveyService.js        # Survey management service
│   │   └── userService.js
│   ├── utils/                      # Utility functions
│   ├── App.jsx                     # Main App component
│   ├── main.jsx                    # Entry point
│   ├── App.css
│   └── index.css
├── package.json
├── vite.config.js
├── eslint.config.js
└── README.md
```

## 🔧 Cấu hình

### Environment Variables
Tạo file `.env` trong thư mục root:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_NAME=SmartSurvey
```

### Vite Configuration
File `vite.config.js` đã được cấu hình cơ bản với React plugin.

## 📡 API Endpoints

### Authentication
- **Login**: `POST /auth/login`
- **Register**: `POST /auth/register`
- **Profile**: `GET /auth/me`
- **Change Password**: `POST /auth/change-password`

### Survey Management
- **Get Surveys**: `GET /surveys?page=1&limit=10`
- **Create Survey**: `POST /surveys`
- **Update Survey**: `PUT /surveys/:id`
- **Delete Survey**: `DELETE /surveys/:id`
- **Get Categories**: `GET /categories`

### AI Features
- **Generate Survey**: `POST /ai/surveys/generate`

## 🎯 Cách sử dụng

### 1. Đăng nhập
- Truy cập `/login`
- Sử dụng tài khoản đã đăng ký
- Sau khi đăng nhập thành công, chuyển đến dashboard

### 2. Tạo khảo sát
#### Tạo bằng AI:
1. Vào Dashboard → "Tạo khảo sát mới"
2. Chọn "Tạo bằng AI"
3. Điền thông tin và ngữ cảnh chi tiết
4. AI sẽ tạo gợi ý câu hỏi
5. Chỉnh sửa và lưu khảo sát

#### Tạo thủ công:
1. Vào Dashboard → "Tạo khảo sát mới"
2. Chọn "Tạo thủ công"
3. Thêm tiêu đề và mô tả
4. Thêm câu hỏi và tùy chọn
5. Sắp xếp câu hỏi bằng drag-and-drop
6. Lưu bản nháp hoặc xuất bản

### 3. Quản lý khảo sát
- Xem danh sách khảo sát trên Dashboard
- Click vào khảo sát để chỉnh sửa
- Xóa khảo sát không cần thiết
- Xem báo cáo (sắp có)

## 🐛 Debug và Troubleshooting

### Token Issues
Nếu gặp lỗi 401 Unauthorized, tham khảo file `DEBUG_TOKEN_ISSUE.md` để debug:

1. Kiểm tra Console logs
2. Kiểm tra Network tab
3. Kiểm tra localStorage
4. Sử dụng Token Test Component

### Common Issues
- **CORS Error**: Đảm bảo backend đã cấu hình CORS
- **Token Expired**: Đăng nhập lại
- **API Connection**: Kiểm tra VITE_API_BASE_URL

## 🚀 Deployment

### Build cho Production
```bash
npm run build
```

### Deploy với Vercel
```bash
# Cài đặt Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Deploy với Netlify
```bash
# Build
npm run build

# Upload thư mục dist/ lên Netlify
```

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Support

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub hoặc liên hệ team phát triển.

---

**SmartSurvey** - Tạo khảo sát thông minh với AI 🚀