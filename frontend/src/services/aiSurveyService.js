import { apiClient } from './authService';

export const aiSurveyService = {
    // Tạo khảo sát bằng AI  
    generateSurvey: async (data) => {
        try {
            console.log('Calling AI generate survey:', data);
            const response = await apiClient.post('/ai/generate-survey', data, {
                timeout: 60000 // 60 seconds timeout cho AI generation
            });
            console.log('AI survey generated:', response.data);
            return response.data;
        } catch (error) {
            console.error('AI generate survey error:', error);
            throw error;
        }
    },

    // Regenerate một câu hỏi cụ thể
    regenerateQuestion: async (data) => {
        try {
            console.log('Regenerating question:', data);
            const response = await apiClient.post('/ai/regenerate-question', data, {
                timeout: 30000 // 30 seconds timeout cho regenerate
            });
            console.log('Question regenerated:', response.data);
            return response.data;
        } catch (error) {
            console.error('AI regenerate question error:', error);
            throw error;
        }
    },

    // Kiểm tra sức khỏe AI service
    checkHealth: async () => {
        try {
            const response = await apiClient.get('/ai/health');
            return response.data;
        } catch (error) {
            console.error('AI health check error:', error);
            throw error;
        }
    },

    // Validate prompt
    validatePrompt: async (prompt) => {
        try {
            const response = await apiClient.get('/ai/validate-prompt', {
                params: { prompt }
            });
            return response.data;
        } catch (error) {
            console.error('AI validate prompt error:', error);
            throw error;
        }
    }
};