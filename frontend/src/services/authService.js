import axios from "axios";

// Tạo axios instance với base config
const apiClient = axios.create({
  baseURL: 'http://localhost:8080',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor để tự động thêm token vào header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor để xử lý lỗi 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 401 từ các API không nên xóa token ngay.
      // Trả lỗi về cho UI xử lý (ví dụ: hiển thị toast, yêu cầu đăng nhập lại khi cần).
    }
    return Promise.reject(error);
  }
);

export const register = async (fullName, email, password) => {
  try {
    console.log('Attempting register with:', { fullName, email, password });
    const response = await apiClient.post('/auth/register', {
      fullName,
      email,
      password,
      confirmPassword: password // Backend yêu cầu confirmPassword
    });
    console.log('Register response:', response.data);
    return response.data; // AuthResponse với token
  } catch (error) {
    const backendMessage = error.response?.data?.message;
    console.error("Register API error:", error); // log toàn bộ error gốc
    throw new Error(backendMessage || "Có lỗi xảy ra, vui lòng thử lại");
  }

};

export const login = async (email, password) => {
  try {
    console.log('Attempting login with:', { email, password });
    const response = await apiClient.post('/auth/login', { email, password });
    console.log('Login response:', response.data);
    return response.data; // { token, user }
  } catch (error) {
    const backendMessage = error.response?.data?.message;
    console.error('Login error:', backendMessage || error.message);
    throw new Error(backendMessage || "Đăng nhập thất bại");
  }
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

// Export apiClient để sử dụng cho các API khác
export { apiClient };
