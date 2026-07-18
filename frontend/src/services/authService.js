import axios from "axios";

// Tạo axios instance với base config
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor để tự động thêm token vào header
apiClient.interceptors.request.use(
  (config) => {
    const url = config.url || '';
    const isPublicAuth = url.includes('/auth/login') || url.includes('/auth/register');

    if (isPublicAuth) {
      // Đối với login/register: không cần token và không log cảnh báo gây nhiễu
      console.log('📤 Public auth request:', url);
      return config;
    }

    const token = localStorage.getItem('token');
    console.log('🔑 Request interceptor - Token from localStorage:', token ? 'Found' : 'Not found');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // console.log('✅ Authorization header set:', config.headers.Authorization);
    } else {
      console.warn('⚠️ No token found in localStorage');
    }
    console.log('📤 Request URL:', config.url);
    console.log('📤 Request headers:', config.headers);
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor để xử lý lỗi 401
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ Response received:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.log('❌ Response error:', error.response?.status, error.config?.url);
    console.log('❌ Error details:', error.response?.data);

    if (error.response?.status === 401) {
      // ⚠️ Chỉ xóa token khi thực sự cần thiết
      const url = error.config?.url || '';

      // Chỉ xóa token khi gọi các endpoint quan trọng về authentication
      if (url.includes('/auth/me') || url.includes('/auth/change-password')) {
        console.log('🚫 401 Unauthorized on auth endpoint - Clearing tokens and redirecting');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Redirect to login
        // window.location.href = '/login';
      } else {
        console.log('⚠️ 401 Unauthorized on non-auth endpoint - Keeping token, might be endpoint not implemented yet');
        // Không xóa token cho các endpoint khác (có thể chưa implement)
      }
    }
    
    // Không xử lý 403 ở đây - để component tự xử lý
    // 403 Forbidden nghĩa là user đã authenticated nhưng không có quyền
    
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
    // console.log('Attempting login with:', { email, password });
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
