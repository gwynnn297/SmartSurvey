import { apiClient } from './authService';

/**
 * Dịch vụ Dashboard Report
 * Đồng bộ với các API backend từ ResponseController.java
 */
export const dashboardReportService = {
    /**
     * Gửi phản hồi khảo sát
     * POST /responses
     * @param {Object} requestData - Dữ liệu phản hồi
     * @param {number} requestData.surveyId - ID khảo sát
     * @param {string} requestData.requestToken - Token yêu cầu (tùy chọn)
     * @param {Array} requestData.answers - Mảng các câu trả lời
     * @returns {Promise<Object>} Phản hồi kèm câu trả lời
     */
    submitResponse: async (requestData) => {
        try {
            const response = await apiClient.post('/responses', requestData);
            return response.data;
        } catch (error) {
            console.error('❌ Submit response error:', error);
            throw error;
        }
    },

    /**
     * Gửi phản hồi khảo sát kèm tệp tin
     * POST /responses/with-files
     * @param {number} surveyId - ID khảo sát
     * @param {string} answersJson - Chuỗi JSON của câu trả lời
     * @param {Object} files - Đối tượng tệp tin (cặp key-value)
     * @returns {Promise<Object>} Phản hồi kèm câu trả lời
     */
    submitResponseWithFiles: async (surveyId, answersJson, files) => {
        try {
            const formData = new FormData();
            formData.append('surveyId', surveyId);
            formData.append('answers', answersJson);

            // Thêm tệp tin vào form data
            Object.entries(files).forEach(([key, file]) => {
                if (file) {
                    formData.append(key, file);
                }
            });

            const response = await apiClient.post('/responses/with-files', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            console.error('❌ Submit response with files error:', error);
            throw error;
        }
    },

    /**
     * Lấy danh sách phản hồi với phân trang, lọc và tìm kiếm
     * GET /api/surveys/{surveyId}/responses
     * @param {number} surveyId - ID khảo sát
     * @param {Object} filter - Tham số lọc
     * @param {number} filter.page - Số trang (mặc định: 0)
     * @param {number} filter.size - Kích thước trang (mặc định: 10)
     * @param {string} filter.search - Từ khóa tìm kiếm (tùy chọn)
     * @param {string} filter.sortBy - Trường sắp xếp (tùy chọn)
     * @param {string} filter.sortDir - Hướng sắp xếp (tùy chọn: asc, desc)
     * @returns {Promise<Object>} Dữ liệu phản hồi có phân trang
     */
    listResponses: async (surveyId, filter = {}) => {
        try {
            const params = new URLSearchParams();

            // Thêm tham số lọc vào query string
            Object.entries(filter).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.append(key, value);
                }
            });

            const response = await apiClient.get(`/api/surveys/${surveyId}/responses?${params.toString()}`);
            return response.data;
        } catch (error) {
            console.error('❌ List responses error:', error);
            throw error;
        }
    },

    /**
     * Lấy chi tiết phản hồi kèm tất cả câu trả lời
     * GET /api/responses/{responseId}
     * @param {number} responseId - ID phản hồi
     * @returns {Promise<Object>} Chi tiết phản hồi kèm câu trả lời
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
     * Xuất phản hồi ra CSV/Excel
     * POST /api/surveys/{surveyId}/responses/export
     * @param {number} surveyId - ID khảo sát
     * @param {Object} options - Tùy chọn xuất
     * @param {string} options.format - Định dạng xuất (csv, excel) mặc định: csv
     * @param {boolean} options.includeAnswers - Bao gồm câu trả lời khi xuất mặc định: true
     * @param {Object} options.filter - Tham số lọc (tùy chọn)
     * @returns {Promise<Blob>} File blob để tải về
     */
    exportResponses: async (surveyId, options = {}) => {
        try {
            const params = new URLSearchParams();

            // Thêm tham số format và includeAnswers
            params.append('format', options.format || 'csv');
            params.append('includeAnswers', options.includeAnswers !== false);

            // Thêm tham số lọc nếu có
            if (options.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        params.append(key, value);
                    }
                });
            }

            const response = await apiClient.post(
                `/api/surveys/${surveyId}/responses/export?${params.toString()}`,
                options.filter || {},
                {
                    responseType: 'blob', // Quan trọng cho việc tải file
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error) {
            console.error('❌ Export responses error:', error);
            throw error;
        }
    },

    /**
     * Tải file đã xuất với tên file phù hợp
     * Hàm trợ giúp để kích hoạt tải file
     * @param {Blob} blob - File blob
     * @param {string} format - Định dạng file (csv, excel)
     * @param {string} surveyName - Tên khảo sát cho tên file (tùy chọn)
     */
    downloadExportedFile: (blob, format, surveyName = 'survey') => {
        try {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const extension = format === 'excel' ? 'xlsx' : 'csv';
            a.download = `${surveyName}_responses_${timestamp}.${extension}`;

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('❌ Download exported file error:', error);
            throw error;
        }
    },

    /**
     * Xóa hàng loạt phản hồi
     * DELETE /api/surveys/{surveyId}/responses
     * @param {number} surveyId - ID khảo sát
     * @param {Array<number>} responseIds - Mảng ID phản hồi cần xóa
     * @returns {Promise<Object>} Kết quả xóa kèm số lượng
     */
    bulkDeleteResponses: async (surveyId, responseIds) => {
        try {
            if (!responseIds || responseIds.length === 0) {
                throw new Error('Không có ID phản hồi nào được cung cấp để xóa');
            }

            const response = await apiClient.delete(`/api/surveys/${surveyId}/responses`, {
                data: responseIds,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            return response.data;
        } catch (error) {
            console.error('❌ Bulk delete responses error:', error);
            throw error;
        }
    },

    /**
     * Lấy phản hồi với lọc nâng cao và thống kê
     * Hàm wrapper cho quản lý phản hồi toàn diện
     * @param {number} surveyId - ID khảo sát
     * @param {Object} options - Đối tượng tùy chọn
     * @param {Object} options.filter - Tham số lọc
     * @param {boolean} options.includeStats - Bao gồm thống kê phản hồi
     * @returns {Promise<Object>} Dữ liệu phản hồi được nâng cấp
     */
    getResponsesWithStats: async (surveyId, options = {}) => {
        try {
            const responseData = await dashboardReportService.listResponses(surveyId, options.filter);

            if (options.includeStats) {
                // Thêm các tính toán thống kê bổ sung tại đây nếu cần
                const totalResponses = responseData.totalElements || 0;
                const completionRate = totalResponses > 0 ?
                    ((responseData.content?.filter(r => r.completed)?.length || 0) / totalResponses * 100) : 0;

                responseData.statistics = {
                    totalResponses,
                    completionRate: Math.round(completionRate * 100) / 100,
                    currentPage: responseData.number || 0,
                    totalPages: responseData.totalPages || 0
                };
            }

            return responseData;
        } catch (error) {
            console.error('❌ Get responses with stats error:', error);
            throw error;
        }
    }
};

export default dashboardReportService;
