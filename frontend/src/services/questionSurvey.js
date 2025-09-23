import { apiClient } from './authService';

export const questionService = {
    // Reorder câu hỏi trong survey
    reorderQuestions: async (surveyId, orderedQuestionIds) => {
        try {
            const response = await apiClient.put(`/surveys/${surveyId}/questions/reorder`, {
                orderedQuestionIds
            });
            return response.data;
        } catch (error) {
            console.error('Reorder questions error:', error);
            throw error;
        }
    },

    // Tạo câu hỏi mới cho survey
    createQuestion: async (data) => {
        try {
            console.log('Creating question:', data);
            const { surveyId, ...questionData } = data;
            const response = await apiClient.post(`/surveys/${surveyId}/questions`, questionData);
            console.log('Question created:', response.data);
            return response.data;
        } catch (error) {
            console.error('Create question error:', error);
            throw error;
        }
    },

    // Lấy danh sách câu hỏi theo survey
    getQuestionsBySurvey: async (surveyId) => {
        try {
            const response = await apiClient.get(`/questions/survey/${surveyId}`);
            return response.data;
        } catch (error) {
            console.error('Get questions by survey error:', error);
            throw error;
        }
    },

    // Lấy chi tiết câu hỏi
    getQuestionById: async (questionId) => {
        try {
            const response = await apiClient.get(`/questions/${questionId}`);
            return response.data;
        } catch (error) {
            console.error('Get question by id error:', error);
            throw error;
        }
    },

    // Cập nhật câu hỏi
    updateQuestion: async (questionId, data) => {
        try {
            console.log(`Updating question ${questionId}:`, data);
            const response = await apiClient.put(`/questions/${questionId}`, data);
            console.log('Question updated:', response.data);
            return response.data;
        } catch (error) {
            console.error('Update question error:', error);
            throw error;
        }
    },

    // Xóa câu hỏi
    deleteQuestion: async (questionId) => {
        try {
            const response = await apiClient.delete(`/questions/${questionId}`);
            return response.data;
        } catch (error) {
            console.error('Delete question error:', error);
            throw error;
        }
    }
};

export const optionService = {
    // Tạo tùy chọn mới cho question
    createOption: async (data) => {
        try {
            console.log('Creating option:', data);
            const { questionId, ...optionData } = data;
            const response = await apiClient.post(`/questions/${questionId}/options`, optionData);
            console.log('Option created:', response.data);
            return response.data;
        } catch (error) {
            console.error('Create option error:', error);
            throw error;
        }
    },

    // Lấy danh sách tùy chọn theo question
    getOptionsByQuestion: async (questionId) => {
        try {
            const response = await apiClient.get(`/options/question/${questionId}`);
            return response.data;
        } catch (error) {
            console.error('Get options by question error:', error);
            throw error;
        }
    },

    // Lấy chi tiết tùy chọn
    getOptionById: async (optionId) => {
        try {
            const response = await apiClient.get(`/options/${optionId}`);
            return response.data;
        } catch (error) {
            console.error('Get option by id error:', error);
            throw error;
        }
    },

    // Cập nhật tùy chọn
    updateOption: async (optionId, data) => {
        try {
            console.log(`Updating option ${optionId}:`, data);
            const response = await apiClient.put(`/options/${optionId}`, data);
            console.log('Option updated:', response.data);
            return response.data;
        } catch (error) {
            console.error('Update option error:', error);
            throw error;
        }
    },

    // Xóa tùy chọn
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

export default { questionService, optionService };
