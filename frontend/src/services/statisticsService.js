import { apiClient } from './authService';

/**
 * Service để gọi các API thống kê từ StatisticsController
 */
export const statisticsService = {
    /**
     * Lấy dữ liệu biểu đồ cho survey
     * GET /api/surveys/{surveyId}/results/charts
     */
    getSurveyCharts: async (surveyId) => {
        try {
            const response = await apiClient.get(`/api/surveys/${surveyId}/results/charts`);
            return response.data;
        } catch (error) {
            console.error('❌ Get survey charts error:', error);
            throw error;
        }
    },

    /**
     * Lấy responses chi tiết cho survey (để tính ranking)
     * GET /api/responses/survey/{surveyId}
     */
    getResponsesBySurvey: async (surveyId) => {
        try {
            const response = await apiClient.get(`/api/responses/survey/${surveyId}`);
            return response.data;
        } catch (error) {
            console.error('❌ Get responses by survey error:', error);
            throw error;
        }
    },
};

export default statisticsService;