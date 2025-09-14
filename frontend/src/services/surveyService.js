import { apiClient } from './authService';

export const surveyService = {
    // Tạo khảo sát mới
    createSurvey: async (data) => {
        try {
            console.log('📝 Creating survey:', data);
            const response = await apiClient.post('/surveys', data);
            console.log('✅ Survey created:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Create survey error:', error);
            throw error;
        }
    },

    // Thêm câu hỏi vào khảo sát
    addQuestion: async (surveyId, data) => {
        try {
            console.log(`📝 Adding question to survey ${surveyId}:`, data);
            const response = await apiClient.post(`/surveys/${surveyId}/questions`, data);
            console.log('✅ Question added:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Add question error:', error);
            throw error;
        }
    },

    // Thêm option cho câu hỏi
    addOption: async (questionId, data) => {
        try {
            console.log(`📝 Adding option to question ${questionId}:`, data);
            const response = await apiClient.post(`/questions/${questionId}/options`, data);
            console.log('✅ Option added:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Add option error:', error);
            throw error;
        }
    },

    // Lấy danh sách khảo sát
    getSurveys: async (params = {}) => {
        try {
            const response = await apiClient.get('/surveys', { params });
            return response.data;
        } catch (error) {
            console.error('❌ Get surveys error:', error);
            throw error;
        }
    },

    // Lấy chi tiết khảo sát
    getSurveyById: async (surveyId) => {
        try {
            const response = await apiClient.get(`/surveys/${surveyId}`);
            return response.data;
        } catch (error) {
            console.error('❌ Get survey by id error:', error);
            throw error;
        }
    },

    // Cập nhật khảo sát
    updateSurvey: async (surveyId, data) => {
        try {
            console.log(`📝 Updating survey ${surveyId}:`, data);
            const response = await apiClient.put(`/surveys/${surveyId}`, data);
            console.log('✅ Survey updated:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Update survey error:', error);
            throw error;
        }
    },

    // Xóa khảo sát
    deleteSurvey: async (surveyId) => {
        try {
            const response = await apiClient.delete(`/surveys/${surveyId}`);
            return response.data;
        } catch (error) {
            console.error('❌ Delete survey error:', error);
            throw error;
        }
    },

    // Lấy danh mục khảo sát
    getCategories: async () => {
        try {
            const response = await apiClient.get('/categories');
            return response.data;
        } catch (error) {
            console.error('❌ Get categories error:', error);
            throw error;
        }
    }
};

export default surveyService;

