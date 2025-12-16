import { apiClient } from './authService';

/**
 * Dịch vụ Export Report
 * Đồng bộ với các API backend từ ResponseController.java và StatisticsController.java
 * Tập trung vào các chức năng export và quản lý responses cho báo cáo
 */
export const exportReportService = {

    /**
     * Export responses sang CSV hoặc Excel
     * GET /api/surveys/{surveyId}/responses/export
     * @param {number} surveyId - ID của khảo sát
     * @param {Object} options - Tùy chọn export
     * @param {string} options.format - Định dạng export: 'csv' hoặc 'excel' (mặc định: 'csv')
     * @param {boolean} options.includeAnswers - Có bao gồm câu trả lời chi tiết không (mặc định: true)
     * @param {Object} options.filter - Bộ lọc responses (ResponseFilterRequestDTO)
     * @param {number} options.filter.page - Số trang (mặc định: 0)
     * @param {number} options.filter.size - Số lượng mỗi trang (mặc định: 10)
     * @param {string} options.filter.sort - Sắp xếp theo (mặc định: 'submittedAt,desc')
     * @param {number} options.filter.userId - Lọc theo user ID
     * @param {string} options.filter.requestToken - Lọc theo request token
     * @param {string} options.filter.completionStatus - Trạng thái hoàn thành: 'completed' | 'partial' | 'dropped'
     * @param {string} options.filter.search - Tìm kiếm trong câu trả lời
     * @param {string} options.filter.from - Thời gian bắt đầu (ISO date string)
     * @param {string} options.filter.to - Thời gian kết thúc (ISO date string)
     * @returns {Promise<Blob>} File blob để download
     */
    exportResponses: async (surveyId, options = {}) => {
        try {
            const {
                format = 'csv',
                includeAnswers = true,
                filter = {}
            } = options;

            // Chuyển đổi format 'excel' thành 'xlsx' cho API backend
            const apiFormat = format === 'excel' ? 'xlsx' : format;

            // Xây dựng query parameters
            const params = {
                format: apiFormat,
                includeAnswers
            };

            // Thêm các tham số filter vào query params
            if (filter.page !== undefined) params.page = filter.page;
            if (filter.size !== undefined) params.size = filter.size;
            if (filter.sort) params.sort = filter.sort;
            if (filter.userId !== undefined) params.userId = filter.userId;
            if (filter.requestToken) params.requestToken = filter.requestToken;
            if (filter.completionStatus) params.completionStatus = filter.completionStatus;
            if (filter.search) params.search = filter.search;
            if (filter.from) params.from = filter.from;
            if (filter.to) params.to = filter.to;

            const response = await apiClient.get(`/api/surveys/${surveyId}/responses/export`, {
                params,
                responseType: 'blob' // Quan trọng: để nhận file binary
            });

            return response.data;
        } catch (error) {
            console.error('❌ Export responses error:', error);
            throw error;
        }
    },

    /**
     * Xuất báo cáo PDF với biểu đồ cho survey
     * GET /api/surveys/{surveyId}/results/export-pdf
     * Chỉ OWNER và ANALYST mới có quyền xem báo cáo (kiểm tra trong StatisticsService)
     * @param {number} surveyId - ID của khảo sát
     * @returns {Promise<Blob>} File PDF blob để download
     * @throws {Error} 403 FORBIDDEN - Không có quyền truy cập (chỉ OWNER và ANALYST)
     * @throws {Error} 404 NOT_FOUND - Survey không tồn tại
     * @throws {Error} 500 INTERNAL_SERVER_ERROR - Lỗi hệ thống khi xuất PDF
     */
    exportSurveyReportPDF: async (surveyId) => {
        try {
            const response = await apiClient.get(`/api/surveys/${surveyId}/results/export-pdf`, {
                responseType: 'blob' // Quan trọng: để nhận file binary
            });

            return response.data;
        } catch (error) {
            console.error('❌ Export survey report PDF error:', error);

            // Xử lý các lỗi đặc biệt từ backend
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;

                if (status === 403) {
                    const errorMessage = data?.message || 'Không có quyền truy cập. Chỉ OWNER và ANALYST mới có quyền xuất báo cáo PDF.';
                    const customError = new Error(errorMessage);
                    customError.status = 403;
                    customError.isPermissionError = true;
                    throw customError;
                } else if (status === 404) {
                    const errorMessage = data?.message || 'Khảo sát không tồn tại.';
                    const customError = new Error(errorMessage);
                    customError.status = 404;
                    throw customError;
                } else if (status === 500) {
                    const errorMessage = data?.message || 'Lỗi hệ thống khi xuất PDF.';
                    const customError = new Error(errorMessage);
                    customError.status = 500;
                    throw customError;
                }
            }

            throw error;
        }
    },

    /**
     * Lấy danh sách responses với phân trang và filter
     * GET /api/surveys/{surveyId}/responses
     * @param {number} surveyId - ID của khảo sát
     * @param {Object} filter - Bộ lọc responses (ResponseFilterRequestDTO)
     * @param {number} filter.page - Số trang (mặc định: 0)
     * @param {number} filter.size - Số lượng mỗi trang (mặc định: 10)
     * @param {string} filter.sort - Sắp xếp theo (mặc định: 'submittedAt,desc')
     * @param {number} filter.userId - Lọc theo user ID
     * @param {string} filter.requestToken - Lọc theo request token
     * @param {string} filter.completionStatus - Trạng thái hoàn thành: 'completed' | 'partial' | 'dropped'
     * @param {string} filter.search - Tìm kiếm trong câu trả lời
     * @param {string} filter.from - Thời gian bắt đầu (ISO date string)
     * @param {string} filter.to - Thời gian kết thúc (ISO date string)
     * @returns {Promise<Object>} ResponsePageDTO<ResponseSummaryDTO> với meta và data
     */
    listResponses: async (surveyId, filter = {}) => {
        try {
            const params = {
                page: filter.page ?? 0,
                size: filter.size ?? 10,
                sort: filter.sort ?? 'submittedAt,desc'
            };

            // Thêm các tham số filter tùy chọn
            if (filter.userId !== undefined) params.userId = filter.userId;
            if (filter.requestToken) params.requestToken = filter.requestToken;
            if (filter.completionStatus) params.completionStatus = filter.completionStatus;
            if (filter.search) params.search = filter.search;
            if (filter.from) params.from = filter.from;
            if (filter.to) params.to = filter.to;

            const response = await apiClient.get(`/api/surveys/${surveyId}/responses`, {
                params
            });

            return response.data;
        } catch (error) {
            console.error('❌ List responses error:', error);
            throw error;
        }
    },

    /**
     * Lấy chi tiết một response với tất cả câu trả lời
     * GET /api/responses/{responseId}
     * @param {number} responseId - ID của response
     * @returns {Promise<Object>} ResponseWithAnswersDTO
     */
    getResponseDetail: async (responseId) => {
        try {
            const response = await apiClient.get(`/api/responses/${responseId}`);
            return response.data;
        } catch (error) {
            console.error('❌ Get response detail error:', error);
            throw error;
        }
    },

    /**
     * Xóa nhiều responses cùng lúc
     * DELETE /api/surveys/{surveyId}/responses
     * @param {number} surveyId - ID của khảo sát
     * @param {Array<number>} responseIds - Mảng ID của các responses cần xóa
     * @returns {Promise<Object>} Object chứa deleted (số lượng đã xóa) và requested (số lượng yêu cầu)
     */
    bulkDeleteResponses: async (surveyId, responseIds) => {
        try {
            if (!Array.isArray(responseIds) || responseIds.length === 0) {
                throw new Error('responseIds must be a non-empty array');
            }

            const response = await apiClient.delete(`/api/surveys/${surveyId}/responses`, {
                data: responseIds
            });

            return response.data;
        } catch (error) {
            console.error('❌ Bulk delete responses error:', error);
            throw error;
        }
    },

    /**
     * Helper function: Download file export với tên file tự động
     * @param {Blob} blob - File blob từ exportResponses
     * @param {string} surveyId - ID của khảo sát (để tạo tên file)
     * @param {string} format - Định dạng file: 'csv' hoặc 'excel'
     */
    downloadExportFile: (blob, surveyId, format = 'csv') => {
        try {
            // Tạo tên file với timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const extension = format === 'excel' ? 'xlsx' : 'csv';
            const filename = `survey-${surveyId}-responses-${timestamp}.${extension}`;

            // Tạo URL từ blob và trigger download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('❌ Download export file error:', error);
            throw error;
        }
    },

    /**
     * Helper function: Export và tự động download file
     * @param {number} surveyId - ID của khảo sát
     * @param {Object} options - Tùy chọn export (giống exportResponses)
     * @returns {Promise<void>}
     */
    exportAndDownload: async (surveyId, options = {}) => {
        try {
            const blob = await exportReportService.exportResponses(surveyId, options);
            exportReportService.downloadExportFile(blob, surveyId, options.format || 'csv');
        } catch (error) {
            console.error('❌ Export and download error:', error);
            throw error;
        }
    },

    /**
     * Helper function: Download file PDF với tên file tự động
     * @param {Blob} blob - File PDF blob từ exportSurveyReportPDF
     * @param {number} surveyId - ID của khảo sát (để tạo tên file)
     */
    downloadPDFFile: (blob, surveyId) => {
        try {
            // Tạo tên file với timestamp theo format yyyyMMdd_HHmmss (giống backend)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
            const filename = `survey_report_${surveyId}_${timestamp}.pdf`;

            // Tạo URL từ blob và trigger download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('❌ Download PDF file error:', error);
            throw error;
        }
    },

    /**
     * Helper function: Export PDF và tự động download file
     * @param {number} surveyId - ID của khảo sát
     * @returns {Promise<void>}
     */
    exportAndDownloadPDF: async (surveyId) => {
        try {
            const blob = await exportReportService.exportSurveyReportPDF(surveyId);
            exportReportService.downloadPDFFile(blob, surveyId);
        } catch (error) {
            console.error('❌ Export and download PDF error:', error);
            throw error;
        }
    }
};

// Export individual functions for easy importing
export const {
    exportResponses,
    exportSurveyReportPDF,
    listResponses,
    getResponseDetail,
    bulkDeleteResponses,
    downloadExportFile,
    downloadPDFFile,
    exportAndDownload,
    exportAndDownloadPDF
} = exportReportService;

export default exportReportService;
