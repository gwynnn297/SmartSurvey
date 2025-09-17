import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderComponent from '../../components/HeaderComponent';
import profileService from '../../services/profileService';
import './Profile.css';
import './ProfileForm.css';

// Inline ProfileForm component (moved from components/ProfileForm)
const ProfileForm = ({ profile, onUpdate }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        role: '',
        createdAt: '',
        updatedAt: ''
    });

    const [originalData, setOriginalData] = useState({});
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

    const hasChanges = formData.fullName !== originalData.fullName;
    const isFormValid = formData.fullName.trim() !== '';

    return (
        <div className="profile-form-container">
            <form onSubmit={handleSubmit} className="profile-form">
                {message.text && (
                    <div className={`message ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="fullName" className="form-label">
                        Họ và tên <span className="required">*</span>
                    </label>
                    <input
                        type="text"
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className={`form-input ${errors.fullName ? 'error' : ''}`}
                        placeholder="Nhập họ và tên"
                        disabled={loading}
                    />
                    {errors.fullName && (
                        <span className="error-message">{errors.fullName}</span>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="email" className="form-label">
                        Email
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        className="form-input readonly"
                        disabled
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="role" className="form-label">
                        Vai trò
                    </label>
                    <input
                        type="text"
                        id="role"
                        name="role"
                        value={getRoleDisplayName(formData.role)}
                        className="form-input readonly"
                        disabled
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="createdAt" className="form-label">
                        Ngày tạo tài khoản
                    </label>
                    <input
                        type="text"
                        id="createdAt"
                        name="createdAt"
                        value={formatDate(formData.createdAt)}
                        className="form-input readonly"
                        disabled
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="updatedAt" className="form-label">
                        Cập nhật gần nhất
                    </label>
                    <input
                        type="text"
                        id="updatedAt"
                        name="updatedAt"
                        value={formatDate(formData.updatedAt)}
                        className="form-input readonly"
                        disabled
                    />
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="btn btn-secondary"
                        disabled={loading || !hasChanges}
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || !hasChanges || !isFormValid}
                    >
                        {loading ? (
                            <>
                                <span className="loading-spinner-small"></span>
                                Đang lưu...
                            </>
                        ) : (
                            'Lưu'
                        )}
                    </button>
                </div>
            </form>
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
            console.log('🏠 Profile: Starting to load profile...');

            // Check token before making API call
            const token = localStorage.getItem('token');
            console.log('🔑 Profile: Token check:', token ? 'Found' : 'Not found');

            const profileData = await profileService.getProfile();
            setProfile(profileData);
            console.log('🎉 Profile: Profile loaded successfully');
        } catch (err) {
            console.error('❌ Profile: Error loading profile:', err);
            console.error('❌ Profile: Error details:', err.response?.data);

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
            <div className="profile-container">
                <div className="profile-loading">
                    <div className="loading-spinner"></div>
                    <p>Đang tải thông tin profile...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="profile-container">
                <div className="profile-error">
                    <h2>Lỗi</h2>
                    <p>{error}</p>
                    <button onClick={loadProfile} className="retry-button">
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <HeaderComponent showUserInfo={true} username={profile?.fullName} />

            <div className="profile-container">
                <div className="profile-header">
                    <div className="profile-title">
                        <h1>Thông tin cá nhân</h1>
                        <p>Xem và chỉnh sửa thông tin cá nhân của bạn</p>
                    </div>

                    <div className="profile-actions">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="btn btn-secondary"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 0L0 4L8 8L16 4L8 0Z" fill="currentColor" />
                                <path d="M0 6L8 10L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M0 8L8 12L16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Quay lại trang chủ
                        </button>

                        <button
                            onClick={() => navigate('/change-password')}
                            className="btn btn-primary"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 6V4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M14 6H2C1.45 6 1 6.45 1 7V14C1 14.55 1.45 15 2 15H14C14.55 15 15 14.55 15 14V7C15 6.45 14.55 6 14 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M8 10C8.55 10 9 9.55 9 9C9 8.45 8.55 8 8 8C7.45 8 7 8.45 7 9C7 9.55 7.45 10 8 10Z" fill="currentColor" />
                            </svg>
                            Đổi mật khẩu
                        </button>
                    </div>
                </div>

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
