import { apiClient } from './authService';

// Team Management service - xử lý các API liên quan đến team management
export const teamManagementService = {

    /**
     * POST /api/teams
     * Tạo team mới
     */
    createTeam: async (data) => {
        try {
            console.log('Creating team with data:', data);
            console.log('API endpoint: /api/teams');
            const response = await apiClient.post('/api/teams', data);
            console.log('Team created successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Create team error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                baseURL: error.config?.baseURL
            });
            throw error;
        }
    },

    /**
     * PUT /api/teams/{teamId}
     * Cập nhật thông tin team (name, description)
     * Chỉ OWNER của team được phép cập nhật
     */
    updateTeam: async (teamId, data) => {
        try {
            console.log(`Updating team ${teamId}:`, data);
            const response = await apiClient.put(`/api/teams/${teamId}`, data);
            console.log('Team updated:', response.data);
            return response.data;
        } catch (error) {
            console.error('Update team error:', error);
            throw error;
        }
    },

    /**
     * DELETE /api/teams/{teamId}
     * Xóa team
     * Chỉ OWNER của team được phép xóa
     */
    deleteTeam: async (teamId) => {
        try {
            // Kiểm tra token trước khi gọi
            const token = localStorage.getItem('token');
            console.log(`[teamManagementService] Deleting team ${teamId}`);
            console.log(`[teamManagementService] Token exists: ${!!token}`);
            
            if (!token) {
                throw new Error('No authentication token found. Please login again.');
            }
            
            const response = await apiClient.delete(`/api/teams/${teamId}`);
            console.log('[teamManagementService] Team deleted successfully:', response.status);
            return response.data;
        } catch (error) {
            console.error('[teamManagementService] Delete team error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url,
                headers: error.config?.headers
            });
            throw error;
        }
    },

    /**
     * POST /api/teams/{teamId}/invitations
     * Gửi lời mời tham gia team
     * Chỉ OWNER của team được phép gửi invitation
     */
    sendInvitation: async (teamId, data) => {
        try {
            console.log(`Sending invitation for team ${teamId}:`, data);
            const response = await apiClient.post(`/api/teams/${teamId}/invitations`, data);
            console.log('Invitation sent:', response.data);
            return response.data;
        } catch (error) {
            console.error('Send invitation error:', error);
            throw error;
        }
    },

    /**
     * DELETE /api/teams/{teamId}/members/{memberId}
     * Xóa thành viên khỏi team
     * Chỉ OWNER của team được phép xóa thành viên
     * @param {number} teamId - ID của team
     * @param {number} memberId - ID của thành viên cần xóa
     * @returns {Promise<Object>} TeamResponseDTO - Thông tin team sau khi xóa thành viên
     */
    removeMember: async (teamId, memberId) => {
        try {
            console.log(`[teamManagementService] Removing member ${memberId} from team ${teamId}`);
            const response = await apiClient.delete(`/api/teams/${teamId}/members/${memberId}`);
            console.log('[teamManagementService] Member removed, team updated:', response.data);
            return response.data; // Returns TeamResponseDTO
        } catch (error) {
            console.error('[teamManagementService] Remove member error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url
            });
            throw error;
        }
    },

    /**
     * GET /api/teams/{teamId}/members
     * Lấy danh sách members của team
     * Chỉ OWNER hoặc MEMBER của team mới có quyền xem
     */
    getTeamMembers: async (teamId) => {
        try {
            const response = await apiClient.get(`/api/teams/${teamId}/members`);
            return response.data;
        } catch (error) {
            console.error('Get team members error:', error);
            throw error;
        }
    },

    /**
     * GET /api/teams/{teamId}
     * Lấy thông tin team
     */
    getTeamById: async (teamId) => {
        try {
            const response = await apiClient.get(`/api/teams/${teamId}`);
            return response.data;
        } catch (error) {
            console.error('Get team by id error:', error);
            throw error;
        }
    },

    /**
     * GET /api/teams
     * Lấy danh sách teams của user hiện tại
     */
    getMyTeams: async () => {
        try {
            const response = await apiClient.get('/api/teams');
            return response.data;
        } catch (error) {
            console.error('Get my teams error:', error);
            throw error;
        }
    },

    /**
     * GET /api/teams/{teamId}/surveys
     * Lấy danh sách surveys được share với team
     */
    getTeamSurveys: async (teamId) => {
        try {
            const response = await apiClient.get(`/api/teams/${teamId}/surveys`);
            return response.data;
        } catch (error) {
            console.error('Get team surveys error:', error);
            throw error;
        }
    },

    /**
     * GET /api/teams/invitations/me
     * Lấy danh sách invitations của user hiện tại
     */
    getMyInvitations: async () => {
        try {
            const response = await apiClient.get('/api/teams/invitations/me');
            return response.data;
        } catch (error) {
            console.error('Get my invitations error:', error);
            throw error;
        }
    },

    /**
     * GET /api/teams/{teamId}/invitations
     * Lấy danh sách invitations của team
     * Chỉ OWNER của team mới có quyền xem
     */
    getTeamInvitations: async (teamId) => {
        try {
            const response = await apiClient.get(`/api/teams/${teamId}/invitations`);
            return response.data;
        } catch (error) {
            console.error('Get team invitations error:', error);
            throw error;
        }
    },

    /**
     * POST /api/teams/invitations/{invitationId}/accept
     * Chấp nhận lời mời tham gia team
     */
    acceptInvitation: async (invitationId) => {
        try {
            console.log(`Accepting invitation ${invitationId}`);
            const response = await apiClient.post(`/api/teams/invitations/${invitationId}/accept`);
            console.log('Invitation accepted:', response.data);
            return response.data;
        } catch (error) {
            console.error('Accept invitation error:', error);
            throw error;
        }
    },

    /**
     * POST /api/teams/invitations/{invitationId}/reject
     * Từ chối lời mời tham gia team
     */
    rejectInvitation: async (invitationId) => {
        try {
            console.log(`Rejecting invitation ${invitationId}`);
            const response = await apiClient.post(`/api/teams/invitations/${invitationId}/reject`);
            console.log('Invitation rejected');
            return response.data;
        } catch (error) {
            console.error('Reject invitation error:', error);
            throw error;
        }
    },

    /**
     * GET /surveys/{id}/permissions
     * Lấy tất cả permissions của survey
     * Chỉ OWNER mới có thể xem permissions
     */
    getSurveyPermissions: async (surveyId) => {
        try {
            const response = await apiClient.get(`/surveys/${surveyId}/permissions`);
            return response.data;
        } catch (error) {
            console.error('Get survey permissions error:', error);
            throw error;
        }
    },

    /**
     * PUT /surveys/{id}/permissions
     * Cập nhật permissions cho survey (create/update/delete)
     */
    updateSurveyPermissions: async (surveyId, data) => {
        try {
            console.log(`Updating permissions for survey ${surveyId}:`, data);
            const response = await apiClient.put(`/surveys/${surveyId}/permissions`, data);
            console.log('Survey permissions updated:', response.data);
            return response.data;
        } catch (error) {
            console.error('Update survey permissions error:', error);
            throw error;
        }
    },

    /**
     * DELETE /surveys/{id}/permissions/{permissionId}
     * Xóa một permission cụ thể
     */
    deleteSurveyPermission: async (surveyId, permissionId) => {
        try {
            console.log(`Deleting permission ${permissionId} from survey ${surveyId}`);
            const response = await apiClient.delete(`/surveys/${surveyId}/permissions/${permissionId}`);
            console.log('Permission deleted');
            return response.data;
        } catch (error) {
            console.error('Delete survey permission error:', error);
            throw error;
        }
    },

    /**
     * GET /api/users/me/dashboard
     * Lấy dashboard của user hiện tại
     */
    getUserDashboard: async () => {
        try {
            const response = await apiClient.get('/api/users/me/dashboard');
            return response.data;
        } catch (error) {
            console.error('Get user dashboard error:', error);
            throw error;
        }
    }
};

export default teamManagementService;

