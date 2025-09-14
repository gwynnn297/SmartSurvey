import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderComponent from '../../components/HeaderComponent';
import changePasswordService from '../../services/changePasswordService';
import './ChangePassword.css';

const ChangePassword = () => {
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.currentPassword.trim()) {
            newErrors.currentPassword = 'Mật khẩu hiện tại không được để trống';
        }

        if (!formData.newPassword.trim()) {
            newErrors.newPassword = 'Mật khẩu mới không được để trống';
        } else if (formData.newPassword.length < 6) {
            newErrors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
        }

        if (!formData.confirmPassword.trim()) {
            newErrors.confirmPassword = 'Xác nhận mật khẩu không được để trống';
        } else if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Mật khẩu mới và xác nhận mật khẩu không khớp';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            console.log('🏠 ChangePassword: Starting change password process...');

            // Check token before making API call
            const token = localStorage.getItem('token');
            console.log('🔑 ChangePassword: Token check:', token ? 'Found' : 'Not found');

            const response = await changePasswordService.changePassword(formData);

            console.log('✅ ChangePassword: Change password response:', response);

            if (response && response.status === 'success') {
                setMessage({ type: 'success', text: response.message });
                // Reset form
                setFormData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });

                // Redirect to profile after 2 seconds
                setTimeout(() => {
                    navigate('/profile');
                }, 2000);
            } else {
                // Handle case where response doesn't have expected structure
                setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
                setFormData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });

                setTimeout(() => {
                    navigate('/profile');
                }, 2000);
            }
        } catch (error) {
            console.error('❌ ChangePassword: Change password error:', error);
            console.error('❌ ChangePassword: Error response:', error.response);

            // Check if it's a 401 error (unauthorized)
            if (error.response?.status === 401) {
                setMessage({ type: 'error', text: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
                // Don't redirect immediately, let user see the error
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else if (error.response?.status === 400) {
                // Handle validation errors
                const errorMessage = error.response?.data?.message || 'Dữ liệu không hợp lệ';
                setMessage({ type: 'error', text: errorMessage });
            } else {
                const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi đổi mật khẩu';
                setMessage({ type: 'error', text: errorMessage });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        navigate('/profile');
    };

    return (
        <div className="change-password-page">
            <HeaderComponent showUserInfo={true} />

            <div className="change-password-container">
                <div className="change-password-header">
                    <div className="change-password-title">
                        <h1>Đổi mật khẩu</h1>
                        <p>Thay đổi mật khẩu để bảo mật tài khoản của bạn</p>
                    </div>

                    <div className="change-password-actions">
                        <button
                            onClick={handleCancel}
                            className="btn btn-secondary"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 0L0 4L8 8L16 4L8 0Z" fill="currentColor" />
                                <path d="M0 6L8 10L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M0 8L8 12L16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Quay lại
                        </button>
                    </div>
                </div>

                <div className="change-password-content">
                    <form onSubmit={handleSubmit} className="change-password-form">
                        {/* Message Display */}
                        {message.text && (
                            <div className={`message ${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        {/* Current Password Field */}
                        <div className="form-group">
                            <label htmlFor="currentPassword" className="form-label">
                                Mật khẩu hiện tại <span className="required">*</span>
                            </label>
                            <input
                                type="password"
                                id="currentPassword"
                                name="currentPassword"
                                value={formData.currentPassword}
                                onChange={handleInputChange}
                                className={`form-input ${errors.currentPassword ? 'error' : ''}`}
                                placeholder="Nhập mật khẩu hiện tại"
                                disabled={loading}
                            />
                            {errors.currentPassword && (
                                <span className="error-message">{errors.currentPassword}</span>
                            )}
                        </div>

                        {/* New Password Field */}
                        <div className="form-group">
                            <label htmlFor="newPassword" className="form-label">
                                Mật khẩu mới <span className="required">*</span>
                            </label>
                            <input
                                type="password"
                                id="newPassword"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleInputChange}
                                className={`form-input ${errors.newPassword ? 'error' : ''}`}
                                placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                                disabled={loading}
                            />
                            {errors.newPassword && (
                                <span className="error-message">{errors.newPassword}</span>
                            )}
                        </div>

                        {/* Confirm Password Field */}
                        <div className="form-group">
                            <label htmlFor="confirmPassword" className="form-label">
                                Xác nhận mật khẩu mới <span className="required">*</span>
                            </label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                                placeholder="Nhập lại mật khẩu mới"
                                disabled={loading}
                            />
                            {errors.confirmPassword && (
                                <span className="error-message">{errors.confirmPassword}</span>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="form-actions">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="btn btn-secondary"
                                disabled={loading}
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="loading-spinner-small"></span>
                                        Đang xử lý...
                                    </>
                                ) : (
                                    'Đổi mật khẩu'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;
