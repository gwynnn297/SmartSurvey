import { apiClient } from './authService';

/**
 * Service cho quản lý profile
 */
export const profileService = {
    /**
     * Lấy thông tin profile của user hiện tại
     */
    getProfile: async () => {
        try {
            const response = await apiClient.get('/users/profile');
            return response.data;
        } catch (error) {
            console.error('Get profile error:', error);
            throw error;
        }
    },

    /**
     * Cập nhật thông tin profile
     */
    updateProfile: async (data) => {
        try {
            const response = await apiClient.put('/users/profile', data);
            return response.data;
        } catch (error) {
            console.error('Update profile error:', error);
            throw error;
        }
    }
};

export default profileService;
