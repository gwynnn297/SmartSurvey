import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import NotificationModal from '../../components/NotificationModal';
import { teamManagementService } from '../../services/teamManagementService';
import { surveyService } from '../../services/surveyService';
import './TeamManagementPage.css';

const TeamManagementPage = () => {
    console.log('[TeamManagement] Component rendering...');

    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [teams, setTeams] = useState([]);
    const [notification, setNotification] = useState(null);
    const hasAutoSelectedRef = useRef(false);

    // Modal states
    const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditTeamModal, setShowEditTeamModal] = useState(false);

    // Selected team for detail view
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [teamSurveys, setTeamSurveys] = useState([]);
    const [ownerSurveys, setOwnerSurveys] = useState([]); // Surveys owned by current user
    const [selectedSurveyId, setSelectedSurveyId] = useState(null); // Selected survey for permission management
    const [loadingTeamDetail, setLoadingTeamDetail] = useState(false);
    const [loadingOwnerSurveys, setLoadingOwnerSurveys] = useState(false);
    // Permissions matrix: { surveyId: { teamId: { userId: permission } } }
    // This allows the same user in different teams to have different permissions for the same survey
    const [permissionsMatrix, setPermissionsMatrix] = useState({});
    const [savingPermissions, setSavingPermissions] = useState(false);
    // Track users who have permissions in other teams: { surveyId: { userId: true } }
    // If a user has permission in another team, they cannot be assigned permission in this team
    const [usersWithOtherTeamPermissions, setUsersWithOtherTeamPermissions] = useState({});
    // Dashboard data for members (non-owners)
    const [dashboardData, setDashboardData] = useState(null);
    const [loadingDashboard, setLoadingDashboard] = useState(false);

    // Form states
    const [createTeamForm, setCreateTeamForm] = useState({
        name: '',
        description: ''
    });
    const [inviteForm, setInviteForm] = useState({
        email: ''
    });
    const [editTeamForm, setEditTeamForm] = useState({
        name: '',
        description: ''
    });

    const showNotification = useCallback((type, message) => {
        setNotification({ type, message });
    }, []);

    // Load teams and invitations
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            console.log('[TeamManagement] Component mounted, loading data...');

            const teamsData = await teamManagementService.getMyTeams();

            const teamsList = Array.isArray(teamsData) ? teamsData : [];
            setTeams(teamsList);

            console.log('[TeamManagement] Teams loaded:', teamsList.length);

            // Auto-select first team only once on initial load
            if (!hasAutoSelectedRef.current && teamsList.length > 0) {
                hasAutoSelectedRef.current = true;
                const firstTeam = teamsList[0];
                setSelectedTeam(firstTeam);
                const teamId = firstTeam.teamId || firstTeam.id;
                console.log('[TeamManagement] Auto-selecting first team:', teamId);
                // loadTeamDetail will be called by useEffect watching selectedTeam
            }
        } catch (error) {
            console.error('[TeamManagement] Error loading teams data:', error);
            setNotification({ type: 'error', message: 'Không thể tải dữ liệu. Vui lòng thử lại.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array - chỉ chạy khi mount

    // Select team and load detail
    const handleSelectTeam = async (team) => {
        console.log('[TeamManagement] handleSelectTeam called with team:', team);
        setSelectedTeam(team);
        const teamId = team.teamId || team.id;
        console.log('[TeamManagement] Loading detail for teamId:', teamId);
        await loadTeamDetail(teamId);
    };

    // Get current user helper
    const getCurrentUser = useCallback(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || null;
        } catch {
            return null;
        }
    }, []);

    // Load owner's surveys
    const loadOwnerSurveys = useCallback(async () => {
        try {
            setLoadingOwnerSurveys(true);
            // Get current user
            const user = getCurrentUser();
            const currentUserId = user?.userId || user?.id;

            console.log('[TeamManagement] Loading owner surveys...');
            console.log('[TeamManagement] Current user:', user);
            console.log('[TeamManagement] Current userId:', currentUserId, '(type:', typeof currentUserId, ')');

            if (!currentUserId) {
                console.warn('[TeamManagement] No current user ID found');
                setNotification({ type: 'error', message: 'Không tìm thấy thông tin người dùng.' });
                return;
            }

            // Get all surveys owned by current user (like ListSurvey)
            const response = await surveyService.getSurveys(0, 1000);
            console.log('[TeamManagement] Surveys API response:', response);

            let surveysList = [];

            if (response?.result && Array.isArray(response.result)) {
                surveysList = response.result;
            } else if (Array.isArray(response)) {
                surveysList = response;
            } else if (Array.isArray(response?.data)) {
                surveysList = response.data;
            } else if (response?.meta && response?.result) {
                surveysList = Array.isArray(response.result) ? response.result : [];
            }

            console.log('[TeamManagement] All surveys from API:', surveysList.length, 'surveys');
            if (surveysList.length > 0) {
                console.log('[TeamManagement] Survey sample:', surveysList[0]);
                console.log('[TeamManagement] Survey userId fields:', {
                    'survey.userId': surveysList[0].userId,
                    'survey.user?.userId': surveysList[0].user?.userId,
                    'survey.user?.id': surveysList[0].user?.id
                });
            }

            // Convert both to string for comparison to avoid type mismatch
            const currentUserIdStr = String(currentUserId);
            console.log('[TeamManagement] Comparing with userId (as string):', currentUserIdStr);

            // Filter only surveys owned by current user
            const ownedSurveys = surveysList.filter(survey => {
                const ownerId = survey.userId || survey.user?.userId || survey.user?.id;
                const ownerIdStr = ownerId ? String(ownerId) : null;

                const isMatch = ownerIdStr === currentUserIdStr;

                if (surveysList.length <= 5) {
                    // Only log for first few surveys to avoid spam
                    console.log(`[TeamManagement] Survey "${survey.title || survey.id}": ownerId=${ownerId} (${typeof ownerId}, as string: ${ownerIdStr}), match=${isMatch}`);
                }

                return isMatch;
            });

            console.log('[TeamManagement] Filtered owned surveys:', ownedSurveys.length, 'surveys');
            if (ownedSurveys.length > 0) {
                console.log('[TeamManagement] Owned surveys:', ownedSurveys.map(s => ({ id: s.id || s.surveyId, title: s.title })));
            } else if (surveysList.length > 0) {
                console.warn('[TeamManagement] ⚠️ No owned surveys found after filtering!');
                console.warn('[TeamManagement] Possible causes:');
                console.warn('  1. Type mismatch: currentUserId type =', typeof currentUserId, ', survey.userId type =', surveysList[0]?.userId ? typeof surveysList[0].userId : 'undefined');
                console.warn('  2. Field name mismatch: check if survey has userId field');
                console.warn('  3. API returns all surveys, not just owned ones');
                console.warn('[TeamManagement] First survey details:', {
                    id: surveysList[0]?.id,
                    title: surveysList[0]?.title,
                    userId: surveysList[0]?.userId,
                    user: surveysList[0]?.user
                });
            }

            setOwnerSurveys(ownedSurveys);

            // Auto-select first survey if available and no survey selected
            if (ownedSurveys.length > 0) {
                setSelectedSurveyId(prev => {
                    if (!prev) {
                        const firstSurvey = ownedSurveys[0];
                        const surveyId = firstSurvey.id || firstSurvey.surveyId;
                        console.log('[TeamManagement] Auto-selecting first survey:', surveyId);
                        return surveyId;
                    }
                    return prev;
                });
            } else {
                console.warn('[TeamManagement] No owned surveys to auto-select');
            }
        } catch (error) {
            console.error('[TeamManagement] Error loading owner surveys:', error);
            console.error('[TeamManagement] Error details:', error.response?.data);
            setNotification({ type: 'error', message: 'Không thể tải danh sách khảo sát. Vui lòng thử lại.' });
        } finally {
            setLoadingOwnerSurveys(false);
        }
    }, [getCurrentUser]);

    // Load existing permissions for a specific survey and team
    const loadSurveyPermissions = useCallback(async (surveyId, members, teamId) => {
        if (!surveyId || !members || members.length === 0 || !teamId) return;

        try {
            const permissions = await teamManagementService.getSurveyPermissions(surveyId);
            if (permissions?.users && Array.isArray(permissions.users)) {
                const teamPermissions = {};
                const usersWithOtherTeamPerms = {}; // Track users with permissions in other teams
                // Convert teamId to number for comparison
                const currentTeamIdNum = Number(teamId);

                for (const perm of permissions.users) {
                    const userId = perm.userId || perm.user?.userId || perm.user?.id;
                    if (!userId) continue;

                    // Check if member is in current team
                    const member = members.find(m => {
                        const memberId = m.userId || m.user?.userId || m.user?.id;
                        return Number(memberId) === Number(userId);
                    });

                    if (member && perm.permission) {
                        const permTeamId = perm.restrictedTeamId ? Number(perm.restrictedTeamId) : null;

                        if (permTeamId && permTeamId === currentTeamIdNum) {
                            // Permission for current team
                            teamPermissions[Number(userId)] = perm.permission;
                        } else if (permTeamId && permTeamId !== currentTeamIdNum) {
                            // User has permission in another team - mark as locked
                            usersWithOtherTeamPerms[Number(userId)] = true;
                        } else if (!permTeamId) {
                            // Permission without team restriction (global permission)
                            // This also means user cannot be assigned team-specific permission
                            usersWithOtherTeamPerms[Number(userId)] = true;
                        }
                    }
                }

                // Update permissions matrix with team-specific structure
                setPermissionsMatrix(prev => ({
                    ...prev,
                    [surveyId]: {
                        ...(prev[surveyId] || {}),
                        [teamId]: teamPermissions
                    }
                }));

                // Update users with other team permissions
                setUsersWithOtherTeamPermissions(prev => ({
                    ...prev,
                    [surveyId]: {
                        ...(prev[surveyId] || {}),
                        ...usersWithOtherTeamPerms
                    }
                }));
            } else {
                // No permissions found, set empty for this team
                setPermissionsMatrix(prev => ({
                    ...prev,
                    [surveyId]: {
                        ...(prev[surveyId] || {}),
                        [teamId]: {}
                    }
                }));
            }
        } catch (error) {
            console.error(`Error loading permissions for survey ${surveyId}:`, error);
            // If no permissions exist yet, that's fine - just set empty for this team
            setPermissionsMatrix(prev => ({
                ...prev,
                [surveyId]: {
                    ...(prev[surveyId] || {}),
                    [teamId]: {}
                }
            }));
        }
    }, []);

    // Load dashboard data for members (non-owners)
    const loadDashboardData = useCallback(async () => {
        try {
            setLoadingDashboard(true);
            console.log('[TeamManagement] Loading dashboard data for member...');
            const dashboard = await teamManagementService.getUserDashboard();
            console.log('[TeamManagement] Dashboard data loaded:', dashboard);
            setDashboardData(dashboard);
        } catch (error) {
            console.error('[TeamManagement] Error loading dashboard data:', error);
            setNotification({ type: 'error', message: 'Không thể tải thông tin dashboard.' });
        } finally {
            setLoadingDashboard(false);
        }
    }, []);

    // Load team detail
    const loadTeamDetail = useCallback(async (teamId, preserveSelectedSurvey = false) => {
        try {
            setLoadingTeamDetail(true);

            // Store current selected survey if we want to preserve it
            const currentSelectedSurveyId = preserveSelectedSurvey ? selectedSurveyId : null;

            if (!preserveSelectedSurvey) {
                setSelectedSurveyId(null); // Reset selected survey
                // Don't reset entire permissions matrix - keep permissions for other teams
                // Only clear permissions for this team if needed
            }

            console.log('[TeamManagement] Loading team detail for teamId:', teamId);

            const [members, surveys] = await Promise.all([
                teamManagementService.getTeamMembers(teamId),
                teamManagementService.getTeamSurveys(teamId)
            ]);

            const membersList = Array.isArray(members) ? members : [];
            setTeamMembers(membersList);
            setTeamSurveys(Array.isArray(surveys) ? surveys : []);

            console.log('[TeamManagement] Team members loaded:', membersList.length);
            console.log('[TeamManagement] Team surveys loaded:', Array.isArray(surveys) ? surveys.length : 0);

            // Load owner surveys if user is owner, otherwise load dashboard data
            const user = getCurrentUser();
            const currentUserId = user?.userId || user?.id;
            console.log('[TeamManagement] Checking team ownership...');
            console.log('[TeamManagement] Current userId:', currentUserId, '(type:', typeof currentUserId, ')');

            const team = await teamManagementService.getTeamById(teamId);
            console.log('[TeamManagement] Team object:', team);
            console.log('[TeamManagement] Team owner fields:', {
                'team.ownerId': team.ownerId,
                'team.owner?.userId': team.owner?.userId,
                'team.owner?.id': team.owner?.id
            });

            // Convert both to string for comparison to avoid type mismatch
            const currentUserIdStr = String(currentUserId);
            const teamOwnerId = team.ownerId || team.owner?.userId || team.owner?.id;
            const teamOwnerIdStr = teamOwnerId ? String(teamOwnerId) : null;
            const isTeamOwner = teamOwnerIdStr === currentUserIdStr;

            console.log('[TeamManagement] Team ownerId:', teamOwnerId, '(type:', typeof teamOwnerId, ', as string:', teamOwnerIdStr, ')');
            console.log('[TeamManagement] Is team owner?', isTeamOwner);

            if (isTeamOwner) {
                console.log('[TeamManagement] ✅ User is team owner, loading owner surveys...');
                // Load all owner surveys
                await loadOwnerSurveys();

                // If we preserved the selected survey, reload its permissions with new members
                if (preserveSelectedSurvey && currentSelectedSurveyId && membersList.length > 0) {
                    await loadSurveyPermissions(currentSelectedSurveyId, membersList, teamId);
                }
            } else {
                console.log('[TeamManagement] ❌ User is NOT team owner, loading dashboard data...');
                // Load dashboard data to show member's permissions
                await loadDashboardData();
            }
        } catch (error) {
            console.error('[TeamManagement] Error loading team detail:', error);
            console.error('[TeamManagement] Error details:', error.response?.data);
            setNotification({ type: 'error', message: 'Không thể tải thông tin team.' });
        } finally {
            setLoadingTeamDetail(false);
        }
    }, [getCurrentUser, loadOwnerSurveys, loadSurveyPermissions, selectedSurveyId, loadDashboardData]);

    // Effect to load team detail when selectedTeam changes (for auto-select on initial load)
    useEffect(() => {
        if (selectedTeam && hasAutoSelectedRef.current && !loadingTeamDetail) {
            const teamId = selectedTeam.teamId || selectedTeam.id;
            console.log('[TeamManagement] Auto-selected team detected, loading detail for:', teamId);
            loadTeamDetail(teamId);
            // Reset the ref so this only runs once
            hasAutoSelectedRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeam?.teamId || selectedTeam?.id]); // Only when team ID changes

    // Effect to auto-load permissions when survey is selected and members are available
    useEffect(() => {
        if (selectedSurveyId && teamMembers.length > 0 && selectedTeam && !loadingTeamDetail && !loadingOwnerSurveys) {
            const teamId = selectedTeam.teamId || selectedTeam.id;
            // Check if permissions are already loaded for this survey and team
            const currentPermissions = permissionsMatrix[selectedSurveyId]?.[teamId];
            if (!currentPermissions || Object.keys(currentPermissions).length === 0) {
                console.log('[TeamManagement] Auto-loading permissions for selected survey:', selectedSurveyId, 'and team:', teamId);
                loadSurveyPermissions(selectedSurveyId, teamMembers, teamId);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSurveyId, teamMembers.length, loadingTeamDetail, loadingOwnerSurveys, selectedTeam?.teamId || selectedTeam?.id]);

    // Create team
    const handleCreateTeam = async (e) => {
        e.preventDefault();
        if (!createTeamForm.name.trim()) {
            showNotification('error', 'Vui lòng nhập tên team.');
            return;
        }

        try {
            const newTeam = await teamManagementService.createTeam({
                name: createTeamForm.name.trim(),
                description: createTeamForm.description.trim() || null
            });

            const updatedTeams = [newTeam, ...teams];
            setTeams(updatedTeams);
            setShowCreateTeamModal(false);
            setCreateTeamForm({ name: '', description: '' });
            showNotification('success', 'Đã tạo team thành công!');

            // Auto-select new team
            await handleSelectTeam(newTeam);
        } catch (error) {
            console.error('Error creating team:', error);
            const errorMsg = error.response?.data?.message || 'Không thể tạo team. Vui lòng thử lại.';
            showNotification('error', errorMsg);
        }
    };

    // Send invitation
    const handleSendInvitation = async (e) => {
        e.preventDefault();
        if (!inviteForm.email.trim()) {
            showNotification('error', 'Vui lòng nhập email.');
            return;
        }

        if (!selectedTeam) return;
        const teamId = selectedTeam.teamId || selectedTeam.id;

        try {
            await teamManagementService.sendInvitation(teamId, {
                email: inviteForm.email.trim()
            });

            setInviteForm({ email: '' });
            setShowInviteModal(false);
            showNotification('success', 'Đã gửi lời mời thành công!');

            // Preserve selected survey when reloading (in case user is viewing permissions)
            await loadTeamDetail(teamId, true); // Reload to show updated member count

            // Trigger notification reload after a short delay to ensure backend has processed
            // This ensures duplicate TEAM_INVITATION notifications are filtered correctly
            setTimeout(() => {
                window.dispatchEvent(new Event('reloadNotifications'));
            }, 500);
        } catch (error) {
            console.error('Error sending invitation:', error);
            const errorMsg = error.response?.data?.message || 'Không thể gửi lời mời.';
            showNotification('error', errorMsg);
        }
    };

    // Update team
    const handleUpdateTeam = async (e) => {
        e.preventDefault();
        if (!editTeamForm.name.trim()) {
            showNotification('error', 'Vui lòng nhập tên nhóm.');
            return;
        }

        if (!selectedTeam) return;
        const teamId = selectedTeam.teamId || selectedTeam.id;

        try {
            const updatedTeam = await teamManagementService.updateTeam(teamId, {
                name: editTeamForm.name.trim(),
                description: editTeamForm.description.trim() || null
            });

            // Update selected team in state
            setSelectedTeam(updatedTeam);

            // Update team in teams list
            setTeams(prev => prev.map(team => {
                const id = team.teamId || team.id;
                return id === teamId ? updatedTeam : team;
            }));

            setShowEditTeamModal(false);
            showNotification('success', 'Đã cập nhật thông tin nhóm thành công!');
        } catch (error) {
            console.error('Error updating team:', error);
            const errorMsg = error.response?.data?.message || 'Không thể cập nhật thông tin nhóm.';
            showNotification('error', errorMsg);
        }
    };

    // Handle invitation update from Notification component
    const handleInvitationUpdate = async () => {
        // Reload teams when invitation is accepted
        try {
            const teamsData = await teamManagementService.getMyTeams();
            const teamsList = Array.isArray(teamsData) ? teamsData : [];
            setTeams(teamsList);
        } catch (error) {
            console.error('Error reloading teams:', error);
        }
    };

    // Edit team from list
    const handleEditTeamFromList = (e, team) => {
        e.stopPropagation(); // Prevent team selection
        setSelectedTeam(team);
        setEditTeamForm({
            name: team.name || '',
            description: team.description || ''
        });
        setShowEditTeamModal(true);
    };

    // Delete team
    // Delete team
    const handleDeleteTeam = async (e, team) => {
        e.stopPropagation();

        if (!window.confirm(`Bạn có chắc muốn xóa nhóm "${team.name}"? Tất cả thành viên và quyền truy cập liên quan sẽ bị xóa.`)) {
            return;
        }

        const teamId = team.teamId || team.id;

        try {
            console.log(`[TeamManagement] Deleting team ${teamId}`);

            // Backend sẽ tự động xóa tất cả permissions, members, invitations
            await teamManagementService.deleteTeam(teamId);
            console.log(`[TeamManagement] Team ${teamId} deleted successfully`);

            // Clear selected team if it's the deleted team
            if (selectedTeam && (selectedTeam.teamId || selectedTeam.id) === teamId) {
                setSelectedTeam(null);
                setTeamMembers([]);
                setTeamSurveys([]);
                setSelectedSurveyId(null);
                setPermissionsMatrix({});
            }

            // Remove permissions from permissionsMatrix for this team
            setPermissionsMatrix(prev => {
                const updated = { ...prev };
                for (const surveyId in updated) {
                    if (updated[surveyId] && updated[surveyId][teamId]) {
                        const { [teamId]: removed, ...rest } = updated[surveyId];
                        updated[surveyId] = rest;
                    }
                }
                return updated;
            });

            // Reload teams list
            const teamsData = await teamManagementService.getMyTeams();
            const teamsList = Array.isArray(teamsData) ? teamsData : [];
            setTeams(teamsList);

            showNotification('success', 'Đã xóa nhóm và tất cả quyền truy cập liên quan thành công!');
        } catch (error) {
            console.error('Error deleting team:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url
            });
            const errorMsg = error.response?.data?.message || 'Không thể xóa nhóm.';
            showNotification('error', errorMsg);
        }
    };

    // Thêm vào trong component TeamManagementPage
    const handleRemoveMember = async (memberId) => {
        if (!window.confirm('Bạn có chắc muốn xóa thành viên này khỏi nhóm?')) {
            return;
        }

        if (!selectedTeam) return;
        const teamId = selectedTeam.teamId || selectedTeam.id;

        try {
            // Gọi API xóa thành viên
            const updatedTeam = await teamManagementService.removeMember(teamId, memberId);

            // Cập nhật lại danh sách thành viên ở state local để UI tự reload
            setTeamMembers(prev => prev.filter(m => (m.memberId || m.id) !== memberId));

            // Cập nhật số lượng member trong danh sách teams bên trái
            setTeams(prev => prev.map(t => {
                const tId = t.teamId || t.id;
                if (tId === teamId) {
                    return { ...t, memberCount: (t.memberCount || 0) - 1 };
                }
                return t;
            }));

            showNotification('success', 'Đã xóa thành viên thành công.');
        } catch (error) {
            console.error('Error removing member:', error);
            const errorMsg = error.response?.data?.message || 'Không thể xóa thành viên.';
            showNotification('error', errorMsg);
        }
    };
    // Handle survey selection
    const handleSelectSurvey = async (surveyId) => {
        if (selectedSurveyId === surveyId) return; // Already selected

        setSelectedSurveyId(surveyId);
        // Load permissions for selected survey
        if (teamMembers.length > 0 && selectedTeam) {
            const teamId = selectedTeam.teamId || selectedTeam.id;
            await loadSurveyPermissions(surveyId, teamMembers, teamId);
        }
    };

    // Handle permission change
    const handlePermissionChange = (surveyId, userId, permission) => {
        if (!selectedTeam) return;
        const teamId = selectedTeam.teamId || selectedTeam.id;

        // Check if user has permission in another team - if so, don't allow change
        const hasPermissionInOtherTeam = usersWithOtherTeamPermissions[surveyId]?.[userId] || false;
        if (hasPermissionInOtherTeam) {
            console.log(`[TeamManagement] Cannot change permission for user ${userId} - already has permission in another team`);
            return; // Don't allow change
        }

        setPermissionsMatrix(prev => ({
            ...prev,
            [surveyId]: {
                ...(prev[surveyId] || {}),
                [teamId]: {
                    ...(prev[surveyId]?.[teamId] || {}),
                    [userId]: permission === 'none' ? null : permission
                }
            }
        }));
    };

    // Save permissions for selected survey and team
    const handleSavePermissions = async () => {
        if (!selectedTeam || !selectedSurveyId || savingPermissions) return;

        try {
            setSavingPermissions(true);
            const teamId = selectedTeam.teamId || selectedTeam.id;

            // Get permissions for this specific team
            const teamPermissions = permissionsMatrix[selectedSurveyId]?.[teamId] || {};

            // Load ALL existing permissions for this survey first
            const allPermissions = await teamManagementService.getSurveyPermissions(selectedSurveyId);
            const allUsersPermissions = allPermissions?.users || [];

            // Build a map of existing permissions: userId -> { permission, restrictedTeamId }
            // Track BOTH team-restricted permissions AND individual permissions (without restrictedTeamId)
            const existingPermissionsMap = new Map();
            const individualPermissions = []; // Store individual permissions separately

            for (const perm of allUsersPermissions) {
                const userId = perm.userId || perm.user?.userId || perm.user?.id;
                if (userId) {
                    if (perm.restrictedTeamId) {
                        // Team-restricted permission
                        const key = `${userId}_${perm.restrictedTeamId}`;
                        existingPermissionsMap.set(key, {
                            userId: Number(userId),
                            permission: perm.permission,
                            restrictedTeamId: Number(perm.restrictedTeamId)
                        });
                    } else {
                        // Individual permission (without restrictedTeamId) - preserve these
                        individualPermissions.push({
                            userId: Number(userId),
                            permission: perm.permission
                            // No restrictedTeamId - this is an individual permission
                        });
                    }
                }
            }

            // Build teamAccess array: include permissions from ALL teams AND individual permissions
            const teamAccess = [];

            // First, add individual permissions (preserve them - they are independent of teams)
            for (const perm of individualPermissions) {
                teamAccess.push({
                    userId: perm.userId,
                    permission: perm.permission
                    // No restrictedTeamId - individual permission
                });
            }

            // Then, add permissions from other teams (preserve them)
            for (const [key, perm] of existingPermissionsMap.entries()) {
                const permTeamId = perm.restrictedTeamId;
                // If this permission is from a different team, preserve it
                if (permTeamId !== Number(teamId)) {
                    teamAccess.push({
                        userId: perm.userId,
                        permission: perm.permission,
                        restrictedTeamId: permTeamId
                    });
                }
            }

            // Then, add/update permissions for current team
            for (const [userId, permission] of Object.entries(teamPermissions)) {
                if (permission && permission !== 'none') {
                    // Check if user has permission in another team - if so, skip this user
                    const hasPermissionInOtherTeam = usersWithOtherTeamPermissions[selectedSurveyId]?.[userId] || false;
                    if (hasPermissionInOtherTeam) {
                        console.log(`[TeamManagement] Skipping user ${userId} - already has permission in another team`);
                        continue; // Skip this user, they already have permission in another team
                    }

                    // Check if member is in the team
                    const member = teamMembers.find(m => {
                        const memberId = m.userId || m.user?.userId || m.user?.id;
                        return String(memberId) === String(userId);
                    });
                    if (member) {
                        teamAccess.push({
                            userId: parseInt(userId),
                            permission: permission,
                            restrictedTeamId: teamId // Team-restricted permission
                        });
                    }
                }
            }

            await teamManagementService.updateSurveyPermissions(selectedSurveyId, {
                teamAccess
            });

            showNotification('success', 'Đã cập nhật quyền truy cập thành công!');

            // Reload permissions to reflect saved state
            await loadSurveyPermissions(selectedSurveyId, teamMembers, teamId);
        } catch (error) {
            console.error('Error saving permissions:', error);
            const errorMsg = error.response?.data?.message || 'Không thể lưu quyền truy cập.';
            showNotification('error', errorMsg);
        } finally {
            setSavingPermissions(false);
        }
    };


    // Check if user is owner of team
    const isOwner = useCallback((team) => {
        const user = getCurrentUser();
        const currentUserId = user?.userId || user?.id;
        return (team.ownerId || team.owner?.userId || team.owner?.id) === currentUserId;
    }, [getCurrentUser]);

    // Get role label in Vietnamese
    const getRoleLabel = (role) => {
        const roleMap = {
            'OWNER': 'Chủ sở hữu',
            'EDITOR': 'Biên tập',
            'ANALYST': 'Phân tích',
            'VIEWER': 'Xem'
        };
        return roleMap[role] || role;
    };

    // Get permission label in Vietnamese
    const getPermissionLabel = (permission) => {
        const permissionMap = {
            'EDITOR': 'Chỉnh sửa',
            'ANALYST': 'Phân tích',
            'VIEWER': 'Xem',
            'OWNER': 'Chủ sở hữu'
        };
        return permissionMap[permission] || permission || 'Không truy cập';
    };

    // Get status label
    const getStatusLabel = (status) => {
        const statusMap = {
            'published': 'Đang mở',
            'draft': 'Bản nháp',
            'archived': 'Đã đóng'
        };
        return statusMap[status] || status;
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="team-management-container">
                    <div className="team-loading">
                        <div className="loading-spinner"></div>
                        <p>Đang tải dữ liệu...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const selectedTeamId = selectedTeam ? (selectedTeam.teamId || selectedTeam.id) : null;

    return (
        <MainLayout>
            {notification && (
                <NotificationModal
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div className="team-management-container">
                <div className="team-layout">
                    {/* Left Sidebar - Teams List */}
                    <div className="teams-sidebar">
                        <div className="sidebar-header">
                            <h2>Danh sách Nhóm</h2>
                            <button
                                className="btn-add-team"
                                onClick={() => setShowCreateTeamModal(true)}
                                title="Tạo nhóm mới"
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                        </div>
                        <div className="teams-list">
                            {teams.length === 0 ? (
                                <div className="empty-sidebar">
                                    <p>Chưa có nhóm nào</p>
                                    {/* <button
                                        className="btn-add-first-team"
                                        onClick={() => setShowCreateTeamModal(true)}
                                    >
                                        Tạo nhóm đầu tiên
                                    </button> */}
                                </div>
                            ) : (
                                teams.map((team) => {
                                    const isSelected = selectedTeamId === (team.teamId || team.id);
                                    const isTeamOwner = isOwner(team);
                                    return (
                                        <div
                                            key={team.teamId || team.id}
                                            className={`team-list-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleSelectTeam(team)}
                                        >
                                            <div className="team-list-info">
                                                <div className="team-list-name">{team.name}</div>
                                                <div className="team-list-meta">
                                                    {team.memberCount || 0} thành viên
                                                </div>
                                            </div>
                                            <div className="team-list-actions">
                                                {isTeamOwner && (
                                                    <>
                                                        <i
                                                            className="fa-solid fa-pen"
                                                            onClick={(e) => handleEditTeamFromList(e, team)}
                                                            title="Chỉnh sửa nhóm"
                                                        ></i>
                                                        <i
                                                            className="fa-solid fa-trash"
                                                            onClick={(e) => handleDeleteTeam(e, team)}
                                                            title="Xóa nhóm"
                                                        ></i>
                                                    </>
                                                )}
                                                {/* <i className="fa-solid fa-chevron-right" title="icon mũi tên"></i> */}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Team Detail */}
                    <div className="team-detail-panel">
                        {!selectedTeam ? (
                            <div className="no-team-selected">
                                <div className="empty-icon">
                                    <i className="fa-solid fa-users"></i>
                                </div>
                                <p>Chọn một nhóm để xem chi tiết</p>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="team-detail-header">
                                    <div>
                                        <h1>{selectedTeam.name}</h1>
                                        <p>{selectedTeam.description || 'Quản lý khảo sát và chiến dịch'}</p>
                                    </div>
                                    {isOwner(selectedTeam) && (
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            {/* <button
                                                className="btn-edit-team"
                                                onClick={() => {
                                                    setEditTeamForm({
                                                        name: selectedTeam.name || '',
                                                        description: selectedTeam.description || ''
                                                    });
                                                    setShowEditTeamModal(true);
                                                }}
                                                title="Chỉnh sửa nhóm"
                                            >
                                                <i className="fa-solid fa-gear"></i>
                                            </button> */}
                                            <button
                                                className="btn-add-member"
                                                onClick={() => setShowInviteModal(true)}
                                            >
                                                <i className="fa-solid fa-user-plus"></i>
                                                Mời thành viên
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {loadingTeamDetail ? (
                                    <div className="team-detail-loading">
                                        <div className="loading-spinner"></div>
                                        <p>Đang tải...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Members Section */}
                                        <div className="detail-section">
                                            <h3>Thành viên</h3>
                                            <div className="table-container">
                                                <table className="members-table">
                                                    <thead>
                                                        <tr>
                                                            <th>THÀNH VIÊN</th>
                                                            <th>EMAIL</th>
                                                            <th>VAI TRÒ</th>
                                                            <th>HÀNH ĐỘNG</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {teamMembers.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="4" className="empty-cell">
                                                                    Chưa có thành viên nào
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            teamMembers.map((member) => (
                                                                <tr key={member.memberId || member.id}>
                                                                    <td>
                                                                        <div className="member-cell">
                                                                            <div className="member-avatar">
                                                                                {(member.fullName?.[0] || member.email?.[0] || 'U').toUpperCase()}
                                                                            </div>
                                                                            <span>{member.fullName || member.email}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td>{member.email}</td>
                                                                    <td>
                                                                        {member.role === 'OWNER' ? (
                                                                            <span className="role-badge owner">
                                                                                {getRoleLabel(member.role)}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="role-badge member">
                                                                                Thành viên
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        {/* Chỉ hiển thị nút xóa cho members không phải OWNER */}
                                                                        {member.role === 'OWNER' ? (
                                                                            <span className="action-dash">-</span>
                                                                        ) : isOwner(selectedTeam) ? (
                                                                            <button
                                                                                className="btn-delete-text"
                                                                                onClick={() => handleRemoveMember(member.memberId || member.id)}
                                                                            >
                                                                                Xóa
                                                                            </button>
                                                                        ) : (
                                                                            <span className="action-dash">-</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Permissions Section */}
                                        {isOwner(selectedTeam) ? (
                                            <div className="detail-section">
                                                <h3>Phân quyền cho {selectedTeam.name}</h3>
                                                <p className="section-description">
                                                    Chọn khảo sát và phân quyền truy cập cho từng thành viên trong nhóm
                                                </p>

                                                {loadingOwnerSurveys ? (
                                                    <div className="permissions-loading">
                                                        <div className="loading-spinner"></div>
                                                        <p>Đang tải khảo sát...</p>
                                                    </div>
                                                ) : ownerSurveys.length === 0 ? (
                                                    <div className="empty-permissions">
                                                        <p>Bạn chưa có khảo sát nào. Hãy tạo khảo sát trước.</p>
                                                    </div>
                                                ) : (
                                                    <div className="permissions-layout">
                                                        {/* Left: Owner's Surveys List */}
                                                        <div className="permissions-left">
                                                            <h4>Khảo sát của bạn</h4>
                                                            <div className="surveys-list-scroll">
                                                                {ownerSurveys.map((survey) => {
                                                                    const surveyId = survey.id || survey.surveyId;
                                                                    const createdDate = survey.createdAt || survey.created_at;
                                                                    const formattedDate = createdDate
                                                                        ? new Date(createdDate).toLocaleDateString('vi-VN')
                                                                        : '-';
                                                                    const status = survey.status || 'draft';
                                                                    const isSelected = selectedSurveyId === surveyId;

                                                                    return (
                                                                        <div
                                                                            key={surveyId}
                                                                            className={`survey-item-permission ${isSelected ? 'selected' : ''}`}
                                                                            onClick={() => handleSelectSurvey(surveyId)}
                                                                        >
                                                                            <div className="survey-item-header">
                                                                                <div className="survey-item-title">
                                                                                    {survey.title || 'Không có tiêu đề'}
                                                                                </div>
                                                                                <span className={`status-badge-small ${status}`}>
                                                                                    {getStatusLabel(status)}
                                                                                </span>
                                                                            </div>
                                                                            <div className="survey-item-date">
                                                                                {formattedDate}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Right: Members with Permissions for Selected Survey */}
                                                        <div className="permissions-right">
                                                            {!selectedSurveyId ? (
                                                                <div className="empty-permissions">
                                                                    <p>Chọn một khảo sát để phân quyền</p>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="permissions-right-header">
                                                                        <h4>
                                                                            {ownerSurveys.find(s => (s.id || s.surveyId) === selectedSurveyId)?.title || 'Khảo sát'}
                                                                        </h4>
                                                                        <button
                                                                            className="btn-save-permissions "
                                                                            onClick={handleSavePermissions}
                                                                            disabled={savingPermissions}
                                                                        >
                                                                            <i className="fa-solid fa-save"></i>
                                                                            {savingPermissions ? 'Đang lưu...' : 'Lưu quyền'}
                                                                        </button>
                                                                    </div>
                                                                    <div className="members-permissions-scroll">
                                                                        {teamMembers.length === 0 ? (
                                                                            <div className="empty-permissions">
                                                                                <p>Chưa có thành viên nào trong nhóm</p>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="members-permissions-list">
                                                                                <table className="members-permissions-table">
                                                                                    <thead>
                                                                                        <tr>
                                                                                            <th>THÀNH VIÊN</th>
                                                                                            <th>QUYỀN TRUY CẬP</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {teamMembers.map((member) => {
                                                                                            const userId = member.userId || member.user?.userId || member.user?.id || member.memberId || member.id;
                                                                                            const isOwnerMember = member.role === 'OWNER';
                                                                                            const teamId = selectedTeam.teamId || selectedTeam.id;
                                                                                            // Get permission for this specific team
                                                                                            const currentPermission = permissionsMatrix[selectedSurveyId]?.[teamId]?.[userId] || null;
                                                                                            // Check if user has permission in another team
                                                                                            const hasPermissionInOtherTeam = usersWithOtherTeamPermissions[selectedSurveyId]?.[userId] || false;
                                                                                            // User cannot be assigned permission if they have permission in another team
                                                                                            const isDisabled = isOwnerMember || savingPermissions || hasPermissionInOtherTeam;

                                                                                            return (
                                                                                                <tr key={userId}>
                                                                                                    <td>
                                                                                                        <div className="member-cell-inline">
                                                                                                            <div className="member-avatar-small">
                                                                                                                {(member.fullName?.[0] || member.email?.[0] || 'U').toUpperCase()}
                                                                                                            </div>
                                                                                                            <div>
                                                                                                                <div className="member-name-small">
                                                                                                                    {member.fullName || member.email}
                                                                                                                </div>
                                                                                                                <div className="member-email-small">
                                                                                                                    {member.email}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td>
                                                                                                        <select
                                                                                                            className="permission-select"
                                                                                                            value={hasPermissionInOtherTeam ? 'none' : (currentPermission || 'none')}
                                                                                                            onChange={(e) => handlePermissionChange(selectedSurveyId, userId, e.target.value)}
                                                                                                            disabled={isDisabled}
                                                                                                            title={hasPermissionInOtherTeam ? 'Thành viên này đã được phân quyền cho khảo sát này ở team khác' : (isOwnerMember ? 'Chủ sở hữu team' : '')}
                                                                                                        >
                                                                                                            <option value="none">Không truy cập</option>
                                                                                                            <option value="VIEWER">Xem</option>
                                                                                                            <option value="ANALYST">Phân tích</option>
                                                                                                            <option value="EDITOR">Chỉnh sửa</option>
                                                                                                        </select>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="detail-section">
                                                <h3>Vai trò của bạn trong các khảo sát</h3>
                                                <p className="section-description">
                                                    Xem các khảo sát bạn có quyền truy cập và vai trò của bạn trong từng khảo sát
                                                </p>

                                                {loadingDashboard ? (
                                                    <div className="permissions-loading">
                                                        <div className="loading-spinner"></div>
                                                        <p>Đang tải thông tin...</p>
                                                    </div>
                                                ) : dashboardData?.sharedSurveysDetail && dashboardData.sharedSurveysDetail.length > 0 ? (
                                                    <div className="table-container" style={{ marginTop: '16px' }}>
                                                        <table className="members-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>KHẢO SÁT</th>
                                                                    <th>VAI TRÒ</th>
                                                                    <th>ĐƯỢC CHIA SẺ QUA</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {dashboardData.sharedSurveysDetail.map((survey) => (
                                                                    <tr key={survey.surveyId}>
                                                                        <td>
                                                                            <div className="survey-name-cell">
                                                                                {survey.title || 'Không có tiêu đề'}
                                                                            </div>
                                                                        </td>
                                                                        <td>
                                                                            <span className={`permission-badge ${survey.permission?.toLowerCase() || 'no-access'}`}>
                                                                                {getPermissionLabel(survey.permission)}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            <span className="role-badge member">
                                                                                {survey.sharedVia === 'team' ? 'Nhóm' : 'Cá nhân'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="empty-permissions">
                                                        <p>Bạn chưa có quyền truy cập vào khảo sát nào</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Create Team Modal */}
                {showCreateTeamModal && (
                    <div className="team-mgmt-modal-overlay" onClick={() => setShowCreateTeamModal(false)}>
                        <div className="team-mgmt-modal" onClick={(e) => e.stopPropagation()}>
                            <button
                                className="team-mgmt-modal-close-btn"
                                onClick={() => setShowCreateTeamModal(false)}
                            >
                                ×
                            </button>
                            <div className="team-mgmt-modal-header">
                                <h3>Tạo nhóm mới</h3>
                                <p>Thêm nhóm mới để quản lý và chia sẻ khảo sát</p>
                            </div>
                            <form onSubmit={handleCreateTeam} className="team-mgmt-modal-body">
                                <div className="form-group">
                                    <label>Tên nhóm *</label>
                                    <input
                                        type="text"
                                        value={createTeamForm.name}
                                        onChange={(e) => setCreateTeamForm(prev => ({
                                            ...prev,
                                            name: e.target.value
                                        }))}
                                        placeholder="Nhập tên nhóm"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mô tả</label>
                                    <textarea
                                        value={createTeamForm.description}
                                        onChange={(e) => setCreateTeamForm(prev => ({
                                            ...prev,
                                            description: e.target.value
                                        }))}
                                        placeholder="Nhập mô tả (tùy chọn)"
                                        rows="3"
                                    />
                                </div>
                                <div className="team-mgmt-modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel-create-team"
                                        onClick={() => setShowCreateTeamModal(false)}
                                    >
                                        Hủy
                                    </button>
                                    <button type="submit" className="btn-create-team">
                                        Tạo nhóm
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Invite Member Modal */}
                {showInviteModal && selectedTeam && (
                    <div className="team-mgmt-modal-overlay" onClick={() => setShowInviteModal(false)}>
                        <div className="team-mgmt-modal" onClick={(e) => e.stopPropagation()}>
                            <button
                                className="team-mgmt-modal-close-btn"
                                onClick={() => setShowInviteModal(false)}
                            >
                                ×
                            </button>
                            <div className="team-mgmt-modal-header">
                                <h3>Mời thành viên</h3>
                                <p>Gửi lời mời tham gia nhóm "{selectedTeam.name}"</p>
                            </div>
                            <form onSubmit={handleSendInvitation} className="team-mgmt-modal-body">
                                <div className="form-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={inviteForm.email}
                                        onChange={(e) => setInviteForm({ email: e.target.value })}
                                        placeholder="email@example.com"
                                        required
                                    />
                                </div>
                                <div className="team-mgmt-modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel-invite-member"
                                        onClick={() => setShowInviteModal(false)}
                                    >
                                        Hủy
                                    </button>
                                    <button type="submit" className="btn-send-invitation">
                                        Gửi lời mời
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Team Modal */}
                {showEditTeamModal && selectedTeam && (
                    <div className="team-mgmt-modal-overlay" onClick={() => setShowEditTeamModal(false)}>
                        <div className="team-mgmt-modal" onClick={(e) => e.stopPropagation()}>
                            <button
                                className="team-mgmt-modal-close-btn"
                                onClick={() => setShowEditTeamModal(false)}
                            >
                                ×
                            </button>
                            <div className="team-mgmt-modal-header">
                                <h3>Chỉnh sửa nhóm</h3>
                                <p>Cập nhật thông tin nhóm "{selectedTeam.name}"</p>
                            </div>
                            <form onSubmit={handleUpdateTeam} className="team-mgmt-modal-body">
                                <div className="form-group">
                                    <label>Tên nhóm *</label>
                                    <input
                                        type="text"
                                        value={editTeamForm.name}
                                        onChange={(e) => setEditTeamForm(prev => ({
                                            ...prev,
                                            name: e.target.value
                                        }))}
                                        placeholder="Nhập tên nhóm"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mô tả</label>
                                    <textarea
                                        value={editTeamForm.description}
                                        onChange={(e) => setEditTeamForm(prev => ({
                                            ...prev,
                                            description: e.target.value
                                        }))}
                                        placeholder="Nhập mô tả (tùy chọn)"
                                        rows="3"
                                    />
                                </div>
                                <div className="team-mgmt-modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel-create-team"
                                        onClick={() => setShowEditTeamModal(false)}
                                    >
                                        Hủy
                                    </button>
                                    <button type="submit" className="btn-create-team">
                                        Lưu thay đổi
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </MainLayout>
    );
};

export default TeamManagementPage;
