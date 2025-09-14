import { apiClient } from './authService';

/**
 * Service cho đổi mật khẩu
 */
export const changePasswordService = {
    /**
     * Test token validation
     */
    testToken: async () => {
        try {
            console.log('🔍 ChangePassword: Testing token validation...');
            const response = await apiClient.post('/auth/test-token');
            console.log('✅ ChangePassword: Test token response:', response);
            return response.data;
        } catch (error) {
            console.error('❌ ChangePassword: Test token error:', error);
            throw error;
        }
    },

    /**
     * Đổi mật khẩu
     */
    changePassword: async (data) => {
        try {
            console.log('🔐 ChangePassword: Sending change password request:', data);

            // Check token before making API call
            const token = localStorage.getItem('token');
            console.log('🔑 ChangePassword: Token check:', token ? 'Found' : 'Not found');

            const response = await apiClient.post('/auth/change-password', data);
            console.log('✅ ChangePassword: Change password response:', response);
            return response.data;
        } catch (error) {
            console.error('❌ ChangePassword: Change password service error:', error);
            console.error('❌ ChangePassword: Error details:', {
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
