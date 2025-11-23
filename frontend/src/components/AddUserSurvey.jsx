import React, { useState, useEffect } from 'react';
import { teamManagementService } from '../services/teamManagementService';
import { surveyService } from '../services/surveyService';
import './AddUserSurvey.css';

const AddUserSurvey = ({
    surveyId,
    isOpen,
    onClose,
    onNotification
}) => {
    const [surveyPermissions, setSurveyPermissions] = useState([]);
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('VIEWER');
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [surveyOwner, setSurveyOwner] = useState(null);

    // Load current user info
    useEffect(() => {
        const loadCurrentUser = async () => {
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    setCurrentUser(user);
                }
            } catch (error) {
                console.error('Error loading current user:', error);
            }
        };
        loadCurrentUser();
    }, []);

    // Load survey info to check ownership
    const loadSurveyInfo = async () => {
        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            return;
        }
        try {
            const survey = await surveyService.getSurveyById(surveyId);
            if (survey && currentUser) {
                const ownerId = survey.userId || survey.user?.userId || survey.user?.id;
                const currentUserId = currentUser.userId || currentUser.id;
                const isCurrentUserOwner = String(ownerId) === String(currentUserId);
                setIsOwner(isCurrentUserOwner);

                // Store owner info
                if (survey.user) {
                    setSurveyOwner({
                        userId: survey.user.userId || survey.user.id,
                        email: survey.user.email,
                        fullName: survey.user.fullName || survey.user.name
                    });
                } else if (ownerId) {
                    // If we only have ownerId, we'll show it in the list
                    setSurveyOwner({
                        userId: ownerId,
                        email: survey.userEmail || '',
                        fullName: survey.userName || ''
                    });
                }

                // Only load permissions if user is owner
                // Non-owners don't have permission to view the full permissions list
                if (isCurrentUserOwner) {
                    await loadSurveyPermissions();
                } else {
                    // For non-owners, we can try to get their own permission from the survey response
                    // or just show owner and current user info
                    setLoadingPermissions(false);
                }
            }
        } catch (error) {
            console.error('Error loading survey info:', error);
            setLoadingPermissions(false);
        }
    };

    // Load survey permissions - only for owners
    // Only load individual permissions (without restrictedTeamId), not team permissions
    const loadSurveyPermissions = async () => {
        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            return;
        }
        try {
            setLoadingPermissions(true);
            const response = await teamManagementService.getSurveyPermissions(surveyId);
            // Response structure: { surveyId, users: [...], warnings: [] }
            const allUsers = response.users || [];
            // Filter to only show individual permissions (without restrictedTeamId)
            // Team permissions should not be shown in this component
            const individualUsers = allUsers.filter(user => !user.restrictedTeamId);
            setSurveyPermissions(individualUsers);
        } catch (error) {
            console.error('Error loading survey permissions:', error);
            // Only show error if user is owner (they should have permission)
            if (isOwner && error.response?.status !== 403) {
                onNotification?.('error', 'Không thể tải danh sách quyền truy cập.');
            }
        } finally {
            setLoadingPermissions(false);
        }
    };

    // Load survey info when modal opens (which will conditionally load permissions if owner)
    useEffect(() => {
        if (isOpen && surveyId && currentUser) {
            loadSurveyInfo();
        }
    }, [isOpen, surveyId, currentUser]);

    // Handle invite user
    const handleInviteUser = async () => {
        if (!inviteEmail.trim()) {
            onNotification?.('warning', 'Vui lòng nhập email.');
            return;
        }

        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            onNotification?.('warning', 'Vui lòng lưu khảo sát trước khi mời người dùng.');
            return;
        }

        // Check if email already exists in permissions list
        const emailToCheck = inviteEmail.trim().toLowerCase();
        const emailExists = surveyPermissions.some(
            user => user.email?.toLowerCase() === emailToCheck
        );

        // Check if email is the owner's email
        const isOwnerEmail = surveyOwner?.email?.toLowerCase() === emailToCheck;

        if (emailExists || isOwnerEmail) {
            onNotification?.('warning', 'Bạn đã mời người dùng này rồi');
            return;
        }

        try {
            setLoading(true);

            // Load ALL permissions first (including team permissions) to preserve them
            const allPermissionsResponse = await teamManagementService.getSurveyPermissions(surveyId);
            const allUsersPermissions = allPermissionsResponse?.users || [];

            // Get existing individual permissions (without restrictedTeamId)
            const existingIndividualPermissions = allUsersPermissions
                .filter(user => !user.restrictedTeamId)
                .map(user => ({
                    email: user.email,
                    permission: user.permission
                }));

            // Get team permissions to preserve them
            const teamPermissions = allUsersPermissions
                .filter(user => user.restrictedTeamId)
                .map(user => ({
                    userId: user.userId || user.user?.userId || user.user?.id,
                    permission: user.permission,
                    restrictedTeamId: user.restrictedTeamId
                }));

            // Add the new user to individual permissions list
            const updatedIndividualPermissions = [
                ...existingIndividualPermissions,
                {
                    email: inviteEmail.trim(),
                    permission: inviteRole
                    // No restrictedTeamId - this is an individual permission
                }
            ];

            // Build teamAccess array: include both individual permissions and team permissions
            const teamAccess = [
                // Add individual permissions (without restrictedTeamId)
                ...updatedIndividualPermissions.map(perm => ({
                    email: perm.email,
                    permission: perm.permission
                    // No restrictedTeamId
                })),
                // Add team permissions (with restrictedTeamId) to preserve them
                ...teamPermissions.map(perm => ({
                    userId: perm.userId,
                    permission: perm.permission,
                    restrictedTeamId: perm.restrictedTeamId
                }))
            ];

            await teamManagementService.updateSurveyPermissions(surveyId, {
                teamAccess
            });

            onNotification?.('success', 'Đã gửi lời mời thành công!');
            setInviteEmail('');
            setInviteRole('VIEWER');
            await loadSurveyPermissions();
        } catch (error) {
            console.error('Error inviting user:', error);
            let errorMessage = 'Không thể gửi lời mời. Vui lòng thử lại.';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            onNotification?.('error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle update user role
    const handleUpdateUserRole = async (userId, newRole) => {
        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            return;
        }

        try {
            setLoading(true);

            // Load ALL permissions first (including team permissions) to preserve them
            const allPermissionsResponse = await teamManagementService.getSurveyPermissions(surveyId);
            const allUsersPermissions = allPermissionsResponse?.users || [];

            // Get individual permissions and update the role for the specific user
            const updatedIndividualPermissions = allUsersPermissions
                .filter(user => !user.restrictedTeamId)
                .map(user => ({
                    email: user.email,
                    permission: (user.userId || user.user?.userId || user.user?.id) === userId ? newRole : user.permission
                }));

            // Get team permissions to preserve them
            const teamPermissions = allUsersPermissions
                .filter(user => user.restrictedTeamId)
                .map(user => ({
                    userId: user.userId || user.user?.userId || user.user?.id,
                    permission: user.permission,
                    restrictedTeamId: user.restrictedTeamId
                }));

            // Build teamAccess array: include both individual permissions and team permissions
            const teamAccess = [
                // Add updated individual permissions (without restrictedTeamId)
                ...updatedIndividualPermissions.map(perm => ({
                    email: perm.email,
                    permission: perm.permission
                    // No restrictedTeamId
                })),
                // Add team permissions (with restrictedTeamId) to preserve them
                ...teamPermissions.map(perm => ({
                    userId: perm.userId,
                    permission: perm.permission,
                    restrictedTeamId: perm.restrictedTeamId
                }))
            ];

            await teamManagementService.updateSurveyPermissions(surveyId, {
                teamAccess
            });

            onNotification?.('success', 'Đã cập nhật quyền thành công!');
            await loadSurveyPermissions();
        } catch (error) {
            console.error('Error updating user role:', error);
            let errorMessage = 'Không thể cập nhật quyền. Vui lòng thử lại.';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            onNotification?.('error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle remove user permission
    const handleRemoveUser = async (userId) => {
        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            return;
        }

        if (!window.confirm('Bạn có chắc muốn xóa quyền truy cập của người dùng này?')) {
            return;
        }

        try {
            setLoading(true);

            // Load ALL permissions first (including team permissions) to preserve them
            const allPermissionsResponse = await teamManagementService.getSurveyPermissions(surveyId);
            const allUsersPermissions = allPermissionsResponse?.users || [];

            // Remove user from individual permissions only (keep team permissions)
            const remainingIndividualPermissions = allUsersPermissions
                .filter(user => !user.restrictedTeamId && (user.userId || user.user?.userId || user.user?.id) !== userId)
                .map(user => ({
                    email: user.email,
                    permission: user.permission
                }));

            // Get team permissions to preserve them
            const teamPermissions = allUsersPermissions
                .filter(user => user.restrictedTeamId)
                .map(user => ({
                    userId: user.userId || user.user?.userId || user.user?.id,
                    permission: user.permission,
                    restrictedTeamId: user.restrictedTeamId
                }));

            // Build teamAccess array: include both remaining individual permissions and team permissions
            const teamAccess = [
                // Add remaining individual permissions (without restrictedTeamId)
                ...remainingIndividualPermissions.map(perm => ({
                    email: perm.email,
                    permission: perm.permission
                    // No restrictedTeamId
                })),
                // Add team permissions (with restrictedTeamId) to preserve them
                ...teamPermissions.map(perm => ({
                    userId: perm.userId,
                    permission: perm.permission,
                    restrictedTeamId: perm.restrictedTeamId
                }))
            ];

            await teamManagementService.updateSurveyPermissions(surveyId, {
                teamAccess
            });

            onNotification?.('success', 'Đã xóa quyền truy cập thành công!');
            await loadSurveyPermissions();
        } catch (error) {
            console.error('Error removing user:', error);
            let errorMessage = 'Không thể xóa quyền truy cập. Vui lòng thử lại.';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            onNotification?.('error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle copy link
    const handleCopyLink = () => {
        if (surveyId) {
            const link = `${window.location.origin}/survey/${surveyId}`;
            navigator.clipboard.writeText(link);
            onNotification?.('success', 'Đã sao chép link!');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="invite-modal-overlay" onClick={onClose}>
            <div className="invite-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="invite-modal-header">
                    <h3>Mời người dùng</h3>
                    <button
                        className="invite-modal-close"
                        onClick={onClose}
                        aria-label="Đóng"
                    >
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>
                <div className="invite-modal-body">
                    {/* Only show invite form if user is owner */}
                    {isOwner && (
                        <div className="invite-form-section">
                            <div className="invite-input-group">
                                <input
                                    type="email"
                                    className="invite-email-input"
                                    placeholder="email@example.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleInviteUser();
                                        }
                                    }}
                                />
                                <select
                                    className="invite-role-select"
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                >
                                    <option value="VIEWER">Xem</option>
                                    <option value="ANALYST">Phân tích</option>
                                    <option value="EDITOR">Chỉnh sửa</option>
                                </select>
                                <button
                                    className="invite-send-btn"
                                    onClick={handleInviteUser}
                                    disabled={loading || !inviteEmail.trim()}
                                >
                                    <i className="fa-solid fa-paper-plane"></i>
                                    Gửi
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="permissions-section">
                        <div className="permissions-header">
                            <h4>Những người có quyền truy cập</h4>
                            {isOwner && (
                                <button
                                    className="copy-link-btn"
                                    onClick={handleCopyLink}
                                    title="Sao chép link"
                                >
                                    <i className="fa-regular fa-copy"></i>
                                </button>
                            )}
                        </div>

                        {loadingPermissions ? (
                            <div className="permissions-loading">
                                <i className="fa-solid fa-spinner fa-spin"></i>
                                <span>Đang tải...</span>
                            </div>
                        ) : (
                            <div className="permissions-list">
                                {/* Owner - always show if we have owner info */}
                                {surveyOwner && (
                                    <div className="permission-item">
                                        <div className="permission-user-info">
                                            <div className="permission-avatar">
                                                {surveyOwner.fullName ? surveyOwner.fullName.charAt(0).toUpperCase() : surveyOwner.email?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="permission-user-details">
                                                <div className="permission-user-name">
                                                    {surveyOwner.fullName || surveyOwner.email}
                                                    {isOwner && ' (you)'}
                                                    {!isOwner && ' (Chủ sở hữu)'}
                                                </div>
                                                <div className="permission-user-email">{surveyOwner.email}</div>
                                            </div>
                                        </div>
                                        <div className="permission-role">
                                            <span className="role-badge owner">Chủ sở hữu</span>
                                        </div>
                                    </div>
                                )}

                                {/* Current user (if not owner) - show their individual permission only */}
                                {!isOwner && currentUser && (() => {
                                    // Try to get individual permission from surveyPermissions (already filtered to only individual)
                                    const currentUserPermission = surveyPermissions.find(
                                        p => String(p.userId || p.user?.userId || p.user?.id) === String(currentUser.userId || currentUser.id)
                                    );

                                    // Only show if user has individual permission (not team permission)
                                    if (!currentUserPermission) {
                                        return null;
                                    }

                                    const roleText = currentUserPermission.permission === 'EDITOR' ? 'Chỉnh sửa' :
                                        currentUserPermission.permission === 'ANALYST' ? 'Phân tích' :
                                            'Xem';

                                    return (
                                        <div className="permission-item">
                                            <div className="permission-user-info">
                                                <div className="permission-avatar">
                                                    {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : currentUser.email?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="permission-user-details">
                                                    <div className="permission-user-name">
                                                        {currentUser.fullName || currentUser.email} (you)
                                                    </div>
                                                    <div className="permission-user-email">{currentUser.email}</div>
                                                </div>
                                            </div>
                                            <div className="permission-role">
                                                <span className="role-badge">{roleText}</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Other users with permissions - only show if owner */}
                                {isOwner && surveyPermissions.map((user) => (
                                    <div key={user.userId || user.email} className="permission-item">
                                        <div className="permission-user-info">
                                            <div className="permission-avatar">
                                                {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="permission-user-details">
                                                <div className="permission-user-name">
                                                    {user.fullName || user.email}
                                                </div>
                                                <div className="permission-user-email">{user.email}</div>
                                            </div>
                                        </div>
                                        <div className="permission-role">
                                            <select
                                                className="role-select"
                                                value={user.permission}
                                                onChange={(e) => handleUpdateUserRole(user.userId, e.target.value)}
                                                disabled={loading}
                                            >
                                                <option value="VIEWER">Xem</option>
                                                <option value="ANALYST">Phân tích</option>
                                                <option value="EDITOR">Chỉnh sửa</option>
                                            </select>
                                            <button
                                                className="remove-permission-btn"
                                                onClick={() => handleRemoveUser(user.userId)}
                                                disabled={loading}
                                                title="Xóa quyền truy cập"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Show other users (not current user) if not owner - read only */}
                                {!isOwner && surveyPermissions
                                    .filter(user => String(user.userId || user.user?.userId || user.user?.id) !== String(currentUser?.userId || currentUser?.id))
                                    .map((user) => (
                                        <div key={user.userId || user.email} className="permission-item">
                                            <div className="permission-user-info">
                                                <div className="permission-avatar">
                                                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="permission-user-details">
                                                    <div className="permission-user-name">
                                                        {user.fullName || user.email}
                                                    </div>
                                                    <div className="permission-user-email">{user.email}</div>
                                                </div>
                                            </div>
                                            <div className="permission-role">
                                                <span className="role-badge">
                                                    {user.permission === 'EDITOR' ? 'Edit' :
                                                        user.permission === 'ANALYST' ? 'Analysis' :
                                                            'Viewer'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                {surveyPermissions.length === 0 && !surveyOwner && (
                                    <div className="permissions-empty">
                                        <p>Chưa có người dùng nào được mời</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddUserSurvey;

