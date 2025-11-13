import { apiClient } from './authService';

/**
 * Service cho AI Analysis
 * Đồng bộ hoàn toàn với backend API analysis endpoints
 * 
 * Backend Controller: AiAnalysisController
 * Base URL: /ai
 * Endpoints:
 * - POST /ai/keywords/{surveyId} - Extract keywords from responses
 * - POST /ai/basic-sentiment/{surveyId} - Basic sentiment analysis (batch)
 * - POST /ai/summary/{surveyId} - Summarize responses
 * - POST /ai/themes/{surveyId}?k={k} - Cluster themes from responses
 * - GET /ai/analysis/{surveyId}/latest/{kind} - Get latest analysis by kind
 */
export const aiAnalysisService = {
    /**
     * Trích xuất keywords từ responses
     * POST /ai/keywords/{surveyId}
     * 
     * Backend Implementation:
     * - @PostMapping("/keywords/{surveyId}")
     * - @PathVariable("surveyId") Long surveyId
     * - Principal principal (authentication required)
     * - Trả về Map<String, Object> (ResponseEntity<Map<String, Object>>)
     * 
     * @param {number} surveyId - ID của survey
     * @returns {Promise<Object>} Kết quả trích xuất keywords
     */
    extractKeywords: async (surveyId) => {
        try {
            console.log('🔍 Extracting keywords for survey:', surveyId);

            const response = await apiClient.post(`/ai/keywords/${surveyId}`, {}, {
                timeout: 600000 // 10 minutes timeout cho keyword extraction
            });

            console.log('✅ Keywords extraction result:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Keywords extraction error:', error);

            // Xử lý lỗi theo backend response format
            if (error.response?.data) {
                const errorData = error.response.data;
                if (errorData.ok === false) {
                    console.log('Backend error response:', errorData);
                    return errorData; // Trả về error response từ backend
                }
            }

            throw error;
        }
    },

    /**
     * Phân tích sentiment cơ bản (batch)
     * POST /ai/basic-sentiment/{surveyId}
     * 
     * Backend Implementation:
     * - @PostMapping("/basic-sentiment/{surveyId}")
     * - @PathVariable("surveyId") Long surveyId
     * - Principal principal (authentication required)
     * - Trả về Map<String, Object> (ResponseEntity<Map<String, Object>>)
     * 
     * @param {number} surveyId - ID của survey
     * @returns {Promise<Object>} Kết quả phân tích sentiment cơ bản
     */
    basicSentiment: async (surveyId) => {
        try {
            console.log('📊 Basic sentiment analysis for survey:', surveyId);

            const response = await apiClient.post(`/ai/basic-sentiment/${surveyId}`, {}, {
                timeout: 600000 // 10 minutes timeout cho sentiment analysis
            });

            console.log('✅ Basic sentiment analysis result:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Basic sentiment analysis error:', error);

            // Xử lý lỗi theo backend response format
            if (error.response?.data) {
                const errorData = error.response.data;
                if (errorData.ok === false) {
                    console.log('Backend error response:', errorData);
                    return errorData; // Trả về error response từ backend
                }
            }

            throw error;
        }
    },

    /**
     * Tóm tắt responses
     * POST /ai/summary/{surveyId}
     * 
     * Backend Implementation:
     * - @PostMapping("/summary/{surveyId}")
     * - @PathVariable("surveyId") Long surveyId
     * - Principal principal (authentication required)
     * - Trả về Map<String, Object> (ResponseEntity<Map<String, Object>>)
     * 
     * @param {number} surveyId - ID của survey
     * @returns {Promise<Object>} Kết quả tóm tắt responses
     */
    summarize: async (surveyId) => {
        try {
            console.log('📝 Summarizing responses for survey:', surveyId);

            const response = await apiClient.post(`/ai/summary/${surveyId}`, {}, {
                timeout: 600000 // 10 minutes timeout cho summarization
            });

            console.log('✅ Summary result:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Summary error:', error);

            // Xử lý lỗi theo backend response format
            if (error.response?.data) {
                const errorData = error.response.data;
                if (errorData.ok === false) {
                    console.log('Backend error response:', errorData);
                    return errorData; // Trả về error response từ backend
                }
            }

            throw error;
        }
    },

    /**
     * Phân cụm themes từ responses
     * POST /ai/themes/{surveyId}?k={k}
     * 
     * Backend Implementation:
     * - @PostMapping("/themes/{surveyId}")
     * - @PathVariable("surveyId") Long surveyId
     * - @RequestParam(name = "k", required = false) Integer k
     * - Principal principal (authentication required)
     * - Trả về Map<String, Object> (ResponseEntity<Map<String, Object>>)
     * 
     * @param {number} surveyId - ID của survey
     * @param {number|null} k - Số lượng clusters (optional)
     * @returns {Promise<Object>} Kết quả phân cụm themes
     */
    clusterThemes: async (surveyId, k = null) => {
        try {
            console.log('🎯 Clustering themes for survey:', surveyId, 'k:', k);

            // Chuẩn bị params theo backend API - k là @RequestParam optional
            const params = {};
            if (k !== null && k !== undefined) {
                params.k = k;
            }

            const response = await apiClient.post(`/ai/themes/${surveyId}`, {}, {
                params,
                timeout: 600000 // 10 minutes timeout cho theme clustering
            });

            console.log('✅ Theme clustering result:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Theme clustering error:', error);

            // Xử lý lỗi theo backend response format
            if (error.response?.data) {
                const errorData = error.response.data;
                if (errorData.ok === false) {
                    console.log('Backend error response:', errorData);
                    return errorData; // Trả về error response từ backend
                }
            }

            throw error;
        }
    },

    /**
     * Lấy kết quả analysis gần nhất theo loại
     * GET /ai/analysis/{surveyId}/latest/{kind}
     * 
     * Backend Implementation:
     * - @GetMapping("/analysis/{surveyId}/latest/{kind}")
     * - @PathVariable("surveyId") Long surveyId
     * - @PathVariable("kind") String kind
     * - Principal principal (authentication required)
     * - Trả về Map<String, Object> (ResponseEntity<Map<String, Object>>)
     * 
     * @param {number} surveyId - ID của survey
     * @param {string} kind - Loại analysis (keywords, basic-sentiment, summary, themes)
     * @returns {Promise<Object>} Kết quả analysis gần nhất
     */
    getLatestAnalysis: async (surveyId, kind) => {
        try {
            console.log('📋 Getting latest analysis for survey:', surveyId, 'kind:', kind);

            const response = await apiClient.get(`/ai/analysis/${surveyId}/latest/${kind}`);

            console.log('✅ Latest analysis result:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Get latest analysis error:', error);

            // Xử lý lỗi 404 - không có dữ liệu analysis (theo backend implementation)
            if (error.response?.status === 404) {
                console.log('ℹ️ No analysis data found for survey:', surveyId, 'kind:', kind, '- This is normal for new surveys');

                // Trả về error response theo format backend
                return {
                    ok: false,
                    error: error.response?.data?.error || "Không tìm thấy kết quả analysis",
                    message: error.response?.data?.message || "Không tìm thấy bản ghi analysis"
                };
            }

            // Xử lý lỗi theo backend response format
            if (error.response?.data) {
                const errorData = error.response.data;
                if (errorData.ok === false) {
                    console.log('Backend error response:', errorData);
                    return errorData; // Trả về error response từ backend
                }
            }

            throw error;
        }
    }
};

/**
 * Analysis Response DTO Structure
 * Đồng bộ hoàn toàn với backend AiAnalysisController
 * 
 * Backend Controller Implementation:
 * - Tất cả endpoints trả về ResponseEntity<Map<String, Object>>
 * - Success response: Map với các keys tùy theo loại analysis
 * - Error response: Map.of("ok", false, "error", e.getMessage())
 * 
 * Response Formats:
 * - extractKeywords: Map<String, Object> với keywords data
 * - basicSentiment: Map<String, Object> với sentiment data
 * - summarize: Map<String, Object> với summary data
 * - clusterThemes: Map<String, Object> với themes data
 * - getLatestAnalysis: Map<String, Object> với analysis data hoặc error
 * 
 * Common Error Format:
 * {
 *   "ok": false,
 *   "error": "Error message"
 * }
 * 
 * @typedef {Object} AnalysisResponse
 * @property {boolean} [ok] - Trạng thái thành công (false nếu có lỗi)
 * @property {string} [error] - Thông báo lỗi (nếu có)
 * @property {*} [data] - Dữ liệu kết quả (tùy theo loại analysis)
 */

export default aiAnalysisService;

