import { apiClient } from './authService';

/**
 * Admin service - xử lý các API liên quan đến admin
 */
export const adminService = {
  /**
   * Lấy dashboard tổng quan hệ thống
   */
  getDashboard: async () => {
    try {
      const response = await apiClient.get('/api/admin/dashboard');
      return response.data;
    } catch (error) {
      console.error('Get admin dashboard error:', error);
      throw error;
    }
  },

  /**
   * Lấy danh sách users với phân trang và filter
   * @param {number} page - Số trang (bắt đầu từ 0)
   * @param {number} size - Số lượng items mỗi trang
   * @param {string} search - Tìm kiếm theo tên hoặc email
   * @param {string} role - Lọc theo role (admin, creator, respondent)
   * @param {boolean} isActive - Lọc theo trạng thái (true/false)
   */
  getUsers: async (page = 0, size = 10, search = '', role = '', isActive = null) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });
      if (search) params.append('search', search);
      if (role) params.append('role', role);
      if (isActive !== null) params.append('isActive', isActive.toString());
      
      const response = await apiClient.get(`/api/admin/users?${params}`);
      return response.data;
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  },

  /**
   * Tạo user mới
   * @param {object} userData - Dữ liệu user (fullName, email, password, role)
   */
  createUser: async (userData) => {
    try {
      const response = await apiClient.post('/api/admin/users', userData);
      return response.data;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  },

  /**
   * Lấy chi tiết user
   * @param {number} userId - ID của user
   */
  getUserDetail: async (userId) => {
    try {
      const response = await apiClient.get(`/api/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Get user detail error:', error);
      throw error;
    }
  },

  /**
   * Cập nhật thông tin user (fullName, role)
   * @param {number} userId - ID của user
   * @param {string} fullName - Tên mới (optional)
   * @param {string} role - Role mới (optional)
   */
  updateUser: async (userId, fullName = null, role = null) => {
    try {
      const params = new URLSearchParams();
      if (fullName) params.append('fullName', fullName);
      if (role) params.append('role', role);
      
      const response = await apiClient.put(`/api/admin/users/${userId}?${params}`);
      return response.data;
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  },

  /**
   * Cập nhật trạng thái user (active/inactive)
   * @param {number} userId - ID của user
   * @param {boolean} isActive - Trạng thái mới
   */
  updateUserStatus: async (userId, isActive) => {
    try {
      const response = await apiClient.put(`/api/admin/users/${userId}/status`, null, {
        params: { isActive }
      });
      return response.data;
    } catch (error) {
      console.error('Update user status error:', error);
      throw error;
    }
  },

  /**
   * Xóa user
   * @param {number} userId - ID của user
   */
  deleteUser: async (userId) => {
    try {
      const response = await apiClient.delete(`/api/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  },

  /**
   * Lấy danh sách surveys với phân trang và filter
   * @param {number} page - Số trang
   * @param {number} size - Số lượng items mỗi trang
   * @param {string} search - Tìm kiếm theo title
   * @param {string} status - Lọc theo status (draft, published, archived)
   * @param {number} userId - Lọc theo creator ID
   * @param {number} categoryId - Lọc theo category ID
   * @param {string} dateFrom - Ngày bắt đầu (ISO format)
   * @param {string} dateTo - Ngày kết thúc (ISO format)
   */
  getSurveys: async (page = 0, size = 10, search = '', status = '', userId = null, categoryId = null, dateFrom = null, dateTo = null) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      if (userId) params.append('userId', userId.toString());
      if (categoryId) params.append('categoryId', categoryId.toString());
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const response = await apiClient.get(`/api/admin/surveys?${params}`);
      return response.data;
    } catch (error) {
      console.error('Get surveys error:', error);
      throw error;
    }
  },

  /**
   * Lấy chi tiết survey
   * @param {number} surveyId - ID của survey
   */
  getSurveyDetail: async (surveyId) => {
    try {
      const response = await apiClient.get(`/api/admin/surveys/${surveyId}`);
      return response.data;
    } catch (error) {
      console.error('Get survey detail error:', error);
      throw error;
    }
  },

  /**
   * Cập nhật trạng thái survey (chỉ cho phép published hoặc archived)
   * @param {number} surveyId - ID của survey
   * @param {string} status - Trạng thái mới ('published' hoặc 'archived')
   */
  updateSurveyStatus: async (surveyId, status) => {
    try {
      const response = await apiClient.put(`/api/admin/surveys/${surveyId}/status`, null, {
        params: { status }
      });
      return response.data;
    } catch (error) {
      console.error('Update survey status error:', error);
      throw error;
    }
  },

  /**
   * Xóa survey
   * @param {number} surveyId - ID của survey
   */
  deleteSurvey: async (surveyId) => {
    try {
      const response = await apiClient.delete(`/api/admin/surveys/${surveyId}`);
      return response.data;
    } catch (error) {
      console.error('Delete survey error:', error);
      throw error;
    }
  },

  /**
   * Lấy danh sách admin notifications (audit logs) - cho User history
   * @param {number} page - Số trang
   * @param {number} size - Số lượng items mỗi trang
   * @param {number} userId - Lọc theo user ID
   * @param {string} type - Lọc theo notification type
   * @param {boolean} isRead - Lọc theo trạng thái đọc
   * @param {string} dateFrom - Ngày bắt đầu
   * @param {string} dateTo - Ngày kết thúc
   */
  getAdminNotifications: async (page = 0, size = 10, userId = null, type = '', isRead = null, dateFrom = null, dateTo = null) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });
      if (userId) params.append('userId', userId.toString());
      if (type) params.append('type', type);
      if (isRead !== null) params.append('isRead', isRead.toString());
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const response = await apiClient.get(`/api/admin/notifications?${params}`);
      return response.data;
    } catch (error) {
      console.error('Get admin notifications error:', error);
      throw error;
    }
  },

  /**
   * Lấy danh sách activity logs - cho Survey history
   * @param {number} page - Số trang
   * @param {number} size - Số lượng items mỗi trang
   * @param {number} userId - Lọc theo user ID
   * @param {string} actionType - Lọc theo action type
   * @param {string} dateFrom - Ngày bắt đầu
   * @param {string} dateTo - Ngày kết thúc
   */
  getActivityLogs: async (page = 0, size = 10, userId = null, actionType = '', dateFrom = null, dateTo = null) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });
      if (userId) params.append('userId', userId.toString());
      if (actionType) params.append('actionType', actionType);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const response = await apiClient.get(`/api/admin/activity-logs?${params}`);
      return response.data;
    } catch (error) {
      console.error('Get activity logs error:', error);
      throw error;
    }
  }
};

export default adminService;



