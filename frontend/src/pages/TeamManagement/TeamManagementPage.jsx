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

    // Trạng thái modal
    const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditTeamModal, setShowEditTeamModal] = useState(false);

    // Nhóm được chọn để xem chi tiết
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [teamSurveys, setTeamSurveys] = useState([]);
    const [ownerSurveys, setOwnerSurveys] = useState([]); // Khảo sát thuộc sở hữu của người dùng hiện tại
    const [selectedSurveyId, setSelectedSurveyId] = useState(null); // Khảo sát được chọn để quản lý quyền
    const [loadingTeamDetail, setLoadingTeamDetail] = useState(false);
    const [loadingOwnerSurveys, setLoadingOwnerSurveys] = useState(false);
    // Ma trận quyền: { surveyId: { teamId: { userId: permission } } }
    // Cho phép cùng một người dùng trong các nhóm khác nhau có quyền khác nhau cho cùng một khảo sát
    const [permissionsMatrix, setPermissionsMatrix] = useState({});
    const [savingPermissions, setSavingPermissions] = useState(false);
    // Theo dõi người dùng có quyền ở các nhóm khác: { surveyId: { userId: true } }
    // Nếu người dùng đã có quyền ở nhóm khác, họ không thể được gán quyền ở nhóm này
    const [usersWithOtherTeamPermissions, setUsersWithOtherTeamPermissions] = useState({});
    // Dữ liệu dashboard cho thành viên (không phải chủ sở hữu)
    const [dashboardData, setDashboardData] = useState(null);
    const [loadingDashboard, setLoadingDashboard] = useState(false);
    // Tất cả khảo sát được phân quyền (kể cả team và user)
    const [allAccessibleSurveys, setAllAccessibleSurveys] = useState([]);
    const [loadingAllSurveys, setLoadingAllSurveys] = useState(false);

    // Trạng thái form
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

    // Tải danh sách nhóm và lời mời
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            console.log('[TeamManagement] Component mounted, loading data...');

            const teamsData = await teamManagementService.getMyTeams();

            const teamsList = Array.isArray(teamsData) ? teamsData : [];
            setTeams(teamsList);

            console.log('[TeamManagement] Teams loaded:', teamsList.length);

            // Tự động chọn nhóm đầu tiên chỉ một lần khi tải lần đầu
            if (!hasAutoSelectedRef.current && teamsList.length > 0) {
                hasAutoSelectedRef.current = true;
                const firstTeam = teamsList[0];
                setSelectedTeam(firstTeam);
                const teamId = firstTeam.teamId || firstTeam.id;
                console.log('[TeamManagement] Auto-selecting first team:', teamId);
                // loadTeamDetail sẽ được gọi bởi useEffect theo dõi selectedTeam
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
    }, []); // Mảng dependency rỗng - chỉ chạy khi mount

    // Chọn nhóm và tải chi tiết
    const handleSelectTeam = async (team) => {
        console.log('[TeamManagement] handleSelectTeam called with team:', team);
        setSelectedTeam(team);
        const teamId = team.teamId || team.id;
        console.log('[TeamManagement] Loading detail for teamId:', teamId);
        await loadTeamDetail(teamId);
    };

    // Hàm helper lấy người dùng hiện tại
    const getCurrentUser = useCallback(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || null;
        } catch {
            return null;
        }
    }, []);

    // Tải khảo sát của chủ sở hữu
    const loadOwnerSurveys = useCallback(async () => {
        try {
            setLoadingOwnerSurveys(true);
            // Lấy người dùng hiện tại
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

            // Lấy tất cả khảo sát thuộc sở hữu của người dùng hiện tại
            // Backend giới hạn size tối đa là 100, nên cần gọi nhiều lần để lấy tất cả
            let surveysList = [];
            let currentPage = 0;
            const pageSize = 100; // Backend giới hạn tối đa 100
            let hasMore = true;
            let totalPages = 1;

            while (hasMore && currentPage < 100) { // Giới hạn tối đa 100 trang để tránh vòng lặp vô hạn
                const response = await surveyService.getSurveys(currentPage, pageSize);
                console.log(`[TeamManagement] Surveys API response page ${currentPage}:`, response);

                let pageSurveys = [];
                if (response?.result && Array.isArray(response.result)) {
                    pageSurveys = response.result;
                    if (response?.meta) {
                        totalPages = response.meta.pages || 1;
                    }
                } else if (Array.isArray(response)) {
                    pageSurveys = response;
                } else if (Array.isArray(response?.data)) {
                    pageSurveys = response.data;
                } else if (response?.meta && response?.result) {
                    pageSurveys = Array.isArray(response.result) ? response.result : [];
                    totalPages = response.meta.pages || 1;
                }

                surveysList = surveysList.concat(pageSurveys);

                // Kiểm tra xem còn trang nào không
                currentPage++;
                hasMore = currentPage < totalPages && pageSurveys.length === pageSize;
            }

            console.log('[TeamManagement] Total surveys loaded:', surveysList.length);

            console.log('[TeamManagement] All surveys from API:', surveysList.length, 'surveys');
            if (surveysList.length > 0) {
                console.log('[TeamManagement] Survey sample:', surveysList[0]);
                console.log('[TeamManagement] Survey userId fields:', {
                    'survey.userId': surveysList[0].userId,
                    'survey.user?.userId': surveysList[0].user?.userId,
                    'survey.user?.id': surveysList[0].user?.id
                });
            }

            // Chuyển đổi cả hai sang string để so sánh tránh lỗi type mismatch
            const currentUserIdStr = String(currentUserId);
            console.log('[TeamManagement] Comparing with userId (as string):', currentUserIdStr);

            // Lọc chỉ các khảo sát thuộc sở hữu của người dùng hiện tại
            const ownedSurveys = surveysList.filter(survey => {
                const ownerId = survey.userId || survey.user?.userId || survey.user?.id;
                const ownerIdStr = ownerId ? String(ownerId) : null;

                const isMatch = ownerIdStr === currentUserIdStr;

                if (surveysList.length <= 5) {
                    // Chỉ log cho vài khảo sát đầu tiên để tránh spam
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

            // Tự động chọn khảo sát đầu tiên nếu có và chưa có khảo sát nào được chọn
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

    // Tải quyền hiện có cho một khảo sát và nhóm cụ thể
    const loadSurveyPermissions = useCallback(async (surveyId, members, teamId) => {
        if (!surveyId || !members || members.length === 0 || !teamId) return;

        try {
            const permissions = await teamManagementService.getSurveyPermissions(surveyId);
            if (permissions?.users && Array.isArray(permissions.users)) {
                const teamPermissions = {};
                const usersWithOtherTeamPerms = {}; // Theo dõi người dùng có quyền ở các nhóm khác
                // Chuyển đổi teamId sang number để so sánh
                const currentTeamIdNum = Number(teamId);

                for (const perm of permissions.users) {
                    const userId = perm.userId || perm.user?.userId || perm.user?.id;
                    if (!userId) continue;

                    // Kiểm tra xem thành viên có trong nhóm hiện tại không
                    const member = members.find(m => {
                        const memberId = m.userId || m.user?.userId || m.user?.id;
                        return Number(memberId) === Number(userId);
                    });

                    if (member && perm.permission) {
                        const permTeamId = perm.restrictedTeamId ? Number(perm.restrictedTeamId) : null;

                        if (permTeamId && permTeamId === currentTeamIdNum) {
                            // Quyền cho nhóm hiện tại
                            teamPermissions[Number(userId)] = perm.permission;
                        } else if (permTeamId && permTeamId !== currentTeamIdNum) {
                            // Người dùng có quyền ở nhóm khác - đánh dấu là bị khóa
                            usersWithOtherTeamPerms[Number(userId)] = true;
                        } else if (!permTeamId) {
                            // Quyền không bị giới hạn bởi nhóm (quyền toàn cục)
                            // Điều này cũng có nghĩa là người dùng không thể được gán quyền cụ thể cho nhóm
                            usersWithOtherTeamPerms[Number(userId)] = true;
                        }
                    }
                }

                // Cập nhật ma trận quyền với cấu trúc cụ thể cho từng nhóm
                setPermissionsMatrix(prev => ({
                    ...prev,
                    [surveyId]: {
                        ...(prev[surveyId] || {}),
                        [teamId]: teamPermissions
                    }
                }));

                // Cập nhật người dùng có quyền ở các nhóm khác
                setUsersWithOtherTeamPermissions(prev => ({
                    ...prev,
                    [surveyId]: {
                        ...(prev[surveyId] || {}),
                        ...usersWithOtherTeamPerms
                    }
                }));
            } else {
                // Không tìm thấy quyền, đặt rỗng cho nhóm này
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
            // Nếu chưa có quyền nào, không sao - chỉ cần đặt rỗng cho nhóm này
            setPermissionsMatrix(prev => ({
                ...prev,
                [surveyId]: {
                    ...(prev[surveyId] || {}),
                    [teamId]: {}
                }
            }));
        }
    }, []);

    // Tải dữ liệu dashboard cho thành viên (không phải chủ sở hữu)
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

    // Tải tất cả khảo sát được phân quyền (kể cả team và user)
    const loadAllAccessibleSurveys = useCallback(async (currentTeamSurveys = []) => {
        try {
            setLoadingAllSurveys(true);
            console.log('[TeamManagement] Loading all accessible surveys...');

            // Lấy tất cả khảo sát mà user có quyền truy cập
            const response = await surveyService.getSurveys(0, 1000);
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

            // Lấy thông tin permission từ dashboard
            const dashboard = await teamManagementService.getUserDashboard();
            const sharedSurveysMap = new Map();
            if (dashboard?.sharedSurveysDetail) {
                dashboard.sharedSurveysDetail.forEach(s => {
                    sharedSurveysMap.set(s.surveyId, s);
                });
            }

            // Kết hợp với teamSurveys nếu có
            const teamSurveysMap = new Map();
            currentTeamSurveys.forEach(s => {
                teamSurveysMap.set(s.surveyId, s);
            });

            // Tạo danh sách tất cả khảo sát với đầy đủ thông tin
            const allSurveys = surveysList.map(survey => {
                const surveyId = survey.id || survey.surveyId;
                const sharedInfo = sharedSurveysMap.get(surveyId);
                const teamSurveyInfo = teamSurveysMap.get(surveyId);

                // Ưu tiên thông tin từ teamSurveys (có đầy đủ owner và status)
                if (teamSurveyInfo) {
                    return {
                        surveyId: surveyId,
                        title: teamSurveyInfo.title || survey.title,
                        permission: teamSurveyInfo.permission,
                        ownerName: teamSurveyInfo.ownerName || survey.userName || 'Không rõ',
                        status: teamSurveyInfo.status || survey.status || 'draft',
                        sharedVia: 'team' // Chia sẻ qua team
                    };
                }

                // Nếu không có trong teamSurveys, sử dụng thông tin từ sharedSurveysDetail
                if (sharedInfo) {
                    return {
                        surveyId: surveyId,
                        title: sharedInfo.title || survey.title,
                        permission: sharedInfo.permission,
                        ownerName: survey.userName || 'Không rõ',
                        status: survey.status || 'draft',
                        sharedVia: sharedInfo.sharedVia || 'user' // Lấy từ sharedInfo hoặc mặc định là user
                    };
                }

                // Nếu là survey của chính user (owner), permission là OWNER
                const user = getCurrentUser();
                const currentUserId = user?.userId || user?.id;
                const ownerId = survey.userId || survey.user?.userId || survey.user?.id;
                const isOwner = String(ownerId) === String(currentUserId);

                return {
                    surveyId: surveyId,
                    title: survey.title,
                    permission: isOwner ? 'OWNER' : null,
                    ownerName: survey.userName || 'Không rõ',
                    status: survey.status || 'draft',
                    sharedVia: isOwner ? null : 'user' // Owner không có sharedVia, còn lại là user
                };
            }).filter(s => s.permission); // Chỉ lấy các survey có permission

            console.log('[TeamManagement] All accessible surveys loaded:', allSurveys.length);
            setAllAccessibleSurveys(allSurveys);
        } catch (error) {
            console.error('[TeamManagement] Error loading all accessible surveys:', error);
            setNotification({ type: 'error', message: 'Không thể tải danh sách khảo sát.' });
        } finally {
            setLoadingAllSurveys(false);
        }
    }, [getCurrentUser]);

    // Tải chi tiết nhóm
    const loadTeamDetail = useCallback(async (teamId, preserveSelectedSurvey = false) => {
        try {
            setLoadingTeamDetail(true);

            // Lưu khảo sát được chọn hiện tại nếu muốn giữ lại
            const currentSelectedSurveyId = preserveSelectedSurvey ? selectedSurveyId : null;

            if (!preserveSelectedSurvey) {
                setSelectedSurveyId(null); // Đặt lại khảo sát được chọn
                // Không đặt lại toàn bộ ma trận quyền - giữ quyền cho các nhóm khác
                // Chỉ xóa quyền cho nhóm này nếu cần
            }

            console.log('[TeamManagement] Loading team detail for teamId:', teamId);

            const [membersResponse, teamSurveysResponse] = await Promise.all([
                teamManagementService.getTeamMembers(teamId),
                teamManagementService.getTeamSurveys(teamId)
            ]);

            const membersList = Array.isArray(membersResponse) ? membersResponse : [];
            setTeamMembers(membersList);

            const surveysList = Array.isArray(teamSurveysResponse?.surveys)
                ? teamSurveysResponse.surveys
                : Array.isArray(teamSurveysResponse)
                    ? teamSurveysResponse
                    : [];
            setTeamSurveys(surveysList);

            console.log('[TeamManagement] Team members loaded:', membersList.length);
            console.log('[TeamManagement] Team surveys loaded:', surveysList.length);

            // Tải khảo sát của chủ sở hữu nếu người dùng là chủ sở hữu, nếu không thì tải dữ liệu dashboard
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

            // Chuyển đổi cả hai sang string để so sánh tránh lỗi type mismatch
            const currentUserIdStr = String(currentUserId);
            const teamOwnerId = team.ownerId || team.owner?.userId || team.owner?.id;
            const teamOwnerIdStr = teamOwnerId ? String(teamOwnerId) : null;
            const isTeamOwner = teamOwnerIdStr === currentUserIdStr;

            console.log('[TeamManagement] Team ownerId:', teamOwnerId, '(type:', typeof teamOwnerId, ', as string:', teamOwnerIdStr, ')');
            console.log('[TeamManagement] Is team owner?', isTeamOwner);

            if (isTeamOwner) {
                console.log('[TeamManagement] ✅ User is team owner, loading owner surveys...');
                // Tải tất cả khảo sát của chủ sở hữu
                await loadOwnerSurveys();

                // Nếu đã giữ lại khảo sát được chọn, tải lại quyền của nó với danh sách thành viên mới
                if (preserveSelectedSurvey && currentSelectedSurveyId && membersList.length > 0) {
                    await loadSurveyPermissions(currentSelectedSurveyId, membersList, teamId);
                }
            } else {
                console.log('[TeamManagement] ❌ User is NOT team owner, loading dashboard data...');
                // Tải dữ liệu dashboard để hiển thị quyền của thành viên
                await loadDashboardData();
            }

            // Tải tất cả khảo sát được phân quyền
            await loadAllAccessibleSurveys(surveysList);
        } catch (error) {
            console.error('[TeamManagement] Error loading team detail:', error);
            console.error('[TeamManagement] Error details:', error.response?.data);
            setNotification({ type: 'error', message: 'Không thể tải thông tin team.' });
        } finally {
            setLoadingTeamDetail(false);
        }
    }, [getCurrentUser, loadOwnerSurveys, loadSurveyPermissions, selectedSurveyId, loadDashboardData]);

    // Effect để tải chi tiết nhóm khi selectedTeam thay đổi (cho tự động chọn khi tải lần đầu)
    useEffect(() => {
        if (selectedTeam && hasAutoSelectedRef.current && !loadingTeamDetail) {
            const teamId = selectedTeam.teamId || selectedTeam.id;
            console.log('[TeamManagement] Auto-selected team detected, loading detail for:', teamId);
            loadTeamDetail(teamId);
            // Đặt lại ref để chỉ chạy một lần
            hasAutoSelectedRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeam?.teamId || selectedTeam?.id]); // Chỉ khi team ID thay đổi

    // Effect để tự động tải quyền khi khảo sát được chọn và có thành viên
    useEffect(() => {
        if (selectedSurveyId && teamMembers.length > 0 && selectedTeam && !loadingTeamDetail && !loadingOwnerSurveys) {
            const teamId = selectedTeam.teamId || selectedTeam.id;
            // Kiểm tra xem quyền đã được tải cho khảo sát và nhóm này chưa
            const currentPermissions = permissionsMatrix[selectedSurveyId]?.[teamId];
            if (!currentPermissions || Object.keys(currentPermissions).length === 0) {
                console.log('[TeamManagement] Auto-loading permissions for selected survey:', selectedSurveyId, 'and team:', teamId);
                loadSurveyPermissions(selectedSurveyId, teamMembers, teamId);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSurveyId, teamMembers.length, loadingTeamDetail, loadingOwnerSurveys, selectedTeam?.teamId || selectedTeam?.id]);

    // Tạo nhóm
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

            // Tự động chọn nhóm mới
            await handleSelectTeam(newTeam);
        } catch (error) {
            console.error('Error creating team:', error);
            const errorMsg = error.response?.data?.message || 'Không thể tạo team. Vui lòng thử lại.';
            showNotification('error', errorMsg);
        }
    };

    // Gửi lời mời
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

            // Giữ lại khảo sát được chọn khi tải lại (trong trường hợp người dùng đang xem quyền)
            await loadTeamDetail(teamId, true); // Tải lại để hiển thị số lượng thành viên đã cập nhật

            // Kích hoạt tải lại thông báo sau một khoảng thời gian ngắn để đảm bảo backend đã xử lý
            // Điều này đảm bảo các thông báo TEAM_INVITATION trùng lặp được lọc chính xác
            setTimeout(() => {
                window.dispatchEvent(new Event('reloadNotifications'));
            }, 500);
        } catch (error) {
            console.error('Error sending invitation:', error);
            const errorMsg = error.response?.data?.message || 'Không thể gửi lời mời.';
            showNotification('error', errorMsg);
        }
    };

    // Cập nhật nhóm
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

            // Cập nhật nhóm được chọn trong state
            setSelectedTeam(updatedTeam);

            // Cập nhật nhóm trong danh sách nhóm
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

    // Xử lý cập nhật lời mời từ component Notification
    const handleInvitationUpdate = async () => {
        // Tải lại danh sách nhóm khi lời mời được chấp nhận
        try {
            const teamsData = await teamManagementService.getMyTeams();
            const teamsList = Array.isArray(teamsData) ? teamsData : [];
            setTeams(teamsList);
        } catch (error) {
            console.error('Error reloading teams:', error);
        }
    };

    // Chỉnh sửa nhóm từ danh sách
    const handleEditTeamFromList = (e, team) => {
        e.stopPropagation(); // Ngăn chặn việc chọn nhóm
        setSelectedTeam(team);
        setEditTeamForm({
            name: team.name || '',
            description: team.description || ''
        });
        setShowEditTeamModal(true);
    };

    // Xóa nhóm
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

            // Xóa nhóm được chọn nếu đó là nhóm bị xóa
            if (selectedTeam && (selectedTeam.teamId || selectedTeam.id) === teamId) {
                setSelectedTeam(null);
                setTeamMembers([]);
                setTeamSurveys([]);
                setSelectedSurveyId(null);
                setPermissionsMatrix({});
            }

            // Xóa quyền khỏi permissionsMatrix cho nhóm này
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

            // Tải lại danh sách nhóm
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

    // Xóa thành viên khỏi nhóm
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

            // Cập nhật số lượng thành viên trong danh sách nhóm bên trái
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
    // Xử lý chọn khảo sát
    const handleSelectSurvey = async (surveyId) => {
        if (selectedSurveyId === surveyId) return; // Đã được chọn

        setSelectedSurveyId(surveyId);
        // Tải quyền cho khảo sát được chọn
        if (teamMembers.length > 0 && selectedTeam) {
            const teamId = selectedTeam.teamId || selectedTeam.id;
            await loadSurveyPermissions(surveyId, teamMembers, teamId);
        }
    };

    // Xử lý thay đổi quyền
    const handlePermissionChange = (surveyId, userId, permission) => {
        if (!selectedTeam) return;
        const teamId = selectedTeam.teamId || selectedTeam.id;

        // Kiểm tra xem người dùng có quyền ở nhóm khác không - nếu có, không cho phép thay đổi
        const hasPermissionInOtherTeam = usersWithOtherTeamPermissions[surveyId]?.[userId] || false;
        if (hasPermissionInOtherTeam) {
            console.log(`[TeamManagement] Cannot change permission for user ${userId} - already has permission in another team`);
            return; // Không cho phép thay đổi
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

    // Lưu quyền cho khảo sát và nhóm được chọn
    const handleSavePermissions = async () => {
        if (!selectedTeam || !selectedSurveyId || savingPermissions) return;

        try {
            setSavingPermissions(true);
            const teamId = selectedTeam.teamId || selectedTeam.id;

            // Lấy quyền cho nhóm cụ thể này
            const teamPermissions = permissionsMatrix[selectedSurveyId]?.[teamId] || {};

            // Tải TẤT CẢ quyền hiện có cho khảo sát này trước
            const allPermissions = await teamManagementService.getSurveyPermissions(selectedSurveyId);
            const allUsersPermissions = allPermissions?.users || [];

            // Xây dựng map của quyền hiện có: userId -> { permission, restrictedTeamId }
            // Theo dõi CẢ quyền bị giới hạn bởi nhóm VÀ quyền cá nhân (không có restrictedTeamId)
            const existingPermissionsMap = new Map();
            const individualPermissions = []; // Lưu quyền cá nhân riêng biệt

            for (const perm of allUsersPermissions) {
                const userId = perm.userId || perm.user?.userId || perm.user?.id;
                if (userId) {
                    if (perm.restrictedTeamId) {
                        // Quyền bị giới hạn bởi nhóm
                        const key = `${userId}_${perm.restrictedTeamId}`;
                        existingPermissionsMap.set(key, {
                            userId: Number(userId),
                            permission: perm.permission,
                            restrictedTeamId: Number(perm.restrictedTeamId)
                        });
                    } else {
                        // Quyền cá nhân (không có restrictedTeamId) - giữ lại những quyền này
                        individualPermissions.push({
                            userId: Number(userId),
                            permission: perm.permission
                            // Không có restrictedTeamId - đây là quyền cá nhân
                        });
                    }
                }
            }

            // Xây dựng mảng teamAccess: bao gồm quyền từ TẤT CẢ các nhóm VÀ quyền cá nhân
            const teamAccess = [];

            // Đầu tiên, thêm quyền cá nhân (giữ lại chúng - chúng độc lập với nhóm)
            for (const perm of individualPermissions) {
                teamAccess.push({
                    userId: perm.userId,
                    permission: perm.permission
                    // Không có restrictedTeamId - quyền cá nhân
                });
            }

            // Sau đó, thêm quyền từ các nhóm khác (giữ lại chúng)
            for (const [key, perm] of existingPermissionsMap.entries()) {
                const permTeamId = perm.restrictedTeamId;
                // Nếu quyền này từ nhóm khác, giữ lại
                if (permTeamId !== Number(teamId)) {
                    teamAccess.push({
                        userId: perm.userId,
                        permission: perm.permission,
                        restrictedTeamId: permTeamId
                    });
                }
            }

            // Sau đó, thêm/cập nhật quyền cho nhóm hiện tại
            for (const [userId, permission] of Object.entries(teamPermissions)) {
                if (permission && permission !== 'none') {
                    // Kiểm tra xem người dùng có quyền ở nhóm khác không - nếu có, bỏ qua người dùng này
                    const hasPermissionInOtherTeam = usersWithOtherTeamPermissions[selectedSurveyId]?.[userId] || false;
                    if (hasPermissionInOtherTeam) {
                        console.log(`[TeamManagement] Skipping user ${userId} - already has permission in another team`);
                        continue; // Bỏ qua người dùng này, họ đã có quyền ở nhóm khác
                    }

                    // Kiểm tra xem thành viên có trong nhóm không
                    const member = teamMembers.find(m => {
                        const memberId = m.userId || m.user?.userId || m.user?.id;
                        return String(memberId) === String(userId);
                    });
                    if (member) {
                        teamAccess.push({
                            userId: parseInt(userId),
                            permission: permission,
                            restrictedTeamId: teamId // Quyền bị giới hạn bởi nhóm
                        });
                    }
                }
            }

            await teamManagementService.updateSurveyPermissions(selectedSurveyId, {
                teamAccess
            });

            showNotification('success', 'Đã cập nhật quyền truy cập thành công!');

            // Tải lại quyền để phản ánh trạng thái đã lưu
            await loadSurveyPermissions(selectedSurveyId, teamMembers, teamId);
        } catch (error) {
            console.error('Error saving permissions:', error);
            const errorMsg = error.response?.data?.message || 'Không thể lưu quyền truy cập.';
            showNotification('error', errorMsg);
        } finally {
            setSavingPermissions(false);
        }
    };


    // Kiểm tra xem người dùng có phải là chủ sở hữu của nhóm không
    const isOwner = useCallback((team) => {
        const user = getCurrentUser();
        const currentUserId = user?.userId || user?.id;
        return (team.ownerId || team.owner?.userId || team.owner?.id) === currentUserId;
    }, [getCurrentUser]);

    // Lấy nhãn vai trò bằng tiếng Việt
    const getRoleLabel = (role) => {
        const roleMap = {
            'OWNER': 'Chủ sở hữu',
            'EDITOR': 'Biên tập',
            'ANALYST': 'Phân tích',
            'VIEWER': 'Xem'
        };
        return roleMap[role] || role;
    };

    // Lấy nhãn quyền bằng tiếng Việt
    const getPermissionLabel = (permission) => {
        const permissionMap = {
            'EDITOR': 'Chỉnh sửa',
            'ANALYST': 'Phân tích',
            'VIEWER': 'Xem',
            'OWNER': 'Chủ sở hữu'
        };
        return permissionMap[permission] || permission || 'Không truy cập';
    };

    // Lấy nhãn trạng thái
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
                                                                                            // Lấy quyền cho nhóm cụ thể này
                                                                                            const currentPermission = permissionsMatrix[selectedSurveyId]?.[teamId]?.[userId] || null;
                                                                                            // Kiểm tra xem người dùng có quyền ở nhóm khác không
                                                                                            const hasPermissionInOtherTeam = usersWithOtherTeamPermissions[selectedSurveyId]?.[userId] || false;
                                                                                            // Người dùng không thể được gán quyền nếu họ đã có quyền ở nhóm khác
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
                                            <>
                                                {/* Bảng Quyền truy cập - Tất cả khảo sát được phân quyền */}
                                                <div className="detail-section">
                                                    <h3>Quyền truy cập</h3>
                                                    <p className="section-description">
                                                        Tất cả các khảo sát mà bạn được cấp quyền truy cập
                                                    </p>

                                                    {loadingAllSurveys ? (
                                                        <div className="permissions-loading">
                                                            <div className="loading-spinner"></div>
                                                            <p>Đang tải thông tin...</p>
                                                        </div>
                                                    ) : allAccessibleSurveys.length > 0 ? (
                                                        <div className="table-container" style={{ marginTop: '16px' }}>
                                                            <table className="members-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>KHẢO SÁT</th>
                                                                        <th>QUYỀN CỦA BẠN</th>
                                                                        <th>CHỦ SỞ HỮU</th>
                                                                        <th>TRẠNG THÁI</th>
                                                                        <th>ĐƯỢC CHIA SẺ QUA</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {allAccessibleSurveys.map((survey) => (
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
                                                                            <td>{survey.ownerName || 'Không rõ'}</td>
                                                                            <td>
                                                                                <span className={`status-badge-small ${(survey.status || 'draft').toLowerCase()}`}>
                                                                                    {getStatusLabel((survey.status || '').toLowerCase())}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                {survey.sharedVia ? (
                                                                                    <span className={`role-badge ${survey.sharedVia === 'team' ? 'team' : 'individual'}`}>
                                                                                        {survey.sharedVia === 'team' ? 'Nhóm' : 'Cá nhân'}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="role-badge member">-</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="empty-permissions">
                                                            <p>Bạn chưa có quyền truy cập khảo sát nào</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
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
