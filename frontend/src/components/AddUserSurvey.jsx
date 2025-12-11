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

    // Tải thông tin người dùng hiện tại
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

    // Tải thông tin khảo sát để kiểm tra quyền sở hữu
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

                // Lưu thông tin chủ sở hữu
                if (survey.user) {
                    setSurveyOwner({
                        userId: survey.user.userId || survey.user.id,
                        email: survey.user.email,
                        fullName: survey.user.fullName || survey.user.name
                    });
                } else if (ownerId) {
                    // Nếu chỉ có ownerId, vẫn hiển thị trong danh sách
                    setSurveyOwner({
                        userId: ownerId,
                        email: survey.userEmail || '',
                        fullName: survey.userName || ''
                    });
                }

                // Chỉ tải quyền nếu người dùng là chủ khảo sát
                // Người không phải chủ sở hữu không được xem toàn bộ danh sách quyền
                if (isCurrentUserOwner) {
                    await loadSurveyPermissions();
                } else {
                    // Với người không phải chủ, chỉ hiển thị quyền cá nhân hoặc thông tin cơ bản
                    setLoadingPermissions(false);
                }
            }
        } catch (error) {
            console.error('Error loading survey info:', error);
            setLoadingPermissions(false);
        }
    };

    // Tải quyền khảo sát - chỉ dành cho chủ sở hữu
    // Chỉ tải quyền cá nhân (không có restrictedTeamId), bỏ qua quyền theo nhóm
    const loadSurveyPermissions = async () => {
        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            return;
        }
        try {
            setLoadingPermissions(true);
            const response = await teamManagementService.getSurveyPermissions(surveyId);
            // Cấu trúc response: { surveyId, users: [...], warnings: [] }
            const allUsers = response.users || [];
            // Lọc chỉ các quyền cá nhân (không có restrictedTeamId)
            // Quyền theo nhóm không được hiển thị trong component này
            const individualUsers = allUsers.filter(user => !user.restrictedTeamId);
            setSurveyPermissions(individualUsers);
        } catch (error) {
            console.error('Error loading survey permissions:', error);
            // Chỉ thông báo lỗi nếu người dùng là chủ khảo sát (có quyền xem)
            if (isOwner && error.response?.status !== 403) {
                onNotification?.('error', 'Không thể tải danh sách quyền truy cập.');
            }
        } finally {
            setLoadingPermissions(false);
        }
    };

    // Khi mở modal sẽ tải thông tin khảo sát (và tải quyền nếu là chủ)
    useEffect(() => {
        if (isOpen && surveyId && currentUser) {
            loadSurveyInfo();
        }
    }, [isOpen, surveyId, currentUser]);

    // Xử lý mời người dùng
    const handleInviteUser = async () => {
        if (!inviteEmail.trim()) {
            onNotification?.('warning', 'Vui lòng nhập email.');
            return;
        }

        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            onNotification?.('warning', 'Vui lòng lưu khảo sát trước khi mời người dùng.');
            return;
        }

        // Kiểm tra email đã tồn tại trong danh sách quyền chưa
        const emailToCheck = inviteEmail.trim().toLowerCase();
        const emailExists = surveyPermissions.some(
            user => user.email?.toLowerCase() === emailToCheck
        );

        // Kiểm tra email có trùng với chủ khảo sát không
        const isOwnerEmail = surveyOwner?.email?.toLowerCase() === emailToCheck;

        if (emailExists || isOwnerEmail) {
            onNotification?.('warning', 'Bạn đã mời người dùng này rồi');
            return;
        }

        try {
            setLoading(true);

            // Tải TẤT CẢ quyền (kể cả quyền theo nhóm) để giữ nguyên
            const allPermissionsResponse = await teamManagementService.getSurveyPermissions(surveyId);
            const allUsersPermissions = allPermissionsResponse?.users || [];

            // Lấy danh sách quyền cá nhân hiện có (không restrictedTeamId)
            const existingIndividualPermissions = allUsersPermissions
                .filter(user => !user.restrictedTeamId)
                .map(user => ({
                    email: user.email,
                    permission: user.permission
                }));

            // Lấy quyền theo nhóm để giữ lại
            const teamPermissions = allUsersPermissions
                .filter(user => user.restrictedTeamId)
                .map(user => ({
                    userId: user.userId || user.user?.userId || user.user?.id,
                    permission: user.permission,
                    restrictedTeamId: user.restrictedTeamId
                }));

            // Thêm người dùng mới vào danh sách quyền cá nhân
            const updatedIndividualPermissions = [
                ...existingIndividualPermissions,
                {
                    email: inviteEmail.trim(),
                    permission: inviteRole
                    // Không có restrictedTeamId - đây là quyền cá nhân
                }
            ];

            // Tạo mảng teamAccess: gồm quyền cá nhân và quyền theo nhóm
            const teamAccess = [
                // Thêm quyền cá nhân (không restrictedTeamId)
                ...updatedIndividualPermissions.map(perm => ({
                    email: perm.email,
                    permission: perm.permission
                    // Không có restrictedTeamId
                })),
                // Thêm quyền theo nhóm (có restrictedTeamId) để giữ lại
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

    // Xử lý cập nhật quyền người dùng
    const handleUpdateUserRole = async (userId, newRole) => {
        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            return;
        }

        try {
            setLoading(true);

            // Tải TẤT CẢ quyền (kể cả quyền theo nhóm) để giữ nguyên
            const allPermissionsResponse = await teamManagementService.getSurveyPermissions(surveyId);
            const allUsersPermissions = allPermissionsResponse?.users || [];

            // Lấy quyền cá nhân và cập nhật vai trò cho người dùng tương ứng
            const updatedIndividualPermissions = allUsersPermissions
                .filter(user => !user.restrictedTeamId)
                .map(user => ({
                    email: user.email,
                    permission: (user.userId || user.user?.userId || user.user?.id) === userId ? newRole : user.permission
                }));

            // Lấy quyền theo nhóm để giữ lại
            const teamPermissions = allUsersPermissions
                .filter(user => user.restrictedTeamId)
                .map(user => ({
                    userId: user.userId || user.user?.userId || user.user?.id,
                    permission: user.permission,
                    restrictedTeamId: user.restrictedTeamId
                }));

            // Tạo mảng teamAccess: gồm quyền cá nhân và quyền theo nhóm
            const teamAccess = [
                // Thêm quyền cá nhân đã cập nhật (không restrictedTeamId)
                ...updatedIndividualPermissions.map(perm => ({
                    email: perm.email,
                    permission: perm.permission
                    // Không có restrictedTeamId
                })),
                // Thêm quyền theo nhóm (có restrictedTeamId) để giữ lại
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

    // Xử lý xóa quyền người dùng
    const handleRemoveUser = async (userId) => {
        if (!surveyId || surveyId.toString().startsWith('temp_')) {
            return;
        }

        if (!window.confirm('Bạn có chắc muốn xóa quyền truy cập của người dùng này?')) {
            return;
        }

        try {
            setLoading(true);

            // Tải TẤT CẢ quyền (kể cả quyền theo nhóm) để giữ nguyên
            const allPermissionsResponse = await teamManagementService.getSurveyPermissions(surveyId);
            const allUsersPermissions = allPermissionsResponse?.users || [];

            // Xóa người dùng khỏi quyền cá nhân (giữ quyền theo nhóm)
            const remainingIndividualPermissions = allUsersPermissions
                .filter(user => !user.restrictedTeamId && (user.userId || user.user?.userId || user.user?.id) !== userId)
                .map(user => ({
                    email: user.email,
                    permission: user.permission
                }));

            // Lấy quyền theo nhóm để giữ lại
            const teamPermissions = allUsersPermissions
                .filter(user => user.restrictedTeamId)
                .map(user => ({
                    userId: user.userId || user.user?.userId || user.user?.id,
                    permission: user.permission,
                    restrictedTeamId: user.restrictedTeamId
                }));

            // Tạo mảng teamAccess: gồm quyền cá nhân còn lại và quyền theo nhóm
            const teamAccess = [
                // Thêm quyền cá nhân còn lại (không restrictedTeamId)
                ...remainingIndividualPermissions.map(perm => ({
                    email: perm.email,
                    permission: perm.permission
                    // Không có restrictedTeamId
                })),
                // Thêm quyền theo nhóm (có restrictedTeamId) để giữ lại
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

    // Xử lý sao chép đường dẫn khảo sát
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
                    {/* Chỉ hiển thị form mời khi người dùng là chủ khảo sát */}
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
                                {/* Chủ khảo sát - luôn hiển thị nếu có thông tin */}
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

                                {/* Người dùng hiện tại (không phải chủ) - chỉ hiển thị quyền cá nhân */}
                                {!isOwner && currentUser && (() => {
                                    // Thử lấy quyền cá nhân từ surveyPermissions (đã lọc sẵn)
                                    const currentUserPermission = surveyPermissions.find(
                                        p => String(p.userId || p.user?.userId || p.user?.id) === String(currentUser.userId || currentUser.id)
                                    );

                                    // Chỉ hiển thị nếu người dùng có quyền cá nhân (không phải quyền theo nhóm)
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

                                {/* Người dùng khác có quyền - chỉ chủ khảo sát nhìn thấy */}
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

                                {/* Với người không phải chủ, chỉ xem danh sách quyền còn lại */}
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

