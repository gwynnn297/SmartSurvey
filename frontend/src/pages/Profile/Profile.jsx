import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileForm from '../../components/ProfileForm/ProfileForm';
import HeaderComponent from '../../components/HeaderComponent';
import profileService from '../../services/profileService';
import './Profile.css';

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
            const profileData = await profileService.getProfile();
            setProfile(profileData);
        } catch (err) {
            console.error('Error loading profile:', err);
            setError('Không thể tải thông tin profile. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (updatedData) => {
        try {
            setError(null);
            const updatedProfile = await profileService.updateProfile(updatedData);
            setProfile(updatedProfile);
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
            <HeaderComponent showUserInfo={true} />

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
