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

    // Alias cho getSurveyById
    getSurveyDetail: async (surveyId) => {
        return surveyService.getSurveyById(surveyId);
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
    },
    // ❓ Questions
    createQuestion: async (surveyId, questionData) => {
        try {
            const response = await apiClient.post('/questions', {
                surveyId,
                ...questionData
            });
            return response.data;
        } catch (error) {
            console.error('Create question error:', error);
            throw error;
        }
    },

    updateQuestion: async (questionId, data) => {
        try {
            const response = await apiClient.put(`/questions/${questionId}`, data);
            return response.data;
        } catch (error) {
            console.error('Update question error:', error);
            throw error;
        }
    },

    deleteQuestion: async (questionId) => {
        try {
            const response = await apiClient.delete(`/questions/${questionId}`);
            return response.data;
        } catch (error) {
            console.error('Delete question error:', error);
            throw error;
        }
    },

    // 🔘 Options
    createOption: async (questionId, text) => {
        try {
            const response = await apiClient.post('/options', {
                questionId,
                text
            });
            return response.data;
        } catch (error) {
            console.error('Create option error:', error);
            throw error;
        }
    },

    updateOption: async (optionId, text) => {
        try {
            const response = await apiClient.put(`/options/${optionId}`, { text });
            return response.data;
        } catch (error) {
            console.error('Update option error:', error);
            throw error;
        }
    },

    deleteOption: async (optionId) => {
        try {
            const response = await apiClient.delete(`/options/${optionId}`);
            return response.data;
        } catch (error) {
            console.error('Delete option error:', error);
            throw error;
        }
    }
};

export default surveyService;

