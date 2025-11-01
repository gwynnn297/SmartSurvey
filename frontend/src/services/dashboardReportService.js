import { apiClient } from './authService';

/**
 * Dịch vụ Dashboard Report
 * Đồng bộ với các API backend từ StatisticsController.java
 */
export const dashboardReportService = {

    /**
     * Lấy thống kê tổng quan của survey
     * GET /api/surveys/{surveyId}/results/overview
     * @param {number} surveyId - ID khảo sát
     * @returns {Promise<Object>} SurveyOverviewResponseDTO
     */
    getSurveyOverview: async (surveyId) => {
        try {
            const response = await apiClient.get(`/api/surveys/${surveyId}/results/overview`);
            return response.data;
        } catch (error) {
            console.error('❌ Get survey overview error:', error);

            // Enhanced error handling for 401
            if (error.response?.status === 401) {
                console.warn('🔐 StatisticsController endpoints may require special authentication or be not implemented yet');
            }

            throw error;
        }
    },

    /**
     * Lấy timeline responses của survey  
     * GET /api/surveys/{surveyId}/results/timeline
     * @param {number} surveyId - ID khảo sát
     * @returns {Promise<Object>} SurveyTimelineResponseDTO
     */
    getSurveyTimeline: async (surveyId) => {
        try {
            const response = await apiClient.get(`/api/surveys/${surveyId}/results/timeline`);
            return response.data;
        } catch (error) {
            console.error('❌ Get survey timeline error:', error);

            // Enhanced error handling for 401
            if (error.response?.status === 401) {
                console.warn('🔐 StatisticsController endpoints may require special authentication or be not implemented yet');
            }

            throw error;
        }
    },

    /**
     * Lấy thống kê số câu hỏi theo loại
     * GET /api/surveys/{surveyId}/results/question-counts
     * @param {number} surveyId - ID khảo sát
     * @returns {Promise<Object>} SurveyQuestionCountsDTO
     */
    getSurveyQuestionCounts: async (surveyId) => {
        try {
            const response = await apiClient.get(`/api/surveys/${surveyId}/results/question-counts`);
            return response.data;
        } catch (error) {
            console.error('❌ Get survey question counts error:', error);

            // Enhanced error handling for 401
            if (error.response?.status === 401) {
                console.warn('🔐 StatisticsController endpoints may require special authentication or be not implemented yet');
            }

            throw error;
        }
    },

    /**
     * Helper function: Lấy tất cả dữ liệu cần thiết cho dashboard trong một lần gọi
     * với fallback mechanism cho lỗi 401
     * @param {number} surveyId - ID khảo sát
     * @returns {Promise<Object>} Combined dashboard data hoặc mock data nếu API không khả dụng
     */
    getDashboardData: async (surveyId) => {
        try {
            console.log('🔍 Attempting to fetch dashboard data from StatisticsController APIs...');

            // Gọi song song 3 APIs để tối ưu performance
            const [overviewData, timelineData, questionCountsData] = await Promise.all([
                dashboardReportService.getSurveyOverview(surveyId),
                dashboardReportService.getSurveyTimeline(surveyId),
                dashboardReportService.getSurveyQuestionCounts(surveyId)
            ]);

            console.log('✅ Successfully fetched real data from StatisticsController');

            return {
                overview: overviewData,
                timeline: timelineData,
                questionCounts: questionCountsData,
                success: true,
                isRealData: true
            };
        } catch (error) {
            console.error('❌ Get dashboard data error:', error);

            // Check if it's 401 error - StatisticsController may not be properly configured for auth
            if (error.response?.status === 401) {
                console.warn('🔐 StatisticsController authentication issue detected. Using fallback mock data.');
                return dashboardReportService.getMockDashboardData(surveyId);
            }

            throw error;
        }
    },

    /**
     * Fallback mock data khi StatisticsController APIs không khả dụng do lỗi 401
     * @param {number} surveyId - ID khảo sát
     * @returns {Object} Mock dashboard data
     */
    getMockDashboardData: (surveyId) => {
        console.log('📊 Using mock data for dashboard due to authentication issues');

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        return {
            overview: {
                surveyId: surveyId,
                surveyTitle: `Survey ${surveyId}`,
                totalResponses: 128,
                viewership: 1000,
                completionRate: 95.5,
                avgCompletionTime: '3.2m',
                status: 'active',
                createdAt: yesterday.toISOString(),
                lastResponseAt: now.toISOString()
            },
            timeline: {
                surveyId: surveyId,
                surveyTitle: `Survey ${surveyId}`,
                daily: [
                    {
                        date: now.toISOString().split('T')[0],
                        count: 15,
                        completed: 14,
                        partial: 1
                    },
                    {
                        date: yesterday.toISOString().split('T')[0],
                        count: 12,
                        completed: 11,
                        partial: 1
                    },
                    {
                        date: twoDaysAgo.toISOString().split('T')[0],
                        count: 8,
                        completed: 7,
                        partial: 1
                    }
                ],
                hourly: []
            },
            questionCounts: {
                surveyId: surveyId,
                total: 10,
                byType: {
                    'multiple_choice': 4,
                    'single_choice': 2,
                    'open_ended': 2,
                    'boolean_': 1,
                    'rating': 1
                }
            },
            success: true,
            isRealData: false,
            fallbackReason: 'StatisticsController authentication not configured'
        };
    },

    /**
     * Track view cho survey bằng cách gọi public endpoint
     * GET /surveys/{id}/public - Tự động tăng view count
     * @param {number} surveyId - ID khảo sát
     * @returns {Promise<Object>} SurveyPublicResponseDTO
     */
    trackSurveyView: async (surveyId) => {
        try {
            console.log('👁️ Tracking view for survey:', surveyId);
            const response = await apiClient.get(`/surveys/${surveyId}/public`);
            console.log('✅ Successfully tracked view for survey:', surveyId);
            return response.data;
        } catch (error) {
            console.error('❌ Track survey view error:', error);
            throw error;
        }
    },

    /**
     * Lấy thông tin public của survey (kèm track view)
     * Sử dụng endpoint không yêu cầu authentication
     * @param {number} surveyId - ID khảo sát 
     * @returns {Promise<Object>} SurveyPublicResponseDTO
     */
    getSurveyPublicInfo: async (surveyId) => {
        try {
            const response = await apiClient.get(`/surveys/${surveyId}/public`);
            return response.data;
        } catch (error) {
            console.error('❌ Get survey public info error:', error);
            throw error;
        }
    },

    /**
     * Helper function để tăng view count khi người dùng click vào link survey
     * @param {number} surveyId - ID khảo sát
     * @returns {Promise<boolean>} True nếu track view thành công
     */
    incrementViewCount: async (surveyId) => {
        try {
            await dashboardReportService.trackSurveyView(surveyId);
            return true;
        } catch (error) {
            console.error('❌ Failed to increment view count:', error);
            return false;
        }
    },

    /**
     * Kiểm tra xem StatisticsController APIs có hoạt động không
     * @param {number} surveyId - ID khảo sát để test
     * @returns {Promise<boolean>} True nếu APIs hoạt động
     */
    testApiAvailability: async (surveyId) => {
        try {
            await dashboardReportService.getSurveyOverview(surveyId);
            return true;
        } catch (error) {
            if (error.response?.status === 401) {
                console.warn('🔐 StatisticsController requires authentication setup on backend');
            } else if (error.response?.status === 404) {
                console.warn('🚫 StatisticsController endpoints not found');
            } else {
                console.warn('⚠️ StatisticsController APIs unavailable:', error.message);
            }
            return false;
        }
    }
};

