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
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });
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

        // Clear message when user starts typing
        if (message.text) {
            setMessage({ type: '', text: '' });
        }
    };

    const togglePasswordVisibility = (field) => {
        setShowPasswords(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
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
        } else if (formData.newPassword === formData.currentPassword) {
            newErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại';
        }

        if (!formData.confirmPassword.trim()) {
            newErrors.confirmPassword = 'Xác nhận mật khẩu không được để trống';
        } else if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Mật khẩu mới và xác nhận mật khẩu không khớp';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const getPasswordStrength = (password) => {
        if (!password) return { strength: 0, label: '', color: '' };

        let strength = 0;
        if (password.length >= 6) strength += 1;
        if (password.length >= 8) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;

        const levels = [
            { strength: 0, label: '', color: '' },
            { strength: 1, label: 'Rất yếu', color: '#dc2626' },
            { strength: 2, label: 'Yếu', color: '#ea580c' },
            { strength: 3, label: 'Trung bình', color: '#ca8a04' },
            { strength: 4, label: 'Mạnh', color: '#16a34a' },
            { strength: 5, label: 'Rất mạnh', color: '#059669' }
        ];

        return levels[strength] || levels[0];
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // Check token before making API call
            const token = localStorage.getItem('token');
            const response = await changePasswordService.changePassword(formData);
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
            console.error('ChangePassword: Change password error:', error);
            console.error('ChangePassword: Error response:', error.response);

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

    const passwordStrength = getPasswordStrength(formData.newPassword);
    const isFormValid = formData.currentPassword && formData.newPassword && formData.confirmPassword &&
        formData.newPassword === formData.confirmPassword && formData.newPassword.length >= 6;

    return (
        <div className="change-password-page">
            <HeaderComponent showUserInfo={true} />

            <div className="change-password-container" style={{ paddingTop: '80px' }}>
                {/* Modern Header with centered title */}
                <div className="change-password-header">
                    <div className="header-content">  
                            <h1 className="page-title">Đổi mật khẩu</h1>
                            <p className="page-description">Thay đổi mật khẩu để bảo mật tài khoản của bạn</p>                        
                    </div>
                </div>

                {/* Content Grid */}
                <div className="content-grid">
                    {/* Security Tips Sidebar */}
                    <div className="security-tips">
                        <div className="tips-header">
                            <i className="fas fa-lightbulb"></i>
                            <h3>Mẹo bảo mật</h3>
                        </div>
                        <ul className="tips-list">
                            <li>
                                <i className="fas fa-check-circle"></i>
                                <span>Sử dụng ít nhất 8 ký tự</span>
                            </li>
                            <li>
                                <i className="fas fa-check-circle"></i>
                                <span>Kết hợp chữ hoa, chữ thường và số</span>
                            </li>
                            <li>
                                <i className="fas fa-check-circle"></i>
                                <span>Bao gồm ký tự đặc biệt (!@#$%^&*)</span>
                            </li>
                            <li>
                                <i className="fas fa-check-circle"></i>
                                <span>Không sử dụng thông tin cá nhân</span>
                            </li>
                        </ul>
                    </div>

                    {/* Form Content */}
                    <div className="change-password-content">
                        <form onSubmit={handleSubmit} className="change-password-form">
                            {/* Message Display */}
                            {message.text && (
                                <div className={`message modern-alert ${message.type}`}>
                                    <i className={`fas ${message.type === 'success' ? 'fa-check-circle' :
                                        message.type === 'error' ? 'fa-exclamation-circle' :
                                            'fa-info-circle'}`}></i>
                                    <span>{message.text}</span>
                                </div>
                            )}

                            {/* Current Password Field */}
                            <div className="form-group">
                                <label htmlFor="currentPassword" className="form-label modern-label">
                                    <i className="fas fa-key field-icon"></i>
                                    Mật khẩu hiện tại <span className="required">*</span>
                                </label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showPasswords.current ? "text" : "password"}
                                        id="currentPassword"
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={handleInputChange}
                                        className={`form-input modern-input ${errors.currentPassword ? 'error' : ''}`}
                                        placeholder="Nhập mật khẩu hiện tại"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => togglePasswordVisibility('current')}
                                        disabled={loading}
                                    >
                                        <i className={`fas ${showPasswords.current ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                                {errors.currentPassword && (
                                    <span className="error-message">{errors.currentPassword}</span>
                                )}
                            </div>

                            {/* New Password Field */}
                            <div className="form-group">
                                <label htmlFor="newPassword" className="form-label modern-label">
                                    <i className="fas fa-lock field-icon"></i>
                                    Mật khẩu mới <span className="required">*</span>
                                </label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showPasswords.new ? "text" : "password"}
                                        id="newPassword"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                        className={`form-input modern-input ${errors.newPassword ? 'error' : ''}`}
                                        placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => togglePasswordVisibility('new')}
                                        disabled={loading}
                                    >
                                        <i className={`fas ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>

                                {/* Password Strength Indicator */}
                                {formData.newPassword && (
                                    <div className="password-strength">
                                        <div className="strength-meter">
                                            <div
                                                className="strength-fill"
                                                style={{
                                                    width: `${(passwordStrength.strength / 5) * 100}%`,
                                                    backgroundColor: passwordStrength.color
                                                }}
                                            ></div>
                                        </div>
                                        <span
                                            className="strength-label"
                                            style={{ color: passwordStrength.color }}
                                        >
                                            {passwordStrength.label}
                                        </span>
                                    </div>
                                )}

                                {errors.newPassword && (
                                    <span className="error-message">{errors.newPassword}</span>
                                )}
                            </div>

                            {/* Confirm Password Field */}
                            <div className="form-group">
                                <label htmlFor="confirmPassword" className="form-label modern-label">
                                    <i className="fas fa-check-circle field-icon"></i>
                                    Xác nhận mật khẩu mới <span className="required">*</span>
                                </label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showPasswords.confirm ? "text" : "password"}
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        className={`form-input modern-input ${errors.confirmPassword ? 'error' :
                                            formData.confirmPassword && formData.newPassword === formData.confirmPassword ? 'success' : ''}`}
                                        placeholder="Nhập lại mật khẩu mới"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => togglePasswordVisibility('confirm')}
                                        disabled={loading}
                                    >
                                        <i className={`fas ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                    {formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                                        <div className="password-match-indicator">
                                            <i className="fas fa-check"></i>
                                        </div>
                                    )}
                                </div>
                                {errors.confirmPassword && (
                                    <span className="error-message">{errors.confirmPassword}</span>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="form-actions">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="btn btn-secondary modern-btn"
                                    disabled={loading}
                                >
                                    <i className="fas fa-times"></i>
                                    <span>Hủy</span>
                                </button>

                                <button
                                    type="submit"
                                    className="btn btn-primary modern-btn"
                                    disabled={loading || !isFormValid}
                                >
                                    {loading ? (
                                        <>
                                            <span className="loading-spinner-small"></span>
                                            <span>Đang xử lý...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-shield-alt"></i>
                                            <span>Đổi mật khẩu</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;