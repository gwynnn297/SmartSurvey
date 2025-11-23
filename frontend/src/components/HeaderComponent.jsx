import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Notification from './Notification';
import './HeaderComponent.css';
import logoSmartSurvey from '../assets/logoSmartSurvey.png';
const HeaderComponent = ({ showUserInfo = false, username, surveyId = null, surveyTitle = null, surveyDescription = null }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showDropdown, setShowDropdown] = useState(false);
    const userInfoRef = useRef(null);

    const handleLogoClick = () => {
        // Kiểm tra xem user đã đăng nhập chưa
        const token = localStorage.getItem('token');
        if (token) {
            // Nếu đã đăng nhập, chuyển về dashboard
            navigate('/dashboard');
        } else {
            // Nếu chưa đăng nhập, chuyển về trang chủ
            navigate('/');
        }
    };

    const handleSurveyClick = () => {
        if (surveyId) {
            navigate('/create-survey', {
                state: {
                    editSurvey: {
                        id: surveyId,
                        title: surveyTitle,
                        description: surveyDescription
                    }
                }
            });
        }
    };

    const handleReportClick = async () => {
        if (surveyId) {
            // Nếu có surveyTitle từ props, sử dụng luôn
            if (surveyTitle) {
                navigate('/report', {
                    state: {
                        surveyId: surveyId,
                        surveyTitle: surveyTitle,
                        surveyDescription: surveyDescription || ''
                    }
                });
            } else {
                // Nếu không có, thử load từ API
                try {
                    const { surveyService } = await import('../services/surveyService');
                    const survey = await surveyService.getSurveyById(surveyId);
                    navigate('/report', {
                        state: {
                            surveyId: surveyId,
                            surveyTitle: survey.title || 'Khảo sát',
                            surveyDescription: survey.description || ''
                        }
                    });
                } catch (error) {
                    console.error('Error loading survey info:', error);
                    // Fallback: chỉ truyền surveyId
                    navigate('/report', {
                        state: {
                            surveyId: surveyId
                        }
                    });
                }
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/home');
    };

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    // Đóng dropdown khi click bên ngoài
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && userInfoRef.current && !userInfoRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    // Lấy username từ localStorage nếu không truyền qua props
    const storedUser = (() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || null;
        } catch (e) {
            return null;
        }
    })();
    const storedName = storedUser?.name || storedUser?.username || storedUser?.email || 'User';
    const displayName = (username && username.trim()) ? username : storedName;
    const avatarInitial = (displayName || 'U').trim().charAt(0).toUpperCase();

    // Kiểm tra xem có đang ở trang CreateSurvey hoặc Report (bao gồm các trang con) và có surveyId không
    const isSurveyPage = surveyId && (
        location.pathname === '/create-survey' ||
        location.pathname === '/report' ||
        location.pathname.startsWith('/report/')
    );

    return (
        <header className="header-component">
            <div className="header-left">
                <div className="logo" onClick={handleLogoClick}>
                    <img className="logo-smart-survey" src={logoSmartSurvey} alt="logoSmartSurvey" />
                </div>
            </div>

            {isSurveyPage && (
                <nav className="header-center">
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            handleSurveyClick();
                        }}
                        className={location.pathname === '/create-survey' ? 'active' : ''}
                    >
                        Khảo sát
                    </a>
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            handleReportClick();
                        }}
                        className={location.pathname === '/report' || location.pathname.startsWith('/report/') ? 'active' : ''}
                    >
                        Báo cáo
                    </a>
                </nav>
            )}

            {showUserInfo && (
                <div className="header-right">
                    <Notification />
                    <div className="user-info" ref={userInfoRef}>
                        <div className="user-avatar" onClick={() => { navigate('/profile'); setShowDropdown(false); }}>
                            <span>{avatarInitial}</span>
                        </div>
                        <span className="username">{displayName}</span>
                        <button
                            className="dropdown-toggle"
                            onClick={toggleDropdown}
                            aria-label="Toggle user menu"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        {showDropdown && (
                            <div className="user-dropdown">
                                <div className="dropdown-item" onClick={() => { navigate('/profile'); setShowDropdown(false); }}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M8 8C10.21 8 12 6.21 12 4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4C4 6.21 5.79 8 8 8ZM8 10C5.33 10 0 11.34 0 14V16H16V14C16 11.34 10.67 10 8 10Z" fill="currentColor" />
                                    </svg>
                                    Hồ sơ
                                </div>
                                {/* <div className="dropdown-item">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM8 14C4.69 14 2 11.31 2 8C2 4.69 4.69 2 8 2C11.31 2 14 4.69 14 8C14 11.31 11.31 14 8 14Z" fill="currentColor" />
                                        <path d="M8 4C6.34 4 5 5.34 5 7C5 8.66 6.34 10 8 10C9.66 10 11 8.66 11 7C11 5.34 9.66 4 8 4Z" fill="currentColor" />
                                    </svg>
                                    Cài đặt
                                </div> */}
                                <div className="dropdown-divider"></div>
                                <div className="dropdown-item" onClick={handleLogout}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6 12H2V2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M10 9L14 5L10 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M14 5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Đăng xuất
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default HeaderComponent;
