# SmartSurvey Frontend

Ứng dụng React với chức năng đăng nhập sử dụng API reqres.in để test.

## Cài đặt

```bash
npm install
```

## Chạy ứng dụng

```bash
npm run dev
```

## Chức năng

### Đăng nhập
- Sử dụng API https://www.apirequest.in/user/api/login để test chức năng đăng nhập
- **Test credentials:**
  - Email: `Yara@apirequest.in`
  - Password: `pwd`


### Cấu trúc dự án

```text
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   └── HeaderComponent.jsx
│   ├── pages/
│   │   ├── login/
│   │   │   ├── LoginPage.jsx
│   │   │   └── LoginPage.css
│   │   ├── register/
│   │   │   ├── Register.jsx
│   │   │   └── Register.css
│   │   ├── dashboard/
│   │   │   └── DashboardPage.jsx
│   ├── services/
│   │   └── authService.js
│   ├── App.jsx
│   ├── main.jsx
│   ├── App.css
│   └── index.css
├── package.json
├── vite.config.js
├── eslint.config.js
└── README.md
```

- `src/services/authService.js` - Service xử lý authentication
- `src/pages/login/LoginPage.jsx` - Trang đăng nhập
- `src/pages/register/Register.jsx` - Trang đăng ký
- `src/pages/dashboard/DashboardPage.jsx` - Trang dashboard (yêu cầu đăng nhập)
- `src/components/HeaderComponent.jsx` - Header dùng chung cho các trang

## API Endpoints

- **Login:** `POST https://www.apirequest.in/user/api/login`
- **Response:** `{ "token": "QpwL5tke4Pnpja7X4" }`

## Tính năng đã sửa

1. ✅ Sửa API URL từ documentation sang endpoint thực tế
2. ✅ Cập nhật LoginPage để sử dụng authService
3. ✅ Thêm xử lý loading state và error handling
4. ✅ Thêm console.log để debug
5. ✅ Cập nhật logic xử lý response từ reqres.in

## Lưu ý

- API reqres.in chỉ dùng để test, không lưu trữ dữ liệu thực
- Token được lưu trong localStorage
- Sau khi đăng nhập thành công, user sẽ được chuyển đến trang dashboard
