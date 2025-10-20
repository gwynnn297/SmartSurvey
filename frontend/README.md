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
- Hiển thị số phản hồi thực tế từ database
- Quản lý khảo sát (xem, chỉnh sửa, xóa)
- Tạo khảo sát mới với 2 phương thức

### 🤖 Tạo khảo sát bằng AI
- Gợi ý câu hỏi thông minh dựa trên ngữ cảnh
- Tối ưu hóa mục tiêu khảo sát
- Tiết kiệm thời gian tạo khảo sát
- Tạo lại câu hỏi bằng AI cho câu hỏi đã tạo

### ✍️ Tạo khảo sát thủ công
- Giao diện drag-and-drop để sắp xếp câu hỏi
- Hỗ trợ nhiều loại câu hỏi (trắc nghiệm, tự luận, yes/no, rating)
- Quản lý tùy chọn câu trả lời
- Tất cả câu hỏi mặc định bắt buộc
- Lưu bản nháp và xuất bản
- Xem trước khảo sát trước khi chia sẻ

### 🔗 Chia sẻ khảo sát
- Tạo link chia sẻ với token unique
- Mỗi lần chia sẻ tạo token mới để phân biệt lượt khảo sát
- QR Code để chia sẻ dễ dàng
- Kiểm tra trạng thái token đã sử dụng

### 📝 Tham gia khảo sát
- Giao diện thân thiện cho người tham gia
- Validation form real-time
- Hiển thị thông báo khi đã hoàn thành khảo sát
- Bảo mật token và tránh duplicate responses

### 🎨 Giao diện hiện đại
- Responsive design với Tailwind CSS
- Drag-and-drop interface với @dnd-kit
- Animations và transitions mượt mà
- Dark/Light mode support
- Loading states và error handling

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

python -m venv .venv
.\.venv\Scripts\Activate.ps1
$env:GEMINI_API_KEY = 'AIzaSyC2rBe8abSir3_J_oG2mskGDj6zBR2uNU0'
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload


# Phân tích cảm xúc 
python -m uvicorn app:app --reload

test QR thì vào 
https://zxing.org/w/decode.jspx
## 🏗️ Cấu trúc dự án

```
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── api/
│   │   └── aiSurveyApi.js          # API cho AI survey generation
│   ├── assets/
│   │   ├── logoSmartSurvey.png     # Logo ứng dụng
│   │   └── react.svg
│   ├── components/
│   │   ├── HeaderComponent.jsx     # Header component
│   │   ├── ListSurvey.jsx          # Component danh sách khảo sát
│   │   ├── Sidebar.jsx             # Sidebar navigation
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
│   │   ├── report/                 # Báo cáo và thống kê
│   │   ├── Response/               # Tham gia khảo sát
│   │   │   ├── PublicResponsePage.jsx  # Trang tham gia khảo sát public
│   │   │   └── ResponseFormPage.jsx    # Form trả lời khảo sát
│   │   └── Survey/
│   │       ├── CreateAI.jsx        # Tạo khảo sát bằng AI
│   │       ├── CreateSurvey.jsx    # Tạo khảo sát thủ công
│   │       └── ShareSurveyPage.jsx # Chia sẻ khảo sát
│   ├── redux/                      # State management (nếu cần)
│   ├── services/
│   │   ├── aiSurveyService.js      # AI survey generation service
│   │   ├── authService.js          # Authentication service
│   │   ├── changePasswordService.js
│   │   ├── profileService.js
│   │   ├── questionSurvey.js       # Question và option management
│   │   ├── responseService.js      # Response submission service
│   │   ├── SentimentAI.js          # Sentiment analysis service
│   │   ├── surveyService.js        # Survey management service
│   │   └── userService.js
│   ├── utils/
│   │   ├── tokenGenerator.js       # Token generation utilities
│   │   └── README_TOKEN_SYSTEM.md  # Documentation cho token system
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
- **Get Survey Detail**: `GET /surveys/:id`
- **Create Survey**: `POST /surveys`
- **Update Survey**: `PUT /surveys/:id`
- **Delete Survey**: `DELETE /surveys/:id`
- **Get Categories**: `GET /categories`

### Question & Option Management
- **Get Questions**: `GET /questions/survey/:surveyId`
- **Create Question**: `POST /questions`
- **Update Question**: `PUT /questions/:id`
- **Delete Question**: `DELETE /questions/:id`
- **Get Options**: `GET /options/question/:questionId`
- **Create Option**: `POST /options`
- **Update Option**: `PUT /options/:id`
- **Delete Option**: `DELETE /options/:id`

### Response Management
- **Submit Response**: `POST /responses`
- **Get Responses**: `GET /responses/:surveyId`
- **Check Token Used**: `GET /api/public/responses/check-token/:token`

### AI Features
- **Generate Survey**: `POST /ai/surveys/generate`
- **Sentiment Analysis**: `POST /ai/sentiment/analyze`

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
- Xem báo cáo và thống kê

### 4. Chia sẻ khảo sát
1. Vào Dashboard → Click "Chia sẻ" trên khảo sát
2. Xác nhận chuyển trạng thái sang "Đang mở"
3. Sao chép link chia sẻ hoặc sử dụng QR Code
4. Mỗi lần chia sẻ tạo token unique mới

### 5. Tham gia khảo sát
1. Truy cập link chia sẻ từ người tạo khảo sát
2. Điền thông tin và trả lời các câu hỏi
3. Submit để gửi phản hồi
4. Nhận thông báo xác nhận hoàn thành

### 6. Tính năng đặc biệt
- **Token System**: Mỗi link chia sẻ có token unique
- **Duplicate Prevention**: Tránh gửi phản hồi trùng lặp
- **Real-time Validation**: Kiểm tra form real-time
- **Response Tracking**: Theo dõi số phản hồi thực tế

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
- **Survey Not Found**: Kiểm tra survey ID và quyền truy cập
- **Response Submission Failed**: Kiểm tra network và token validation
- **AI Generation Error**: Kiểm tra API key và network connection

### Performance Tips
- Sử dụng browser caching cho static assets
- Enable gzip compression trên server
- Optimize images và assets
- Sử dụng React.memo cho components không thay đổi thường xuyên

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

## 🔧 Development

### Thêm tính năng mới
1. Tạo branch mới từ `main`
2. Implement tính năng với tests
3. Update documentation nếu cần
4. Tạo Pull Request

### Code Style
- Sử dụng ESLint configuration có sẵn
- Follow React best practices
- Comment code phức tạp
- Sử dụng meaningful variable names

### Testing
```bash
# Chạy tests
npm test

# Chạy tests với coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📚 Documentation

- **Token System**: Xem `src/utils/README_TOKEN_SYSTEM.md`
- **API Documentation**: Xem backend documentation
- **Component Documentation**: Inline comments trong code

## 🚀 Roadmap

### Sắp tới
- [ ] Real-time notifications
- [ ] Advanced analytics dashboard
- [ ] Export responses to Excel/PDF
- [ ] Multi-language support
- [ ] Mobile app (React Native)

### Đã hoàn thành ✅
- [x] Token unique system
- [x] Response tracking
- [x] AI question regeneration
- [x] Duplicate prevention
- [x] Real-time form validation
- [x] QR Code sharing

## 📞 Support

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub hoặc liên hệ team phát triển.

---

**SmartSurvey** - Tạo khảo sát thông minh với AI 🚀