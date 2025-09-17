import { apiClient } from '../services/authService';

// API for AI-powered survey generation
export const aiSurveyApi = {
    // Generate survey suggestions/questions by AI
    generateSurvey: async (payload) => {
        // Expected payload fields:
        // title, category_id, short_description, deadline_date, deadline_time, ai_context
        try {
            const response = await apiClient.post('/ai/surveys/generate', payload);
            return response.data;
        } catch (error) {
            console.error('❌ AI generate survey error:', error);
            throw error;
        }
    }
};

export default aiSurveyApi;