// Export individual functions for easy importing
export const {
    getSurveyOverview,
    getSurveyTimeline,
    getSurveyQuestionCounts,
    getDashboardData,
    trackSurveyView,
    getSurveyPublicInfo,
    incrementViewCount,
    testApiAvailability
} = dashboardReportService;

export default dashboardReportService;

/**
 * 📋 HƯỚNG DẪN SỬ DỤNG TRACK VIEW:
 * 
 * 1. Khi tạo link chia sẻ survey:
 *    - Link sẽ có dạng: /response/{surveyId}
 *    - Khi người dùng truy cập link này, PublicResponsePage sẽ tự động gọi trackSurveyView()
 * 
 * 2. Tracking sẽ diễn ra tự động tại:
 *    - PublicResponsePage.jsx (khi load survey form)
 *    - Hoặc bất kỳ component nào render public survey
 * 
 * 3. View count sẽ được lưu ở backend và hiển thị trong DashboardReportPage
 * 
 * 4. Để test view count:
 *    - Sử dụng button "Test View" trong DashboardReportPage
 *    - Hoặc gọi trực tiếp incrementViewCount(surveyId)
 * 
 * Example usage:
 * ```javascript
 * import { incrementViewCount } from './dashboardReportService';
 * 
 * // Trong PublicResponsePage.jsx
 * useEffect(() => {
 *   if (surveyId) {
 *     incrementViewCount(surveyId);
 *   }
 * }, [surveyId]);
 * ```
 */