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
            console.log('🔍 ProfileService: Getting profile...');
            const response = await apiClient.get('/users/profile');
            console.log('✅ ProfileService: Profile response:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ ProfileService: Get profile error:', error);
            throw error;
        }
    },

    /**
     * Cập nhật thông tin profile
     */
    updateProfile: async (data) => {
        try {
            console.log('📝 ProfileService: Updating profile with data:', data);
            const response = await apiClient.put('/users/profile', data);
            console.log('✅ ProfileService: Update profile response:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ ProfileService: Update profile error:', error);
            throw error;
        }
    }
};

export default profileService;
