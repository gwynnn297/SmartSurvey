import { apiClient } from './authService';

export const aiChatService = {
    /**
     * Gửi câu hỏi đến AI Chat và nhận phản hồi
     * 
     * @param {Object} data - Chat request data
     * @param {number} data.surveyId - ID của khảo sát (bắt buộc)
     * @param {string} data.questionText - Nội dung câu hỏi (bắt buộc, 1-1000 ký tự)
     * @param {number} [data.userId] - ID của người dùng (tùy chọn)
     * @param {number} [data.topK=5] - Số lượng context documents để retrieve (mặc định: 5)
     * @returns {Promise<Object>} AI Chat response
     */
    processChat: async (data) => {
        try {
            console.log('Calling AI chat:', data);
            const response = await apiClient.post('/ai/chat', data, {
                timeout: 60000 // 60 seconds timeout cho AI chat
            });
            console.log('AI chat response:', response.data);
            return response.data;
        } catch (error) {
            console.error('AI chat error:', error);
            throw error;
        }
    },

    /**
     * Lấy lịch sử chat cho một khảo sát
     * 
     * @param {number} surveyId - ID của khảo sát
     * @param {number} [limit=20] - Số lượng chat logs tối đa (mặc định: 20, tối đa: 100)
     * @returns {Promise<Object>} Chat history response
     */
    getChatHistory: async (surveyId, limit = 20) => {
        try {
            console.log('Getting chat history for survey:', surveyId, 'limit:', limit);
            const response = await apiClient.get(`/ai/chat/history/${surveyId}`, {
                params: { limit }
            });
            console.log('Chat history response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Get chat history error:', error);
            throw error;
        }
    },

    /**
     * Lấy lịch sử chat của một người dùng cụ thể cho một khảo sát
     * 
     * @param {number} surveyId - ID của khảo sát
     * @param {number} userId - ID của người dùng
     * @returns {Promise<Object>} User chat history response
     */
    getUserChatHistory: async (surveyId, userId) => {
        try {
            console.log('Getting user chat history for survey:', surveyId, 'user:', userId);
            const response = await apiClient.get(`/ai/chat/history/${surveyId}/user/${userId}`);
            console.log('User chat history response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Get user chat history error:', error);
            throw error;
        }
    },

    /**
     * Ingest dữ liệu khảo sát vào RAG system
     * 
     * @param {number} surveyId - ID của khảo sát cần ingest
     * @returns {Promise<Object>} Ingestion result
     */
    ingestSurveyData: async (surveyId) => {
        try {
            console.log('Ingesting survey data for RAG:', surveyId);
            const response = await apiClient.post(`/ai/chat/rag/ingest/${surveyId}`, {}, {
                timeout: 120000 // 120 seconds timeout cho ingestion process
            });
            console.log('Survey data ingested:', response.data);
            return response.data;
        } catch (error) {
            console.error('Ingest survey data error:', error);
            throw error;
        }
    },

    /**
     * Kiểm tra sức khỏe của AI Chat service
     * 
     * @returns {Promise<Object>} Health check response
     */
    checkHealth: async () => {
        try {
            const response = await apiClient.get('/ai/chat/health');
            return response.data;
        } catch (error) {
            console.error('AI chat health check error:', error);
            throw error;
        }
    }
};

