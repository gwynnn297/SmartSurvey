import { apiClient } from './authService';

/**
 * SentimentAI Service
 * Tích hợp với AI Controller backend để phân tích sentiment
 */
export const sentimentAIService = {
    /**
     * POST /ai/sentiment/{surveyId}
     * Trigger phân tích sentiment cho toàn bộ response của survey
     * @param {number} surveyId - ID của survey cần phân tích
     * @param {number} questionId - ID của question cụ thể (optional)
     * @returns {Promise<Object>} TriggerResponse từ backend
     */
    triggerSentimentAnalysis: async (surveyId, questionId = null) => {
        try {
            console.log('Triggering sentiment analysis for survey:', surveyId, questionId ? `question: ${questionId}` : '');

            const params = questionId ? { questionId } : {};
            const response = await apiClient.post(`/ai/sentiment/${surveyId}`, null, { params });

            console.log('Sentiment analysis triggered:', response.data);
            return response.data;
        } catch (error) {
            console.error('Trigger sentiment analysis error:', error);
            const backendMessage = error.response?.data?.message;
            throw new Error(backendMessage || "Có lỗi xảy ra khi kích hoạt phân tích sentiment");
        }
    },

    /**
     * GET /ai/sentiment/{surveyId}
     * Lấy kết quả phân tích sentiment (phần trăm positive/neutral/negative)
     * @param {number} surveyId - ID của survey
     * @returns {Promise<Object>} SimpleResponse với phần trăm sentiment
     */
    getSentimentResult: async (surveyId) => {
        try {
            console.log('Getting sentiment result for survey:', surveyId);

            const response = await apiClient.get(`/ai/sentiment/${surveyId}`);

            console.log('Sentiment result received:', response.data);
            return response.data;
        } catch (error) {
            console.error('Get sentiment result error:', error);
            const backendMessage = error.response?.data?.message;
            throw new Error(backendMessage || "Có lỗi xảy ra khi lấy kết quả phân tích sentiment");
        }
    },

    /**
     * GET /ai/sentiment/{surveyId}/detailed
     * Lấy kết quả chi tiết từ database
     * @param {number} surveyId - ID của survey
     * @returns {Promise<Object>} DetailedResponse với thông tin chi tiết
     */
    getDetailedSentimentResult: async (surveyId) => {
        try {
            console.log('Getting detailed sentiment result for survey:', surveyId);

            const response = await apiClient.get(`/ai/sentiment/${surveyId}/detailed`);

            console.log('Detailed sentiment result received:', response.data);
            return response.data;
        } catch (error) {
            console.error('Get detailed sentiment result error:', error);
            const backendMessage = error.response?.data?.message;
            throw new Error(backendMessage || "Có lỗi xảy ra khi lấy kết quả phân tích sentiment chi tiết");
        }
    },

    /**
     * Utility method: Trigger analysis and wait for result
     * Kết hợp trigger và get result trong một function
     * @param {number} surveyId - ID của survey
     * @param {number} questionId - ID của question cụ thể (optional)
     * @param {number} maxRetries - Số lần retry tối đa (default: 5)
     * @param {number} delayMs - Thời gian delay giữa các lần retry (default: 2000ms)
     * @returns {Promise<Object>} Kết quả phân tích sentiment
     */
    analyzeAndGetResult: async (surveyId, questionId = null, maxRetries = 5, delayMs = 2000) => {
        try {
            console.log('Starting sentiment analysis with auto-retry for survey:', surveyId);

            // Trigger analysis
            await sentimentAIService.triggerSentimentAnalysis(surveyId, questionId);

            // Wait and retry to get result
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                console.log(`Attempt ${attempt}/${maxRetries} to get sentiment result`);

                try {
                    const result = await sentimentAIService.getSentimentResult(surveyId);
                    console.log('Sentiment analysis completed successfully');
                    return result;
                } catch (error) {
                    console.log(`Attempt ${attempt} failed:`, error.message);

                    if (attempt === maxRetries) {
                        throw new Error(`Không thể lấy kết quả phân tích sau ${maxRetries} lần thử`);
                    }

                    // Wait before next attempt
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        } catch (error) {
            console.error('Analyze and get result error:', error);
            throw error;
        }
    }
};

export default sentimentAIService;
