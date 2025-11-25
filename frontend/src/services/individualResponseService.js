import { apiClient } from './authService';

/**
 * Service quản lý các phản hồi cá nhân (Individual Responses)
 * Đồng bộ hoàn toàn với ResponseController.java backend
 * 
 * Backend Controller: ResponseController
 * Base URL: /api
 */

export const individualResponseService = {

    /**
     * Lấy danh sách phản hồi với phân trang, lọc và tìm kiếm
     * GET /api/surveys/{surveyId}/responses
     * 
     * Backend Implementation:
     * - @GetMapping("/api/surveys/{surveyId}/responses")
     * - ResponsePageDTO<ResponseSummaryDTO> listResponses(@PathVariable Long surveyId, ResponseFilterRequestDTO filter)
     * 
     * @param {number} surveyId - ID của khảo sát
     * @param {Object} filter - Đối tượng filter với các thuộc tính:
     *   - page: Số trang (mặc định: 0)
     *   - size: Kích thước trang (mặc định: 10)
     *   - sort: Sắp xếp theo field và hướng (mặc định: "submittedAt,desc")
     *   - userId: Lọc theo ID người dùng (optional)
     *   - requestToken: Lọc theo request token (optional)
     *   - completionStatus: Trạng thái hoàn thành - "completed" | "partial" | "dropped" (optional)
     *   - search: Tìm kiếm trong answers (optional)
     *   - from: Lọc từ thời gian (ISO DateTime string, optional)
     *   - to: Lọc đến thời gian (ISO DateTime string, optional)
     * @returns {Promise<ResponsePageDTO<ResponseSummaryDTO>>} Kết quả phân trang với danh sách ResponseSummaryDTO
     */
    listResponses: async (surveyId, filter = {}) => {
        try {
            console.log('📋 Lấy danh sách phản hồi cho survey:', surveyId, 'với filter:', filter);

            // Chuyển đổi filter object thành query params
            const params = {
                page: filter.page !== undefined ? filter.page : 0,
                size: filter.size !== undefined ? filter.size : 10,
                ...(filter.sort && { sort: filter.sort }),
                ...(filter.userId && { userId: filter.userId }),
                ...(filter.requestToken && { requestToken: filter.requestToken }),
                ...(filter.completionStatus && { completionStatus: filter.completionStatus }),
                ...(filter.search && { search: filter.search }),
                ...(filter.from && { from: filter.from }),
                ...(filter.to && { to: filter.to })
            };

            const response = await apiClient.get(`/api/surveys/${surveyId}/responses`, { params });
            console.log('✅ Lấy danh sách phản hồi thành công:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Lỗi khi lấy danh sách phản hồi:', error);
            throw error;
        }
    },

    /**
     * Lấy chi tiết một phản hồi với tất cả câu trả lời
     * GET /api/responses/{responseId}
     * 
     * Backend Implementation:
     * - @GetMapping("/api/responses/{responseId}")
     * - ResponseWithAnswersDTO getResponseDetail(@PathVariable Long responseId)
     * 
     * @param {number} responseId - ID của phản hồi
     * @returns {Promise<ResponseWithAnswersDTO>} Chi tiết phản hồi bao gồm tất cả answers
     */
    getResponseDetail: async (responseId) => {
        try {
            console.log('🔍 Lấy chi tiết phản hồi:', responseId);
            const response = await apiClient.get(`/api/responses/${responseId}`);
            console.log('✅ Lấy chi tiết phản hồi thành công:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Lỗi khi lấy chi tiết phản hồi:', error);
            throw error;
        }
    },

    /**
     * Xuất danh sách phản hồi ra file CSV hoặc Excel
     * POST /api/surveys/{surveyId}/responses/export
     * 
     * Backend Implementation:
     * - @PostMapping("/api/surveys/{surveyId}/responses/export")
     * - ResponseEntity<byte[]> exportResponses(
     *     @PathVariable Long surveyId,
     *     @RequestParam(name = "format", defaultValue = "csv") String format,
     *     @RequestParam(name = "includeAnswers", defaultValue = "true") boolean includeAnswers,
     *     ResponseFilterRequestDTO filter)
     * 
     * @param {number} surveyId - ID của khảo sát
     * @param {Object} options - Tùy chọn export:
     *   - format: Định dạng file - "csv" hoặc "excel" (mặc định: "csv")
     *   - includeAnswers: Có bao gồm câu trả lời chi tiết không (mặc định: true)
     *   - filter: Đối tượng filter tương tự listResponses (optional)
     * @returns {Promise<Blob>} File blob để download
     */
    exportResponses: async (surveyId, options = {}) => {
        try {
            console.log('📥 Xuất danh sách phản hồi cho survey:', surveyId, 'với options:', options);

            const format = options.format || 'csv';
            const includeAnswers = options.includeAnswers !== undefined ? options.includeAnswers : true;

            // Chuẩn bị params từ filter object
            const params = {
                format,
                includeAnswers
            };

            // Thêm các filter params nếu có
            if (options.filter) {
                const filter = options.filter;
                if (filter.page !== undefined) params.page = filter.page;
                if (filter.size !== undefined) params.size = filter.size;
                if (filter.sort) params.sort = filter.sort;
                if (filter.userId) params.userId = filter.userId;
                if (filter.requestToken) params.requestToken = filter.requestToken;
                if (filter.completionStatus) params.completionStatus = filter.completionStatus;
                if (filter.search) params.search = filter.search;
                if (filter.from) params.from = filter.from;
                if (filter.to) params.to = filter.to;
            }

            // Gọi API với responseType là blob để nhận file
            const response = await apiClient.post(
                `/api/surveys/${surveyId}/responses/export`,
                {},
                {
                    params,
                    responseType: 'blob'
                }
            );

            console.log('✅ Xuất file thành công:', format);

            // Tạo blob URL và trigger download
            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Đặt tên file với format và timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const extension = format === 'excel' ? 'xlsx' : 'csv';
            link.download = `survey-${surveyId}-responses-${timestamp}.${extension}`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            return blob;
        } catch (error) {
            console.error('❌ Lỗi khi xuất danh sách phản hồi:', error);
            throw error;
        }
    },

    /**
     * Xóa hàng loạt các phản hồi
     * DELETE /api/surveys/{surveyId}/responses
     * 
     * Backend Implementation:
     * - @DeleteMapping("/api/surveys/{surveyId}/responses")
     * - ResponseEntity<Map<String, Object>> bulkDelete(
     *     @PathVariable Long surveyId,
     *     @RequestBody List<Long> responseIds)
     * 
     * @param {number} surveyId - ID của khảo sát
     * @param {Array<number>} responseIds - Mảng ID các phản hồi cần xóa
     * @returns {Promise<Object>} Kết quả xóa với format: { deleted: number, requested: number }
     */
    bulkDeleteResponses: async (surveyId, responseIds) => {
        try {
            console.log('🗑️ Xóa hàng loạt phản hồi cho survey:', surveyId, 'IDs:', responseIds);

            if (!Array.isArray(responseIds) || responseIds.length === 0) {
                throw new Error('responseIds phải là một mảng không rỗng');
            }

            const response = await apiClient.delete(`/api/surveys/${surveyId}/responses`, {
                data: responseIds
            });

            console.log('✅ Xóa hàng loạt phản hồi thành công:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Lỗi khi xóa hàng loạt phản hồi:', error);
            throw error;
        }
    },

    /**
     * Submit phản hồi khảo sát (không có file)
     * POST /responses
     * 
     * Backend Implementation:
     * - @PostMapping("/responses")
     * - ResponseWithAnswersDTO submitResponse(@Valid @RequestBody ResponseSubmitRequestDTO request)
     * 
     * Note: API này có thể đã có trong responseService.js, nhưng được thêm vào đây để đảm bảo đầy đủ
     * 
     * @param {Object} request - Request payload:
     *   - surveyId: ID của khảo sát
     *   - requestToken: Token yêu cầu (optional)
     *   - answers: Mảng các câu trả lời
     * @returns {Promise<ResponseWithAnswersDTO>} Phản hồi đã được submit
     */
    submitResponse: async (request) => {
        try {
            console.log('📝 Submit phản hồi khảo sát:', request);
            const response = await apiClient.post('/responses', request);
            console.log('✅ Submit phản hồi thành công:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Lỗi khi submit phản hồi:', error);
            throw error;
        }
    },

    /**
     * Submit phản hồi khảo sát với file đính kèm (multipart/form-data)
     * POST /responses/with-files
     * 
     * Backend Implementation:
     * - @PostMapping("/responses/with-files")
     * - ResponseWithAnswersDTO submitResponseWithFiles(
     *     @RequestParam("surveyId") Long surveyId,
     *     @RequestParam("answers") String answersJson,
     *     @RequestParam Map<String, MultipartFile> files)
     * 
     * @param {number} surveyId - ID của khảo sát
     * @param {Array|Object} answers - Mảng hoặc object các câu trả lời (sẽ được stringify thành JSON)
     * @param {Object} files - Object chứa các file đính kèm, key là tên field
     * @returns {Promise<ResponseWithAnswersDTO>} Phản hồi đã được submit với file
     */
    submitResponseWithFiles: async (surveyId, answers, files = {}) => {
        try {
            console.log('📎 Submit phản hồi khảo sát với file:', surveyId, 'files:', Object.keys(files));

            // Tạo FormData cho multipart/form-data
            const formData = new FormData();
            formData.append('surveyId', surveyId.toString());
            formData.append('answers', JSON.stringify(answers));

            // Thêm các file vào FormData
            Object.keys(files).forEach((key) => {
                const file = files[key];
                if (file instanceof File) {
                    formData.append(key, file);
                } else if (file instanceof Blob) {
                    formData.append(key, file);
                } else {
                    console.warn('⚠️ File không hợp lệ cho key:', key, file);
                }
            });

            const response = await apiClient.post('/responses/with-files', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            console.log('✅ Submit phản hồi với file thành công:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Lỗi khi submit phản hồi với file:', error);
            throw error;
        }
    },

    /**
     * View file by ID with authentication
     * GET /api/files/download/{fileId}
     */
    viewFile: async (fileId) => {
        try {
            console.log('👁️ Viewing file:', fileId);
            const response = await apiClient.get(`/api/files/download/${fileId}`, {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            console.error('❌ Lỗi khi xem file:', error);
            throw error;
        }
    },

    /**
     * Download file by ID with authentication
     * GET /api/files/download/{fileId}
     */
    downloadFile: async (fileId, originalFileName) => {
        try {
            console.log('⬇️ Downloading file:', fileId, originalFileName);
            const response = await apiClient.get(`/api/files/download/${fileId}`, {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            console.error('❌ Lỗi khi tải file:', error);
            throw error;
        }
    }
};

// Export individual functions for easy importing
export const {
    listResponses,
    getResponseDetail,
    exportResponses,
    bulkDeleteResponses,
    submitResponse,
    submitResponseWithFiles,
    viewFile,
    downloadFile
} = individualResponseService;

export default individualResponseService;

