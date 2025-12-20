import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './AdminPage.css';
import HeaderComponent from '../../components/HeaderComponent';

// Component Pagination riêng cho Admin
const AdminPagination = ({ currentPage, totalPages, totalElements, pageSize, onPageChange }) => {
  const [jumpToPage, setJumpToPage] = useState('');

  // Tính toán số bản ghi hiển thị
  const startRecord = currentPage * pageSize + 1;
  const endRecord = Math.min((currentPage + 1) * pageSize, totalElements);

  // Tạo danh sách số trang hiển thị
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 7;
    let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);

    // Điều chỉnh nếu gần cuối
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    // Thêm trang đầu nếu cần
    if (startPage > 0) {
      pages.push(0);
      if (startPage > 1) {
        pages.push('...');
      }
    }

    // Thêm các trang trong khoảng
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Thêm trang cuối nếu cần
    if (endPage < totalPages - 1) {
      if (endPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages - 1);
    }

    return pages;
  };

  const handleJumpToPage = () => {
    const page = parseInt(jumpToPage) - 1;
    if (page >= 0 && page < totalPages) {
      onPageChange(page);
      setJumpToPage('');
    }
  };

  if (totalPages <= 1) {
    return (
      <div className="admin-pagination">
        <div className="admin-pagination-info-text">
          Hiển thị {startRecord} - {endRecord} trong tổng số {totalElements} bản ghi
        </div>
      </div>
    );
  }

  return (
    <div className="admin-pagination">
      <div className="admin-pagination-left">
        <div className="admin-pagination-info-text">
          Hiển thị <strong>{startRecord}</strong> - <strong>{endRecord}</strong> trong tổng số <strong>{totalElements}</strong> bản ghi
        </div>
      </div>

      <div className="admin-pagination-center">
        <button
          className="admin-pagination-btn admin-pagination-btn-icon"
          onClick={() => onPageChange(0)}
          disabled={currentPage === 0}
          title="Trang đầu"
        >
          <i className="fa-solid fa-angles-left"></i>
        </button>

        <button
          className="admin-pagination-btn admin-pagination-btn-icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          title="Trang trước"
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>

        {getPageNumbers().map((pageNum, index) => {
          if (pageNum === '...') {
            return (
              <span key={`ellipsis-${index}`} className="admin-pagination-ellipsis">
                ...
              </span>
            );
          }

          return (
            <button
              key={pageNum}
              className={`admin-pagination-btn admin-pagination-btn-number ${currentPage === pageNum ? 'active' : ''}`}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum + 1}
            </button>
          );
        })}

        <button
          className="admin-pagination-btn admin-pagination-btn-icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          title="Trang sau"
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>

        <button
          className="admin-pagination-btn admin-pagination-btn-icon"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={currentPage >= totalPages - 1}
          title="Trang cuối"
        >
          <i className="fa-solid fa-angles-right"></i>
        </button>
      </div>

      <div className="admin-pagination-right">
        <div className="admin-pagination-jump">
          <span>Đi đến trang:</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={jumpToPage}
            onChange={(e) => setJumpToPage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleJumpToPage()}
            placeholder={currentPage + 1}
            className="admin-pagination-jump-input"
          />
          <button
            className="admin-pagination-jump-btn"
            onClick={handleJumpToPage}
            disabled={!jumpToPage || jumpToPage < 1 || jumpToPage > totalPages}
          >
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Helper: Lấy ngày hôm nay dạng YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Helper: Convert date string to ISO string với time đúng
  const dateToISOString = (dateString, isEndDate = false) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isEndDate) {
      // Đặt time là 23:59:59.999 cho ngày kết thúc
      date.setHours(23, 59, 59, 999);
    } else {
      // Đặt time là 00:00:00 cho ngày bắt đầu
      date.setHours(0, 0, 0, 0);
    }
    return date.toISOString();
  };
  
  // Dashboard state
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editUserForm, setEditUserForm] = useState({ fullName: '', role: '' });
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showToggleStatusConfirm, setShowToggleStatusConfirm] = useState(false);
  const [userToToggleStatus, setUserToToggleStatus] = useState(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ fullName: '', email: '', password: '', role: 'creator' });
  
  // Surveys state
  const [surveys, setSurveys] = useState([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);
  const [surveyPage, setSurveyPage] = useState(0);
  const [surveyPageSize, setSurveyPageSize] = useState(10);
  const [surveyTotalPages, setSurveyTotalPages] = useState(0);
  const [surveyTotalElements, setSurveyTotalElements] = useState(0);
  const [surveySearch, setSurveySearch] = useState('');
  const [surveyStatusFilter, setSurveyStatusFilter] = useState('');
  const [surveyUserIdFilter, setSurveyUserIdFilter] = useState('');
  const [surveyCategoryFilter, setSurveyCategoryFilter] = useState('');
  const [surveyDateFrom, setSurveyDateFrom] = useState('');
  const [surveyDateTo, setSurveyDateTo] = useState('');
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [showSurveyDetailModal, setShowSurveyDetailModal] = useState(false);
  const [showDeleteSurveyConfirm, setShowDeleteSurveyConfirm] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState(null);
  const [editingStatusSurveyId, setEditingStatusSurveyId] = useState(null);
  
  // Activity Logs state (Survey History)
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [activityLogPage, setActivityLogPage] = useState(0);
  const [activityLogPageSize, setActivityLogPageSize] = useState(10);
  const [activityLogTotalPages, setActivityLogTotalPages] = useState(0);
  const [activityLogTotalElements, setActivityLogTotalElements] = useState(0);
  const [activityLogUserIdFilter, setActivityLogUserIdFilter] = useState('');
  const [activityLogActionTypeFilter, setActivityLogActionTypeFilter] = useState('');
  const [activityLogDateFrom, setActivityLogDateFrom] = useState('');
  const [activityLogDateTo, setActivityLogDateTo] = useState('');
  
  
  // Error state
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Check admin role
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/dashboard');
      return;
    }
    
    try {
      const user = JSON.parse(userStr);
      if (!user || user.role !== 'admin') {
        navigate('/dashboard');
        return;
      }
    } catch (err) {
      console.error('Parse user error:', err);
      navigate('/dashboard');
    }
  }, [navigate]);

  // Load dashboard
  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
      setLoadingDashboard(true);
      }
      setError(null);
      const data = await adminService.getDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Load dashboard error:', err);
      // Nếu 403 hoặc 401 thì redirect về dashboard (không có quyền)
      if (err.response?.status === 403 || err.response?.status === 401) {
        navigate('/dashboard');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Lỗi khi tải dashboard');
      showNotification('error', 'Không thể tải dashboard');
    } finally {
      setLoadingDashboard(false);
      setRefreshing(false);
    }
  }, [navigate]);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setError(null);
      const data = await adminService.getUsers(
        currentPage,
        pageSize,
        search,
        roleFilter,
        activeFilter
      );
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (err) {
      console.error('Load users error:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi tải danh sách users');
      showNotification('error', 'Không thể tải danh sách users');
    } finally {
      setLoadingUsers(false);
    }
  }, [currentPage, pageSize, search, roleFilter, activeFilter]);

  // Load surveys
  const loadSurveys = useCallback(async () => {
    try {
      setLoadingSurveys(true);
      setError(null);
      // Validate và convert dates đúng cách
      let dateFrom = null;
      let dateTo = null;
      if (surveyDateFrom) {
        dateFrom = dateToISOString(surveyDateFrom, false);
      }
      if (surveyDateTo) {
        dateTo = dateToISOString(surveyDateTo, true);
      }
      // Validate: dateFrom không được lớn hơn dateTo
      if (dateFrom && dateTo && dateFrom > dateTo) {
        setError('Ngày bắt đầu không được lớn hơn ngày kết thúc');
        return;
      }
      const data = await adminService.getSurveys(
        surveyPage,
        surveyPageSize,
        surveySearch,
        surveyStatusFilter,
        surveyUserIdFilter || null,
        surveyCategoryFilter || null,
        dateFrom,
        dateTo
      );
      setSurveys(data.surveys || []);
      setSurveyTotalPages(data.totalPages || 0);
      setSurveyTotalElements(data.totalElements || 0);
    } catch (err) {
      console.error('Load surveys error:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi tải danh sách surveys');
      showNotification('error', 'Không thể tải danh sách surveys');
    } finally {
      setLoadingSurveys(false);
    }
  }, [surveyPage, surveyPageSize, surveySearch, surveyStatusFilter, surveyUserIdFilter, surveyCategoryFilter, surveyDateFrom, surveyDateTo]);

  // Load activity logs (Survey History)
  const loadActivityLogs = useCallback(async () => {
    try {
      setLoadingActivityLogs(true);
      setError(null);
      // Validate và convert dates đúng cách
      let dateFrom = null;
      let dateTo = null;
      if (activityLogDateFrom) {
        dateFrom = dateToISOString(activityLogDateFrom, false);
      }
      if (activityLogDateTo) {
        dateTo = dateToISOString(activityLogDateTo, true);
      }
      // Validate: dateFrom không được lớn hơn dateTo
      if (dateFrom && dateTo && dateFrom > dateTo) {
        setError('Ngày bắt đầu không được lớn hơn ngày kết thúc');
        return;
      }
      const data = await adminService.getActivityLogs(
        activityLogPage,
        activityLogPageSize,
        activityLogUserIdFilter || null,
        activityLogActionTypeFilter,
        dateFrom,
        dateTo
      );
      setActivityLogs(data.activityLogs || []);
      setActivityLogTotalPages(data.totalPages || 0);
      setActivityLogTotalElements(data.totalElements || 0);
    } catch (err) {
      console.error('Load activity logs error:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi tải danh sách activity logs');
      showNotification('error', 'Không thể tải danh sách activity logs');
    } finally {
      setLoadingActivityLogs(false);
    }
  }, [activityLogPage, activityLogPageSize, activityLogUserIdFilter, activityLogActionTypeFilter, activityLogDateFrom, activityLogDateTo]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'surveys') {
      loadSurveys();
    } else if (activeTab === 'activity-logs') {
      loadActivityLogs();
    }
  }, [activeTab, loadDashboard, loadUsers, loadSurveys, loadActivityLogs]);

  // Reload when filters change
  useEffect(() => {
    if (activeTab === 'users') {
      setCurrentPage(0);
      loadUsers();
    }
  }, [search, roleFilter, activeFilter, pageSize]);

  useEffect(() => {
    if (activeTab === 'surveys') {
      setSurveyPage(0);
      loadSurveys();
    }
  }, [surveySearch, surveyStatusFilter, surveyUserIdFilter, surveyCategoryFilter, surveyDateFrom, surveyDateTo, surveyPageSize]);

  useEffect(() => {
    if (activeTab === 'activity-logs') {
      setActivityLogPage(0);
      loadActivityLogs();
    }
  }, [activityLogUserIdFilter, activityLogActionTypeFilter, activityLogDateFrom, activityLogDateTo, activityLogPageSize, loadActivityLogs]);


  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    if (activeTab === 'dashboard') {
      loadDashboard(true);
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'surveys') {
      loadSurveys();
    } else if (activeTab === 'activity-logs') {
      loadActivityLogs();
    }
  };

  // User actions
  const handleViewUserDetail = async (userId) => {
    try {
      const data = await adminService.getUserDetail(userId);
      setSelectedUser(data);
      setShowUserDetailModal(true);
    } catch (err) {
      showNotification('error', 'Không thể tải chi tiết user');
    }
  };

  const handleEditUser = (user) => {
    setEditUserForm({ fullName: user.fullName, role: user.role });
    setSelectedUser(user);
    setShowEditUserModal(true);
  };

  const handleUpdateUser = async () => {
    try {
      await adminService.updateUser(
        selectedUser.userId,
        editUserForm.fullName,
        editUserForm.role
      );
      showNotification('success', 'Cập nhật user thành công');
      setShowEditUserModal(false);
      loadUsers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Không thể cập nhật user');
    }
  };

  const handleToggleUserStatus = (user) => {
    setUserToToggleStatus(user);
    setShowToggleStatusConfirm(true);
  };

  const confirmToggleUserStatus = async () => {
    if (!userToToggleStatus) return;
    
    try {
      const newStatus = !userToToggleStatus.isActive;
      await adminService.updateUserStatus(userToToggleStatus.userId, newStatus);
      showNotification('success', `Đã ${newStatus ? 'kích hoạt' : 'vô hiệu hóa'} user thành công`);
      setShowToggleStatusConfirm(false);
      setUserToToggleStatus(null);
      loadUsers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Không thể cập nhật trạng thái user');
      setShowToggleStatusConfirm(false);
      setUserToToggleStatus(null);
    }
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteUserConfirm(true);
  };

  const confirmDeleteUser = async () => {
    try {
      await adminService.deleteUser(userToDelete.userId);
      showNotification('success', 'Đã xóa user thành công');
      setShowDeleteUserConfirm(false);
      setUserToDelete(null);
      loadUsers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Không thể xóa user');
    }
  };

  const handleCreateUser = async () => {
    try {
      // Validate form
      if (!createUserForm.fullName || !createUserForm.email || !createUserForm.password) {
        showNotification('error', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

      if (createUserForm.password.length < 6) {
        showNotification('error', 'Mật khẩu phải có ít nhất 6 ký tự');
        return;
      }

      // Call API
      await adminService.createUser({
        fullName: createUserForm.fullName.trim(),
        email: createUserForm.email.trim(),
        password: createUserForm.password,
        role: createUserForm.role
      });

      showNotification('success', 'Tạo user mới thành công');
      setShowCreateUserModal(false);
      setCreateUserForm({ fullName: '', email: '', password: '', role: 'creator' });
      loadUsers(); // Reload danh sách users
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Không thể tạo user mới');
    }
  };

  // Survey actions
  const handleViewSurveyDetail = async (surveyId) => {
    try {
      const data = await adminService.getSurveyDetail(surveyId);
      setSelectedSurvey(data);
      setShowSurveyDetailModal(true);
    } catch (err) {
      showNotification('error', 'Không thể tải chi tiết survey');
    }
  };

  const handleSurveyStatusChange = async (surveyId, newStatus) => {
    try {
      await adminService.updateSurveyStatus(surveyId, newStatus);
      showNotification('success', `Đã chuyển khảo sát sang trạng thái ${newStatus === 'published' ? 'đã xuất bản' : 'đã lưu trữ'}`);
      loadSurveys();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Không thể cập nhật trạng thái khảo sát');
    }
  };

  const handleDeleteSurvey = (survey) => {
    setSurveyToDelete(survey);
    setShowDeleteSurveyConfirm(true);
  };

  const confirmDeleteSurvey = async () => {
    try {
      await adminService.deleteSurvey(surveyToDelete.surveyId);
      showNotification('success', 'Đã xóa survey thành công');
      setShowDeleteSurveyConfirm(false);
      setSurveyToDelete(null);
      loadSurveys();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Không thể xóa survey');
    }
  };


  // Chart data preparation
  const roleDistributionData = dashboard ? [
    { name: 'Admin', value: dashboard.totalAdmins || 0 },
    { name: 'Creator', value: dashboard.totalCreators || 0 },
    { name: 'Respondent', value: dashboard.totalRespondents || 0 }
  ].filter(item => item.value > 0) : [];

  const surveyStatusData = dashboard ? [
    { name: 'Draft', value: dashboard.draftSurveys || 0 },
    { name: 'Published', value: dashboard.publishedSurveys || 0 },
    { name: 'Archived', value: dashboard.archivedSurveys || 0 }
  ].filter(item => item.value > 0) : [];

  const COLORS = ['#3b82f6', '#8b5cf6', '#22d3ee', '#f59e0b', '#ef4444'];

  const getRoleLabel = (role) => {
    const map = {
      admin: 'Quản trị viên',
      creator: 'Người tạo',
      respondent: 'Người trả lời'
    };
    return map[role] || role;
  };

  const getStatusLabel = (status) => {
    const map = {
      draft: 'Bản nháp',
      published: 'Đã xuất bản',
      archived: 'Đã lưu trữ'
    };
    return map[status] || status;
  };



  // Calculate 24H activity count (from recent admin activities)
  const activity24HCount = dashboard?.recentAdminActivities 
    ? dashboard.recentAdminActivities.filter(activity => {
        const activityDate = new Date(activity.createdAt);
        const now = new Date();
        const hoursDiff = (now - activityDate) / (1000 * 60 * 60);
        return hoursDiff <= 24;
      }).length 
    : 0;

  // Chart colors
  const CHART_COLORS = {
    admin: '#ef4444',      // Red
    creator: '#3b82f6',    // Blue  
    respondent: '#10b981', // Green
    published: '#10b981',  // Green
    archived: '#6b7280'    // Grey
  };

  return (
    <div className="admin-layout">
      {/* Header Component */}
      <HeaderComponent showUserInfo={true} />

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <nav className="admin-sidebar-nav">
          <button
            className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="admin-nav-icon">
              <i className="fa-solid fa-clock"></i>
            </div>
            <div className="admin-nav-content">
              <div className="admin-nav-title">Dashboard</div>
              <div className="admin-nav-subtitle">Tổng quan hệ thống</div>
            </div>
          </button>
          <button
            className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <div className="admin-nav-icon">
            <i className="fa-solid fa-users"></i>
            </div>
            <div className="admin-nav-content">
              <div className="admin-nav-title">Quản lý Người dùng</div>
              <div className="admin-nav-subtitle">Quản lý users và quyền</div>
            </div>
          </button>
          <button
            className={`admin-nav-item ${activeTab === 'surveys' ? 'active' : ''}`}
            onClick={() => setActiveTab('surveys')}
          >
            <div className="admin-nav-icon">
              <i className="fa-solid fa-table-list"></i>
        </div>
            <div className="admin-nav-content">
              <div className="admin-nav-title">Quản lý Khảo sát</div>
              <div className="admin-nav-subtitle">Quản lý surveys</div>
            </div>
          </button>
          <button
            className={`admin-nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity-logs')}
          >
            <div className="admin-nav-icon">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div className="admin-nav-content">
              <div className="admin-nav-title">Lịch sử Thay đổi</div>
              <div className="admin-nav-subtitle">Audit logs và hoạt động</div>
            </div>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="admin-main-content">
        {/* Notification */}
        {notification && (
          <div className={`admin-notification ${notification.type}`}>
            <i className={`fa-solid ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {notification.message}
          </div>
        )}

        {/* Content Area */}
        <div className="admin-content-wrapper">

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="admin-content">
            {loadingDashboard ? (
              <div className="admin-loading-container">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <p>Đang tải dashboard...</p>
              </div>
            ) : error ? (
              <div className="admin-error-container">
                <i className="fa-solid fa-exclamation-triangle"></i>
                <p>{error}</p>
              </div>
            ) : dashboard ? (
              <>
                {/* Stat Cards - Top Row */}
                <div className="admin-stats-grid">
                  <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                      <i className="fa-solid fa-users"></i>
                    </div>
                    <div className="admin-stat-info">
                      <div className="admin-stat-value">{dashboard.totalUsers || 0}</div>
                      <div className="admin-stat-label">TỔNG SỐ NGƯỜI DÙNG</div>
                      <div className="admin-stat-details">
                        <span className="stat-detail-active">Hoạt động: {dashboard.activeUsers || 0}</span>
                        <span className="stat-detail-inactive">Không hoạt động: {(dashboard.totalUsers || 0) - (dashboard.activeUsers || 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                      <i className="fa-solid fa-table-list"></i>
                    </div>
                    <div className="admin-stat-info">
                      <div className="admin-stat-value">{dashboard.totalSurveys || 0}</div>
                      <div className="admin-stat-label">TỔNG SỐ KHẢO SÁT</div>
                      <div className="admin-stat-details">
                        <span className="stat-detail-published">Xuất bản: {dashboard.publishedSurveys || 0}</span>
                        <span className="stat-detail-draft">Nháp: {dashboard.draftSurveys || 0}</span>
                    </div>
                  </div>
                    </div>
                  <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      <i className="fa-solid fa-list-check"></i>
                      </div>
                    <div className="admin-stat-info">
                      <div className="admin-stat-value">{dashboard.totalResponses || 0}</div>
                      <div className="admin-stat-label">TỔNG SỐ PHẢN HỒI</div>
                      <div className="admin-stat-details">
                        <span>Từ tất cả khảo sát</span>
                    </div>
                  </div>
                    </div>
                  <div className="admin-stat-card">
                    <div className="admin-stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <i className="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div className="admin-stat-info">
                      <div className="admin-stat-value">{activity24HCount}</div>
                      <div className="admin-stat-label">HOẠT ĐỘNG 24H</div>
                      <div className="admin-stat-details">
                        <span>Hoạt động trong ngày</span>
                  </div>
                    </div>
                    </div>
                  </div>

                {/* Charts Section - Donut Charts */}
                <div className="admin-charts-grid">
                  <div className="admin-chart-card">
                    <h3 className="admin-chart-title">
                      Phân bố người dùng theo vai trò
                    </h3>
                    {roleDistributionData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={roleDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {roleDistributionData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={
                                  entry.name === 'Admin' ? CHART_COLORS.admin :
                                  entry.name === 'Creator' ? CHART_COLORS.creator :
                                  CHART_COLORS.respondent
                                } 
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="admin-chart-empty">
                        <i className="fa-solid fa-inbox"></i>
                        <p>Không có dữ liệu</p>
                    </div>
                    )}
                    </div>

                  <div className="admin-chart-card">
                    <h3 className="admin-chart-title">
                      Phân bố khảo sát theo trạng thái
                    </h3>
                    {surveyStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={surveyStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, percent }) => {
                              const labelMap = {
                                'Published': 'Đã xuất bản',
                                'Draft': 'Bản nháp',
                                'Archived': 'Đã lưu trữ'
                              };
                              return `${labelMap[name] || name}: ${(percent * 100).toFixed(0)}%`;
                            }}
                          >
                            {surveyStatusData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={
                                  entry.name === 'Published' ? CHART_COLORS.published :
                                  entry.name === 'Archived' ? CHART_COLORS.archived :
                                  '#f59e0b'
                                } 
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="admin-chart-empty">
                        <i className="fa-solid fa-inbox"></i>
                        <p>Không có dữ liệu</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Activities */}
                  <div className="admin-activities-section">
                  <h2>
                    <i className="fa-solid fa-clock-rotate-left"></i>
                    Hoạt động Admin gần đây
                  </h2>
                  {dashboard.recentAdminActivities && dashboard.recentAdminActivities.length > 0 ? (
                    <div className="admin-activities-list">
                      {dashboard.recentAdminActivities.map((activity) => (
                        <div key={activity.notificationId} className="admin-activity-item">
                          <div className="admin-activity-icon">
                            <i className="fa-solid fa-bell"></i>
                          </div>
                          <div className="admin-activity-content">
                            <div className="admin-activity-title">{activity.title}</div>
                            <div className="admin-activity-message">{activity.message}</div>
                            <div className="admin-activity-meta">
                              <span>User: {activity.userName} ({activity.userEmail})</span>
                              <span>{new Date(activity.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-no-data">
                      <i className="fa-solid fa-inbox"></i>
                      <p>Chưa có hoạt động nào</p>
                  </div>
                )}
                </div>
              </>
            ) : (
              <div className="admin-no-data">
                <i className="fa-solid fa-inbox"></i>
                <p>Không có dữ liệu</p>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="admin-content">
            <div className="admin-users-header">
              <h2>
                <i className="fa-solid fa-users"></i>
                Quản lý Users
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="admin-btn-primary" onClick={() => setShowCreateUserModal(true)}>
                  <i className="fa-solid fa-plus"></i>
                  Tạo User Mới
                </button>
              </div>
            </div>
              
              {/* Filters */}
            <div className="admin-filters-section">
                <input
                  type="text"
                className="admin-search-input"
                  placeholder="Tìm kiếm theo tên hoặc email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="admin-filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                >
                <option value="">Tất cả Roles</option>
                  <option value="admin">Admin</option>
                  <option value="creator">Creator</option>
                  <option value="respondent">Respondent</option>
                </select>
                <select
                className="admin-filter-select"
                  value={activeFilter === null ? '' : activeFilter.toString()}
                onChange={(e) => setActiveFilter(e.target.value === '' ? null : e.target.value === 'true')}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">Hoạt động</option>
                <option value="false">Vô hiệu hóa</option>
              </select>
              <select
                className="admin-filter-select"
                value={pageSize}
                  onChange={(e) => {
                  setPageSize(Number(e.target.value));
                    setCurrentPage(0);
                  }}
              >
                <option value="5">5 / trang</option>
                <option value="10">10 / trang</option>
                <option value="20">20 / trang</option>
                <option value="50">50 / trang</option>
                <option value="100">100 / trang</option>
                </select>
              </div>

              {/* Users Table */}
              {loadingUsers ? (
              <div className="admin-loading-container">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <p>Đang tải danh sách users...</p>
              </div>
              ) : (
                <>
                <div className="admin-user-count-info">
                  <strong>Tổng số users: {totalElements}</strong>
                  </div>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Tên</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Trạng thái</th>
                        <th>Ngày tạo</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length > 0 ? (
                        users.map((user) => (
                          <tr key={user.userId}>
                            <td>{user.userId}</td>
                            <td>{user.fullName}</td>
                            <td>{user.email}</td>
                            <td>
                              <span className={`admin-role-badge ${user.role === 'admin' ? 'admin' : user.role === 'creator' ? 'creator' : 'respondent'}`}>
                                {getRoleLabel(user.role)}
                              </span>
                            </td>
                            <td>
                              <span className={`admin-status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                                <i className={`fa-solid ${user.isActive ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                {user.isActive ? 'Hoạt động' : 'Vô hiệu hóa'}
                              </span>
                            </td>
                            <td>{new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                            <td>
                              <div className="admin-action-buttons">
                                <button
                                  className="admin-btn-view"
                                  onClick={() => handleViewUserDetail(user.userId)}
                                  title="Xem chi tiết"
                                >
                                  <i className="fa-solid fa-eye"></i>
                                </button>
                                  <button
                                  className="admin-btn-edit"
                                  onClick={() => handleEditUser(user)}
                                  title="Chỉnh sửa"
                                >
                                  <i className="fa-solid fa-edit"></i>
                                </button>
                                <button
                                  className={`admin-btn-status ${user.isActive ? 'deactivate' : 'activate'}`}
                                  onClick={() => handleToggleUserStatus(user)}
                                  title={user.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                                >
                                  <i className={`fa-solid ${user.isActive ? 'fa-ban' : 'fa-check'}`}></i>
                                </button>
                                <button
                                    className="admin-btn-delete"
                                  onClick={() => handleDeleteUser(user)}
                                  title="Xóa"
                                  disabled={user.role === 'admin'}
                                  >
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="admin-no-data">
                            <i className="fa-solid fa-inbox"></i>
                            <p>Không có dữ liệu</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                  {/* Pagination */}
                {totalPages > 0 && (
                  <AdminPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalElements={totalElements}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Surveys Tab */}
        {activeTab === 'surveys' && (
          <div className="admin-content">
            <h2>
              <i className="fa-solid fa-table-list"></i>
              Quản lý Surveys
            </h2>

            {/* Filters */}
            <div className="admin-filters-section">
              <input
                type="text"
                className="admin-search-input"
                placeholder="Tìm kiếm theo tiêu đề..."
                value={surveySearch}
                onChange={(e) => setSurveySearch(e.target.value)}
              />
              <select
                className="admin-filter-select"
                value={surveyStatusFilter}
                onChange={(e) => setSurveyStatusFilter(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <input
                type="text"
                className="admin-filter-input"
                placeholder="User ID (tùy chọn)"
                value={surveyUserIdFilter}
                onChange={(e) => setSurveyUserIdFilter(e.target.value)}
              />
              <input
                type="date"
                className="admin-filter-input"
                placeholder="Từ ngày"
                max={getTodayDate()}
                value={surveyDateFrom}
                onChange={(e) => {
                  const newDateFrom = e.target.value;
                  setSurveyDateFrom(newDateFrom);
                  // Nếu dateFrom > dateTo, reset dateTo
                  if (newDateFrom && surveyDateTo && newDateFrom > surveyDateTo) {
                    setSurveyDateTo('');
                  }
                }}
              />
              <input
                type="date"
                className="admin-filter-input"
                placeholder="Đến ngày"
                max={getTodayDate()}
                min={surveyDateFrom || undefined}
                value={surveyDateTo}
                onChange={(e) => {
                  const newDateTo = e.target.value;
                  setSurveyDateTo(newDateTo);
                  // Nếu dateTo < dateFrom, reset dateFrom
                  if (newDateTo && surveyDateFrom && newDateTo < surveyDateFrom) {
                    setSurveyDateFrom('');
                  }
                }}
              />
              <select
                className="admin-filter-select"
                value={surveyPageSize}
                onChange={(e) => {
                  setSurveyPageSize(Number(e.target.value));
                  setSurveyPage(0);
                }}
              >
                <option value="5">5 / trang</option>
                <option value="10">10 / trang</option>
                <option value="20">20 / trang</option>
                <option value="50">50 / trang</option>
                <option value="100">100 / trang</option>
              </select>
            </div>

            {/* Surveys Table */}
            {loadingSurveys ? (
              <div className="admin-loading-container">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <p>Đang tải danh sách surveys...</p>
              </div>
            ) : (
              <>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Tiêu đề</th>
                        <th>Trạng thái</th>
                        <th>Người tạo</th>
                        <th>Category</th>
                        <th>Responses</th>
                        <th>Ngày tạo</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {surveys.length > 0 ? (
                        surveys.map((survey) => (
                          <tr key={survey.surveyId}>
                            <td>{survey.surveyId}</td>
                            <td>{survey.title}</td>
                            <td>
                              <span className={`admin-status-badge ${survey.status === 'published' ? 'published' : survey.status === 'archived' ? 'archived' : 'draft'}`}>
                                {getStatusLabel(survey.status)}
                              </span>
                            </td>
                            <td>{survey.creatorName} ({survey.creatorEmail})</td>
                            <td>{survey.categoryName || 'N/A'}</td>
                            <td>{survey.responseCount || 0}</td>
                            <td>{new Date(survey.createdAt).toLocaleDateString('vi-VN')}</td>
                            <td>
                              <div className="admin-action-buttons">
                      <button
                                  className="admin-btn-view"
                                  onClick={() => handleViewSurveyDetail(survey.surveyId)}
                                  title="Xem chi tiết"
                                >
                                  <i className="fa-solid fa-eye"></i>
                      </button>
                                {editingStatusSurveyId === survey.surveyId ? (
                                  <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                    <select
                                      className="admin-status-select"
                                      style={{ fontSize: '12px', padding: '4px 8px', minWidth: '120px' }}
                                      defaultValue={survey.status}
                                      onChange={(e) => {
                                        const newStatus = e.target.value;
                                        if (newStatus === 'published' || newStatus === 'archived') {
                                          handleSurveyStatusChange(survey.surveyId, newStatus);
                                          setEditingStatusSurveyId(null);
                                        }
                                      }}
                                      autoFocus
                                      onBlur={() => setEditingStatusSurveyId(null)}
                                    >
                                      <option value="published">Đã xuất bản</option>
                                      <option value="archived">Đã lưu trữ</option>
                                    </select>
                      <button
                                      className="admin-btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '12px' }}
                                      onClick={() => setEditingStatusSurveyId(null)}
                                      title="Hủy"
                                    >
                                      <i className="fa-solid fa-times"></i>
                      </button>
                    </div>
                                ) : (
                                  <button
                                    className="admin-btn-edit"
                                    onClick={() => setEditingStatusSurveyId(survey.surveyId)}
                                    title="Chỉnh sửa trạng thái"
                                  >
                                    <i className="fa-solid fa-edit"></i>
                                  </button>
                                )}
                                <button
                                  className="admin-btn-delete"
                                  onClick={() => handleDeleteSurvey(survey)}
                                  title="Xóa"
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="admin-no-data">
                            <i className="fa-solid fa-inbox"></i>
                            <p>Không có dữ liệu</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {surveyTotalPages > 0 && (
                  <AdminPagination
                    currentPage={surveyPage}
                    totalPages={surveyTotalPages}
                    totalElements={surveyTotalElements}
                    pageSize={surveyPageSize}
                    onPageChange={setSurveyPage}
                  />
                  )}
                </>
              )}
            </div>
        )}

        {/* Activity Logs Tab (Survey History) */}
        {activeTab === 'activity-logs' && (
          <div className="admin-content">
            <h2>
              <i className="fa-solid fa-clock-rotate-left"></i>
              Survey History (Activity Logs)
            </h2>

            {/* Filters */}
            <div className="admin-filters-section">
              <input
                type="text"
                className="admin-filter-input"
                placeholder="User ID (tùy chọn)"
                value={activityLogUserIdFilter}
                onChange={(e) => setActivityLogUserIdFilter(e.target.value)}
              />
              <select
                className="admin-filter-select"
                value={activityLogActionTypeFilter}
                onChange={(e) => setActivityLogActionTypeFilter(e.target.value)}
              >
                <option value="">Tất cả loại</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="create_survey">Tạo Survey</option>
                <option value="edit_survey">Chỉnh sửa Survey</option>
                <option value="delete_survey">Xóa Survey</option>
                <option value="add_question">Thêm Câu hỏi</option>
                <option value="edit_question">Chỉnh sửa Câu hỏi</option>
                <option value="delete_question">Xóa Câu hỏi</option>
                <option value="add_option">Thêm Option</option>
                <option value="edit_option">Chỉnh sửa Option</option>
                <option value="delete_option">Xóa Option</option>
                <option value="submit_response">Gửi Response</option>
                <option value="ai_generate">AI Generate</option>
                <option value="ai_refresh_one">AI Refresh One</option>
                <option value="ai_refresh_all">AI Refresh All</option>
                <option value="chat_ai">Chat AI</option>
                <option value="ai_query">AI Query</option>
                <option value="ai_query_error">AI Query Error</option>
                <option value="ai_eval">AI Eval</option>
                <option value="admin_update_user_role">Admin Update User Role</option>
                <option value="admin_delete_user">Admin Delete User</option>
                <option value="admin_create_user">Admin Create User</option>
                <option value="admin_deactivate_user">Admin Deactivate User</option>
                <option value="admin_activate_user">Admin Activate User</option>
              </select>
              <input
                type="date"
                className="admin-filter-input"
                placeholder="Từ ngày"
                max={getTodayDate()}
                value={activityLogDateFrom}
                onChange={(e) => {
                  const newDateFrom = e.target.value;
                  setActivityLogDateFrom(newDateFrom);
                  // Nếu dateFrom > dateTo, reset dateTo
                  if (newDateFrom && activityLogDateTo && newDateFrom > activityLogDateTo) {
                    setActivityLogDateTo('');
                  }
                }}
              />
              <input
                type="date"
                className="admin-filter-input"
                placeholder="Đến ngày"
                max={getTodayDate()}
                min={activityLogDateFrom || undefined}
                value={activityLogDateTo}
                onChange={(e) => {
                  const newDateTo = e.target.value;
                  setActivityLogDateTo(newDateTo);
                  // Nếu dateTo < dateFrom, reset dateFrom
                  if (newDateTo && activityLogDateFrom && newDateTo < activityLogDateFrom) {
                    setActivityLogDateFrom('');
                  }
                }}
              />
              <select
                className="admin-filter-select"
                value={activityLogPageSize}
                onChange={(e) => {
                  setActivityLogPageSize(Number(e.target.value));
                  setActivityLogPage(0);
                }}
              >
                <option value="5">5 / trang</option>
                <option value="10">10 / trang</option>
                <option value="20">20 / trang</option>
                <option value="50">50 / trang</option>
                <option value="100">100 / trang</option>
              </select>
          </div>

            {/* Activity Logs Table */}
            {loadingActivityLogs ? (
              <div className="admin-loading-container">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <p>Đang tải danh sách activity logs...</p>
              </div>
            ) : (
              <>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Loại Action</th>
                        <th>Mô tả</th>
                        <th>Target ID</th>
                        <th>Target Table</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.length > 0 ? (
                        activityLogs.map((log) => (
                          <tr key={log.logId}>
                            <td>{log.logId}</td>
                            <td>
                              {log.userName || 'System'}
                              {log.userEmail && ` (${log.userEmail})`}
                            </td>
                            <td>
                              <span className="admin-action-type-badge">
                                {log.actionType}
                              </span>
                            </td>
                            <td>{log.description || 'N/A'}</td>
                            <td>{log.targetId || 'N/A'}</td>
                            <td>{log.targetTable || 'N/A'}</td>
                            <td>{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="admin-no-data">
                            <i className="fa-solid fa-inbox"></i>
                            <p>Không có dữ liệu</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
      </div>

                {/* Pagination */}
                {activityLogTotalPages > 0 && (
                  <AdminPagination
                    currentPage={activityLogPage}
                    totalPages={activityLogTotalPages}
                    totalElements={activityLogTotalElements}
                    pageSize={activityLogPageSize}
                    onPageChange={setActivityLogPage}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* User Detail Modal */}
        {showUserDetailModal && selectedUser && (
          <div className="admin-modal-overlay" onClick={() => setShowUserDetailModal(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2>Chi tiết User</h2>
                <button className="admin-modal-close" onClick={() => setShowUserDetailModal(false)}>
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-detail-section">
                  <h3>Thông tin cơ bản</h3>
                  <div className="admin-detail-grid">
                    <div className="admin-detail-item">
                      <label>ID:</label>
                      <span>{selectedUser.userId}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Tên:</label>
                      <span>{selectedUser.fullName}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Email:</label>
                      <span>{selectedUser.email}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Role:</label>
                      <span>{getRoleLabel(selectedUser.role)}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Trạng thái:</label>
                      <span className={selectedUser.isActive ? 'active' : 'inactive'}>
                        {selectedUser.isActive ? 'Hoạt động' : 'Vô hiệu hóa'}
                      </span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Ngày tạo:</label>
                      <span>{new Date(selectedUser.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                </div>

                {selectedUser.profile && (
                  <div className="admin-detail-section">
                    <h3>Profile</h3>
                    <div className="admin-detail-grid">
                      <div className="admin-detail-item">
                        <label>Giới tính:</label>
                        <span>{selectedUser.profile.gender || 'N/A'}</span>
                      </div>
                      <div className="admin-detail-item">
                        <label>Độ tuổi:</label>
                        <span>{selectedUser.profile.ageBand || 'N/A'}</span>
                      </div>
                      <div className="admin-detail-item">
                        <label>Khu vực:</label>
                        <span>{selectedUser.profile.region || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="admin-detail-section">
                  <h3>Thống kê</h3>
                  <div className="admin-detail-grid">
                    <div className="admin-detail-item">
                      <label>Số surveys đã tạo:</label>
                      <span>{selectedUser.surveysCount || 0}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Số responses đã tham gia:</label>
                      <span>{selectedUser.responsesCount || 0}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Lần đăng nhập cuối:</label>
                      <span>{selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString('vi-VN') : 'Chưa có'}</span>
                    </div>
                  </div>
                </div>

                {selectedUser.recentAdminActivities && selectedUser.recentAdminActivities.length > 0 && (
                  <div className="admin-detail-section">
                    <h3>Lịch sử thay đổi bởi Admin</h3>
                    <div className="admin-activities-list">
                      {selectedUser.recentAdminActivities.map((activity) => (
                        <div key={activity.notificationId} className="admin-activity-item">
                          <div className="admin-activity-content">
                            <div className="admin-activity-title">{activity.title}</div>
                            <div className="admin-activity-message">{activity.message}</div>
                            <div className="admin-activity-meta">
                              {new Date(activity.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedUser.recentUserActivities && selectedUser.recentUserActivities.length > 0 && (
                  <div className="admin-detail-section">
                    <h3>Hoạt động gần đây</h3>
                    <div className="admin-activities-list">
                      {selectedUser.recentUserActivities.map((activity) => (
                        <div key={activity.logId} className="admin-activity-item">
                          <div className="admin-activity-content">
                            <div className="admin-activity-title">{activity.actionType}</div>
                            <div className="admin-activity-message">{activity.description}</div>
                            <div className="admin-activity-meta">
                              {new Date(activity.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn-secondary" onClick={() => setShowUserDetailModal(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditUserModal && selectedUser && (
          <div className="admin-modal-overlay" onClick={() => setShowEditUserModal(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2>Chỉnh sửa User</h2>
                <button className="admin-modal-close" onClick={() => setShowEditUserModal(false)}>
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Tên:</label>
                  <input
                    type="text"
                    value={editUserForm.fullName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Role:</label>
                  {selectedUser && selectedUser.role === 'admin' ? (
                    <input
                      type="text"
                      value="Admin (không thể thay đổi)"
                      disabled
                      style={{ cursor: 'not-allowed', opacity: 0.6 }}
                    />
                  ) : (
                    <select
                      value={editUserForm.role}
                      onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                    >
                      <option value="creator">Creator</option>
                      <option value="respondent">Respondent</option>
                    </select>
                  )}
                </div>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn-secondary" onClick={() => setShowEditUserModal(false)}>
                  Hủy
                </button>
                <button className="admin-btn-primary" onClick={handleUpdateUser}>
                  Lưu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateUserModal && (
          <div className="admin-modal-overlay" onClick={() => setShowCreateUserModal(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2>Tạo User Mới</h2>
                <button className="admin-modal-close" onClick={() => setShowCreateUserModal(false)}>
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Họ tên: <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    value={createUserForm.fullName}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, fullName: e.target.value })}
                    placeholder="Nhập họ tên"
                  />
                </div>
                <div className="admin-form-group">
                  <label>Email: <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="email"
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                    placeholder="Nhập email"
                  />
                </div>
                <div className="admin-form-group">
                  <label>Mật khẩu: <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="password"
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                    placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  />
                </div>
                <div className="admin-form-group">
                  <label>Role: <span style={{ color: 'red' }}>*</span></label>
                  <select
                    value={createUserForm.role}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value })}
                  >
                    <option value="creator">Creator</option>
                    <option value="respondent">Respondent</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn-secondary" onClick={() => {
                  setShowCreateUserModal(false);
                  setCreateUserForm({ fullName: '', email: '', password: '', role: 'creator' });
                }}>
                  Hủy
                </button>
                <button className="admin-btn-primary" onClick={handleCreateUser}>
                  Tạo User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toggle User Status Confirmation Modal */}
        {showToggleStatusConfirm && userToToggleStatus && (
          <div className="admin-modal-overlay" onClick={() => setShowToggleStatusConfirm(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2>Xác nhận {userToToggleStatus.isActive ? 'vô hiệu hóa' : 'kích hoạt'} tài khoản</h2>
                <button className="admin-modal-close" onClick={() => setShowToggleStatusConfirm(false)}>
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
              <div className="admin-modal-body">
                <p>
                  Bạn có chắc chắn muốn {userToToggleStatus.isActive ? 'vô hiệu hóa' : 'kích hoạt'} tài khoản của user 
                  <strong> {userToToggleStatus.fullName}</strong> ({userToToggleStatus.email})?
                </p>
                {userToToggleStatus.isActive && (
                  <p className="admin-warning-text">
                    Tài khoản này sẽ không thể đăng nhập sau khi bị vô hiệu hóa!
                  </p>
                )}
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn-secondary" onClick={() => {
                  setShowToggleStatusConfirm(false);
                  setUserToToggleStatus(null);
                }}>
                  Hủy
                </button>
                <button 
                  className={userToToggleStatus.isActive ? 'admin-btn-danger' : 'admin-btn-primary'} 
                  onClick={confirmToggleUserStatus}
                >
                  {userToToggleStatus.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Confirmation Modal */}
        {showDeleteUserConfirm && userToDelete && (
          <div className="admin-modal-overlay" onClick={() => setShowDeleteUserConfirm(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2>Xác nhận xóa User</h2>
                <button className="admin-modal-close" onClick={() => setShowDeleteUserConfirm(false)}>
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
              <div className="admin-modal-body">
                <p>Bạn có chắc chắn muốn xóa user <strong>{userToDelete.fullName}</strong> ({userToDelete.email})?</p>
                <p className="admin-warning-text">Hành động này không thể hoàn tác!</p>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn-secondary" onClick={() => setShowDeleteUserConfirm(false)}>
                  Hủy
                </button>
                <button className="admin-btn-danger" onClick={confirmDeleteUser}>
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Survey Detail Modal */}
        {showSurveyDetailModal && selectedSurvey && (
          <div className="admin-modal-overlay" onClick={() => setShowSurveyDetailModal(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2>Chi tiết Survey</h2>
                <button className="admin-modal-close" onClick={() => setShowSurveyDetailModal(false)}>
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-detail-section">
                  <h3>Thông tin cơ bản</h3>
                  <div className="admin-detail-grid">
                    <div className="admin-detail-item">
                      <label>ID:</label>
                      <span>{selectedSurvey.surveyId}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Tiêu đề:</label>
                      <span>{selectedSurvey.title}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Mô tả:</label>
                      <span>{selectedSurvey.description || 'N/A'}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Trạng thái:</label>
                      <span>{getStatusLabel(selectedSurvey.status)}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Category:</label>
                      <span>{selectedSurvey.categoryName || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="admin-detail-section">
                  <h3>Người tạo</h3>
                  <div className="admin-detail-grid">
                    <div className="admin-detail-item">
                      <label>Tên:</label>
                      <span>{selectedSurvey.creatorName}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Email:</label>
                      <span>{selectedSurvey.creatorEmail}</span>
                    </div>
                  </div>
                </div>

                <div className="admin-detail-section">
                  <h3>Thống kê</h3>
                  <div className="admin-detail-grid">
                    <div className="admin-detail-item">
                      <label>Số câu hỏi:</label>
                      <span>{selectedSurvey.questionCount || 0}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Số responses:</label>
                      <span>{selectedSurvey.responseCount || 0}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Số lượt xem:</label>
                      <span>{selectedSurvey.viewCount || 0}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Ngày tạo:</label>
                      <span>{new Date(selectedSurvey.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="admin-detail-item">
                      <label>Ngày cập nhật:</label>
                      <span>{new Date(selectedSurvey.updatedAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn-secondary" onClick={() => setShowSurveyDetailModal(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Survey Confirmation Modal */}
        {showDeleteSurveyConfirm && surveyToDelete && (
          <div className="admin-modal-overlay" onClick={() => setShowDeleteSurveyConfirm(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2>Xác nhận xóa Survey</h2>
                <button className="admin-modal-close" onClick={() => setShowDeleteSurveyConfirm(false)}>
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
              <div className="admin-modal-body">
                <p>Bạn có chắc chắn muốn xóa survey <strong>{surveyToDelete.title}</strong>?</p>
                <p className="admin-warning-text">Hành động này không thể hoàn tác! Tất cả dữ liệu liên quan sẽ bị xóa.</p>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn-secondary" onClick={() => setShowDeleteSurveyConfirm(false)}>
                  Hủy
                </button>
                <button className="admin-btn-danger" onClick={confirmDeleteSurvey}>
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;



