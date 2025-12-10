import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderComponent from '../../components/HeaderComponent';
import profileService from '../../services/profileService';
import './Profile.css';

// Modern ProfileForm component with improved UI
const ProfileForm = ({ profile, onUpdate }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        role: '',
        createdAt: '',
        updatedAt: ''
    });

    const [originalData, setOriginalData] = useState({
        fullName: '',
        email: '',
        role: '',
        createdAt: '',
        updatedAt: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (profile) {
            const profileData = {
                fullName: profile.fullName || '',
                email: profile.email || '',
                role: profile.role || '',
                createdAt: profile.createdAt || '',
                updatedAt: profile.updatedAt || ''
            };
            setFormData(profileData);
            setOriginalData(profileData);
        }
    }, [profile]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Họ tên không được để trống';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        if (formData.fullName === originalData.fullName) {
            setMessage({ type: 'info', text: 'Không có thay đổi nào để lưu' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const result = await onUpdate({
                fullName: formData.fullName
            });
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setOriginalData(formData);
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Có lỗi xảy ra khi cập nhật profile' });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setFormData(originalData);
        setErrors({});
        setMessage({ type: '', text: '' });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    };

    const getRoleDisplayName = (role) => {
        const roleMap = {
            'admin': 'Quản trị viên',
            'creator': 'Người tạo khảo sát',
            'respondent': 'Người trả lời'
        };
        return roleMap[role] || role;
    };

    // Extract initials from full name for avatar
    const getInitials = (name) => {
        if (!name) return "U";
        return name
            .split(" ")
            .map(word => word.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const hasChanges = formData.fullName !== originalData.fullName;
    const isFormValid = formData.fullName.trim() !== '';

    return (
        <div className="modern-profile-container">
            {/* Profile Card with Avatar Section */}
            <div className="profile-card">
                {/* Avatar Section */}
                <div className="profile-avatar-section">
                    <div className="avatar-container">
                        <div className="avatar-circle">
                            {getInitials(formData.fullName)}
                        </div>
                        <button className="avatar-upload-btn" onClick={() => console.log('Avatar upload')}>
                            <i className="fas fa-camera"></i>
                        </button>
                    </div>
                    <div className="profile-info">
                        <h2 className="profile-name">{formData.fullName || "Tên người dùng"}</h2>
                        <p className="profile-email">{formData.email || "email@example.com"}</p>
                    </div>
                </div>

                {/* Form Section */}
                <div className="profile-form-section">
                    <form onSubmit={handleSubmit} className="modern-profile-form">
                        {message.text && (
                            <div className={`modern-alert ${message.type}`}>
                                <i className={`fas ${message.type === 'success' ? 'fa-check-circle' :
                                    message.type === 'error' ? 'fa-exclamation-circle' :
                                        'fa-info-circle'}`}></i>
                                <span>{message.text}</span>
                            </div>
                        )}

                        <div className="form-grid">
                            {/* Editable field */}
                            <div className="form-field">
                                <label htmlFor="fullName" className="modern-label">
                                    Họ và tên <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="fullName"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    className={`modern-input ${errors.fullName ? 'error' : ''}`}
                                    placeholder="Nhập họ và tên"
                                    disabled={loading}
                                />
                                {errors.fullName && (
                                    <span className="error-text">{errors.fullName}</span>
                                )}
                            </div>

                            {/* Read-only fields */}
                            <div className="form-field">
                                <label htmlFor="email" className="modern-label">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    className="modern-input readonly"
                                    disabled
                                />
                            </div>

                            <div className="form-field">
                                <label htmlFor="role" className="modern-label">Vai trò</label>
                                <input
                                    type="text"
                                    id="role"
                                    name="role"
                                    value={getRoleDisplayName(formData.role)}
                                    className="modern-input readonly"
                                    disabled
                                />
                            </div>

                            <div className="form-field-group">
                                <div className="form-field">
                                    <label htmlFor="createdAt" className="modern-label">
                                        Ngày tạo tài khoản
                                    </label>
                                    <input
                                        type="text"
                                        id="createdAt"
                                        name="createdAt"
                                        value={formatDate(formData.createdAt)}
                                        className="modern-input readonly"
                                        disabled
                                    />
                                </div>

                                <div className="form-field">
                                    <label htmlFor="updatedAt" className="modern-label">
                                        Cập nhật gần nhất
                                    </label>
                                    <input
                                        type="text"
                                        id="updatedAt"
                                        name="updatedAt"
                                        value={formatDate(formData.updatedAt)}
                                        className="modern-input readonly"
                                        disabled
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="modern-form-actions">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="modern-btn secondary"
                                disabled={loading || !hasChanges}
                            >
                                <i className="fas fa-times"></i>
                                <span>Hủy</span>
                            </button>

                            <button
                                type="submit"
                                className="modern-btn primary"
                                disabled={loading || !hasChanges || !isFormValid}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner"></div>
                                        <span>Đang lưu...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save"></i>
                                        <span>Lưu thay đổi</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => window.location.href = '/change-password'}
                                className="modern-btn accent"
                            >
                                <i className="fas fa-lock"></i>
                                <span>Đổi mật khẩu</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const Profile = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setError(null);

            // Check token before making API call
            const token = localStorage.getItem('token');

            const profileData = await profileService.getProfile();
            setProfile(profileData);
        } catch (err) {
            console.error('Profile: Error loading profile:', err);
            console.error('Profile: Error details:', err.response?.data);

            // Không set error nếu là 401 - để interceptor xử lý
            if (err.response?.status !== 401) {
                setError('Không thể tải thông tin profile. Vui lòng thử lại.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (updatedData) => {
        try {
            setError(null);
            const updatedProfile = await profileService.updateProfile(updatedData);
            setProfile(updatedProfile);
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({
                ...stored,
                name: updatedProfile.fullName,
                fullName: updatedProfile.fullName
            }));
            return { success: true, message: 'Cập nhật profile thành công!' };
        } catch (err) {
            console.error('Error updating profile:', err);
            const errorMessage = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật profile';
            return { success: false, message: errorMessage };
        }
    };

    if (loading) {
        return (
            <div className="modern-profile-page">
                <HeaderComponent showUserInfo={true} username={profile?.fullName} />
                <div className="modern-container" style={{ paddingTop: '80px' }}>
                    <div className="loading-container">
                        <div className="loading-spinner-large"></div>
                        <p className="loading-text">Đang tải thông tin profile...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="modern-profile-page">
                <HeaderComponent showUserInfo={true} username={profile?.fullName} />
                <div className="modern-container" style={{ paddingTop: '80px' }}>
                    <div className="error-container">
                        <div className="error-icon">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <h2 className="error-title">Có lỗi xảy ra</h2>
                        <p className="error-message">{error}</p>
                        <button onClick={loadProfile} className="modern-btn primary">
                            <i className="fas fa-redo"></i>
                            <span>Thử lại</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-profile-page">
            <HeaderComponent showUserInfo={true} username={profile?.fullName} />

            <div className="modern-container" style={{ paddingTop: '80px' }}>
                {/* Modern Header with centered title */}
                <div className="modern-header">
                    <div className="header-content">                       
                            <h1 className="page-title">Thông tin cá nhân</h1>
                            <p className="page-description">Xem và chỉnh sửa thông tin cá nhân của bạn</p>                       
                    </div>
                </div>

                {/* Profile Content */}
                <div className="profile-content">
                    <ProfileForm
                        profile={profile}
                        onUpdate={handleUpdateProfile}
                    />
                </div>
            </div>
        </div>
    );
};

export default Profile;