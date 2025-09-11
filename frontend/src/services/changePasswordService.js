import axios from 'axios';

// Tạo axios instance riêng cho change password để tránh xung đột với response interceptor
const changePasswordClient = axios.create({
    baseURL: 'http://localhost:8080',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Request interceptor để thêm token
changePasswordClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        console.log('Change password - Token from localStorage:', token);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('Change password - Authorization header set:', config.headers.Authorization);
        } else {
            console.error('Change password - No token found in localStorage');
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Service cho đổi mật khẩu
 */
export const changePasswordService = {
    /**
     * Test token validation
     */
    testToken: async () => {
        try {
            console.log('Testing token validation...');
            const response = await changePasswordClient.post('/auth/test-token');
            console.log('Test token response:', response);
            return response.data;
        } catch (error) {
            console.error('Test token error:', error);
            throw error;
        }
    },

    /**
     * Đổi mật khẩu
     */
    changePassword: async (data) => {
        try {
            console.log('Sending change password request:', data);
            console.log('Request headers will include:', {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            });

            const response = await changePasswordClient.post('/auth/change-password', data);
            console.log('Change password response:', response);
            return response.data;
        } catch (error) {
            console.error('Change password service error:', error);
            console.error('Error details:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers
            });
            throw error;
        }
    }
};

export default changePasswordService;
