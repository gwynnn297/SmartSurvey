import { apiClient } from './authService';

// User service - chỉ xử lý các API liên quan đến user
export const userService = {

    // Lấy thông tin user hiện tại
    getCurrentUser: async () => {
        try {
            const response = await apiClient.get('/auth/me');
            return response.data;
        } catch (error) {
            console.error('Get current user error:', error);
            throw error;
        }
    },

    // Cập nhật thông tin user
    updateProfile: async (userData) => {
        try {
            const response = await apiClient.put('/auth/profile', userData);
            return response.data;
        } catch (error) {
            console.error('Update profile error:', error);
            throw error;
        }
    },

    // Đổi mật khẩu
    changePassword: async (oldPassword, newPassword) => {
        try {
            const response = await apiClient.post('/auth/change-password', {
                oldPassword,
                newPassword
            });
            return response.data;
        } catch (error) {
            console.error('Change password error:', error);
            throw error;
        }
    },

};

export default userService;
