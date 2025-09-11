import React, { useState, useEffect } from 'react';
import './ProfileForm.css';

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

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Họ tên không được để trống';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        // Check if data has changed
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
                {/* Message Display */}
                {message.text && (
                    <div className={`message ${message.type}`}>
                        {message.text}
                    </div>
                )}

                {/* Full Name Field */}
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

                {/* Email Field (Readonly) */}
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

                {/* Role Field (Readonly) */}
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

                {/* Created At Field (Readonly) */}
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

                {/* Updated At Field (Readonly) */}
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

                {/* Action Buttons */}
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

export default ProfileForm;
