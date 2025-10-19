import { apiClient } from './authService';

/**
 * Service cho AI Sentiment Analysis
 * Đồng bộ hoàn toàn với backend API sentiment endpoints
 * 
 * Backend Controller: AiSentimentController
 * Base URL: /ai
 * Endpoints:
 * - POST /ai/sentiment/{surveyId}?questionId={questionId} - Phân tích sentiment cho survey
 * - GET /ai/sentiment/{surveyId} - Lấy kết quả sentiment gần nhất
 * - GET /auth/health - Health check (không có /ai/health endpoint)
 */
export const aiSentimentService = {
    /**
     * Phân tích sentiment cho survey
     * POST /ai/sentiment/{surveyId}?questionId={questionId}
     * 
     * Backend Implementation:
     * - @PostMapping("/sentiment/{surveyId}")
     * - @RequestParam(required = false) Long questionId
     * - Trả về SentimentAnalysisResponseDTO
     * 
     * @param {number} surveyId - ID của survey
     * @param {number} questionId - ID của question (optional)
     * @returns {Promise<SentimentAnalysisResponseDTO>} Kết quả phân tích sentiment
     */
    analyzeSentiment: async (surveyId, questionId = null) => {
        try {
            console.log('🔄 Analyzing sentiment for survey:', surveyId, 'question:', questionId);

            // Chuẩn bị params theo backend API - questionId là @RequestParam
            const params = {};
            if (questionId) {
                params.questionId = questionId;
            }

            // Gọi API theo đúng format backend
            const response = await apiClient.post(`/ai/sentiment/${surveyId}`, {}, {
                params,
                timeout: 60000 // 60 seconds timeout cho sentiment analysis
            });

            console.log('✅ Sentiment analysis result:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Sentiment analysis error:', error);

            // Xử lý lỗi theo backend response format
            if (error.response?.data) {
                // Backend trả về error trong format SentimentAnalysisResponseDTO
                const errorData = error.response.data;
                if (errorData.success === false) {
                    console.log('Backend error response:', errorData);
                    return errorData; // Trả về error response từ backend
                }
            }

            throw error;
        }
    },

    /**
     * Lấy kết quả sentiment gần nhất
     * GET /ai/sentiment/{surveyId}
     * 
     * Backend Implementation:
     * - @GetMapping("/sentiment/{surveyId}")
     * - Trả về SentimentAnalysisResponseDTO
     * - Status 404 nếu không tìm thấy sentiment
     * 
     * @param {number} surveyId - ID của survey
     * @returns {Promise<SentimentAnalysisResponseDTO>} Kết quả sentiment gần nhất
     */
    getLatestSentiment: async (surveyId) => {
        try {
            console.log('📊 Getting latest sentiment for survey:', surveyId);

            const response = await apiClient.get(`/ai/sentiment/${surveyId}`);

            console.log('✅ Latest sentiment result:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Get latest sentiment error:', error);

            // Xử lý lỗi 404 - không có dữ liệu sentiment (theo backend implementation)
            if (error.response?.status === 404) {
                console.log('No sentiment data found for survey:', surveyId);

                // Trả về error response theo format backend SentimentAnalysisResponseDTO
                return {
                    success: false,
                    message: error.response?.data?.message || "Không tìm thấy kết quả sentiment",
                    survey_id: surveyId,
                    sentiment_id: null,
                    total_responses: 0,
                    positive_percent: 0,
                    neutral_percent: 0,
                    negative_percent: 0,
                    counts: null,
                    created_at: null,
                    error_details: error.response?.data?.error_details || "Không tìm thấy bản ghi sentiment"
                };
            }

            // Xử lý các lỗi khác theo backend format
            if (error.response?.data) {
                const errorData = error.response.data;
                if (errorData.success === false) {
                    console.log('Backend error response:', errorData);
                    return errorData;
                }
            }

            throw error;
        }
    },

    /**
     * Kiểm tra sức khỏe hệ thống
     * GET /auth/health
     * 
     * Backend Implementation:
     * - Không có /ai/health endpoint
     * - Sử dụng /auth/health endpoint
     * 
     * @returns {Promise<any>} Health check result
     */
    checkHealth: async () => {
        try {
            const response = await apiClient.get('/auth/health');
            return response.data;
        } catch (error) {
            console.error('❌ Health check error:', error);
            throw error;
        }
    },

    /**
     * Kiểm tra xem survey có tồn tại không
     * GET /surveys/{surveyId}
     * 
     * Backend Implementation:
     * - @GetMapping("/{id}") trong SurveyController
     * - Trả về SurveyDetailResponseDTO
     * 
     * @param {number} surveyId - ID của survey
     * @returns {Promise<boolean>} True nếu survey tồn tại
     */
    checkSurveyExists: async (surveyId) => {
        try {
            const response = await apiClient.get(`/surveys/${surveyId}`);
            return response.status === 200;
        } catch (error) {
            console.error('❌ Check survey exists error:', error);
            return false;
        }
    }
};

/**
 * Sentiment Analysis Response DTO Structure
 * Đồng bộ hoàn toàn với backend SentimentAnalysisResponseDTO.java
 * 
 * Backend DTO Implementation:
 * @Data @Builder @NoArgsConstructor @AllArgsConstructor
 * public class SentimentAnalysisResponseDTO {
 *     private boolean success;
 *     private String message;
 *     @JsonProperty("survey_id") private Long surveyId;
 *     @JsonProperty("sentiment_id") private Long sentimentId;
 *     @JsonProperty("total_responses") private Integer totalResponses;
 *     @JsonProperty("positive_percent") private Double positivePercent;
 *     @JsonProperty("neutral_percent") private Double neutralPercent;
 *     @JsonProperty("negative_percent") private Double negativePercent;
 *     private Map<String, Integer> counts;
 *     @JsonProperty("created_at") private LocalDateTime createdAt;
 *     @JsonProperty("error_details") private Object errorDetails;
 * }
 * 
 * Factory Methods:
 * - success(Long surveyId, Long sentimentId, String message)
 * - success(Long surveyId, String message, Integer totalResponses, ...)
 * - error(Long surveyId, String message)
 * - error(Long surveyId, String message, Object errorDetails)
 * 
 * @typedef {Object} SentimentAnalysisResponseDTO
 * @property {boolean} success - Trạng thái thành công
 * @property {string} message - Thông báo từ backend
 * @property {number} survey_id - ID của survey (JSON property: survey_id)
 * @property {number|null} sentiment_id - ID của sentiment analysis (JSON property: sentiment_id)
 * @property {number} total_responses - Tổng số responses (JSON property: total_responses)
 * @property {number} positive_percent - Phần trăm tích cực (JSON property: positive_percent)
 * @property {number} neutral_percent - Phần trăm trung tính (JSON property: neutral_percent)
 * @property {number} negative_percent - Phần trăm tiêu cực (JSON property: negative_percent)
 * @property {Object<string, number>|null} counts - Số lượng theo từng loại sentiment
 * @property {string|null} created_at - Thời gian tạo (JSON property: created_at)
 * @property {any|null} error_details - Chi tiết lỗi (JSON property: error_details)
 */

export default aiSentimentService;
