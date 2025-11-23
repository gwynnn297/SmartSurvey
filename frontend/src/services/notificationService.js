import { apiClient } from './authService';

export const notificationService = {
    /**
     * GET /api/notifications
     * Lấy danh sách notifications của user hiện tại
     */
    getNotifications: async () => {
        try {
            const response = await apiClient.get('/api/notifications');
            return response.data;
        } catch (error) {
            console.error('Get notifications error:', error);
            throw error;
        }
    },

    /**
     * GET /api/notifications/unread
     * Lấy danh sách notifications chưa đọc
     */
    getUnreadNotifications: async () => {
        try {
            const response = await apiClient.get('/api/notifications/unread');
            return response.data;
        } catch (error) {
            console.error('Get unread notifications error:', error);
            throw error;
        }
    },

    /**
     * GET /api/notifications/unread/count
     * Đếm số notifications chưa đọc
     */
    getUnreadCount: async () => {
        try {
            const response = await apiClient.get('/api/notifications/unread/count');
            return response.data;
        } catch (error) {
            console.error('Get unread count error:', error);
            throw error;
        }
    },

    /**
     * PUT /api/notifications/{notificationId}/read
     * Đánh dấu notification là đã đọc
     */
    markAsRead: async (notificationId) => {
        try {
            const response = await apiClient.put(`/api/notifications/${notificationId}/read`);
            return response.data;
        } catch (error) {
            console.error('Mark notification as read error:', error);
            throw error;
        }
    },

    /**
     * PUT /api/notifications/read-all
     * Đánh dấu tất cả notifications là đã đọc
     */
    markAllAsRead: async () => {
        try {
            const response = await apiClient.put('/api/notifications/read-all');
            return response.data;
        } catch (error) {
            console.error('Mark all notifications as read error:', error);
            throw error;
        }
    }
};

export default notificationService;

