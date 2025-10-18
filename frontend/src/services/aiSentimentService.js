import { apiClient } from './authService';

/**
 * Service cho AI Sentiment Analysis
 * Đồng bộ với backend API sentiment endpoints
 */
export const aiSentimentService = {
    /**
     * Phân tích sentiment cho survey
     * POST /ai/sentiment/{surveyId}
     * @param {number} surveyId - ID của survey
     * @param {number} questionId - ID của question (optional)
     * @returns {Promise<SentimentAnalysisResponseDTO>} Kết quả phân tích sentiment
     */
    analyzeSentiment: async (surveyId, questionId = null) => {
        try {
            console.log('Analyzing sentiment for survey:', surveyId, 'question:', questionId);

            const params = {};
            if (questionId) {
                params.questionId = questionId;
            }

            const response = await apiClient.post(`/ai/sentiment/${surveyId}`, {}, {
                params,
                timeout: 60000 // 60 seconds timeout cho sentiment analysis
            });

            console.log('Sentiment analysis result:', response.data);
            return response.data;

        } catch (error) {
            console.error('Sentiment analysis error:', error);
            throw error;
        }
    },

    /**
     * Lấy kết quả sentiment gần nhất
     * GET /ai/sentiment/{surveyId}
     * @param {number} surveyId - ID của survey
     * @returns {Promise<SentimentAnalysisResponseDTO>} Kết quả sentiment gần nhất
     */
    getLatestSentiment: async (surveyId) => {
        try {
            console.log('Getting latest sentiment for survey:', surveyId);

            const response = await apiClient.get(`/ai/sentiment/${surveyId}`);

            console.log('Latest sentiment result:', response.data);
            return response.data;

        } catch (error) {
            console.error('Get latest sentiment error:', error);
            throw error;
        }
    },

    /**
     * Kiểm tra sức khỏe AI sentiment service
     * @returns {Promise<any>} Health check result
     */
    checkHealth: async () => {
        try {
            const response = await apiClient.get('/ai/health');
            return response.data;
        } catch (error) {
            console.error('AI sentiment health check error:', error);
            throw error;
        }
    }
};

/**
 * Sentiment Analysis Response DTO Structure
 * Đồng bộ với backend SentimentAnalysisResponseDTO
 * 
 * @typedef {Object} SentimentAnalysisResponseDTO
 * @property {boolean} success - Trạng thái thành công
 * @property {string} message - Thông báo
 * @property {number} survey_id - ID của survey
 * @property {number} sentiment_id - ID của sentiment analysis (nếu có)
 * @property {number} total_responses - Tổng số responses
 * @property {number} positive_percent - Phần trăm tích cực
 * @property {number} neutral_percent - Phần trăm trung tính
 * @property {number} negative_percent - Phần trăm tiêu cực
 * @property {Object<string, number>} counts - Số lượng theo từng loại sentiment
 * @property {string} created_at - Thời gian tạo
 * @property {any} error_details - Chi tiết lỗi (nếu có)
 */

export default aiSentimentService;
