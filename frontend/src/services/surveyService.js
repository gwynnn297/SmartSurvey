import { apiClient } from './authService';

export const surveyService = {
    // Lấy tổng quan dashboard
    getDashboardOverview: async () => {
        try {
            const response = await apiClient.get('/dashboard/overview');
            return response.data;
        } catch (error) {
            console.error('Get dashboard overview error:', error);
            throw error;
        }
    },

    // Tạo khảo sát mới - chỉ tạo survey, không tạo questions
    createSurvey: async (data) => {
        try {
            console.log('Creating survey:', data);
            const response = await apiClient.post('/surveys', data);
            console.log('Survey created:', response.data);
            return response.data;
        } catch (error) {
            console.error('Create survey error:', error);
            throw error;
        }
    },

    // Lấy danh sách khảo sát với phân trang
    getSurveys: async (page = 0, size = 10) => {
        try {
            const response = await apiClient.get('/surveys', {
                params: { page, size }
            });
            return response.data;
        } catch (error) {
            console.error('Get surveys error:', error);
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
    updateSurvey: async (surveyId, data) => {
        try {
            console.log(`Updating survey ${surveyId}:`, data);
            const response = await apiClient.put(`/surveys/${surveyId}`, data);
            console.log('Survey updated:', response.data);
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

    // Lấy danh mục khảo sát
    getCategories: async () => {
        try {
            const response = await apiClient.get('/categories');
            return response.data;
        } catch (error) {
            console.error('Get categories error:', error);
            throw error;
        }
    }
};

export default surveyService;

