import { apiClient } from './authService';

// API service chung cho các endpoint khác
export const apiService = {
    // Lấy tổng quan dashboard
    // Ví dụ API: GET /dashboard/overview
    // Response mẫu:
    // {
    //   "totalSurveys": 25,
    //   "totalResponses": 1342,
    //   "activeSurveys": 6,
    //   "completionRate": 78.5
    // }
    getDashboardOverview: async () => {
        try {
            const response = await apiClient.get('/dashboard/overview');
            return response.data;
        } catch (error) {
            console.error('Get dashboard overview error:', error);
            throw error;
        }
    },

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

    // Lấy danh sách khảo sát (hỗ trợ phân trang, tìm kiếm)
    // Ví dụ API: GET /surveys?page=1&limit=10&search=customer
    // Response mẫu:
    // {
    //   "items": [
    //     { "id": 1, "title": "Khảo sát hài lòng KH", "status": "active", "createdAt": "2025-09-01T10:00:00Z", "responses": 124 },
    //     ...
    //   ],
    //   "page": 1,
    //   "limit": 10,
    //   "total": 25
    // }
    getSurveys: async (params = {}) => {
        try {
            const response = await apiClient.get('/surveys', { params });
            return response.data;
        } catch (error) {
            console.error('Get surveys error:', error);
            throw error;
        }
    },

    // Tạo khảo sát mới
    createSurvey: async (surveyData) => {
        try {
            const response = await apiClient.post('/surveys', surveyData);
            return response.data;
        } catch (error) {
            console.error('Create survey error:', error);
            throw error;
        }
    },

    // Lấy chi tiết khảo sát
    getSurveyById: async (surveyId) => {
        try {
            const response = await apiClient.get(`/surveys/${surveyId}`);
            return response.data;
        } catch (error) {
            console.error('Get survey by id error:', error);
            throw error;
        }
    },

    // Cập nhật khảo sát
    updateSurvey: async (surveyId, surveyData) => {
        try {
            const response = await apiClient.put(`/surveys/${surveyId}`, surveyData);
            return response.data;
        } catch (error) {
            console.error('Update survey error:', error);
            throw error;
        }
    },

    // Xóa khảo sát
    deleteSurvey: async (surveyId) => {
        try {
            const response = await apiClient.delete(`/surveys/${surveyId}`);
            return response.data;
        } catch (error) {
            console.error('Delete survey error:', error);
            throw error;
        }
    },

    // Lấy thống kê khảo sát
    getSurveyStats: async (surveyId) => {
        try {
            const response = await apiClient.get(`/surveys/${surveyId}/stats`);
            return response.data;
        } catch (error) {
            console.error('Get survey stats error:', error);
            throw error;
        }
    }
};

export default apiService;
