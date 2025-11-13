import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [expandedSections, setExpandedSections] = useState({});
    const [showCreateModal, setShowCreateModal] = useState(false);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const isActive = (path) => {
        return location.pathname === path;
    };


    return (
        <div className="sidebar">
            <nav className="sidebar-nav">
                <div className="nav-item">
                    <div
                        className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
                        onClick={() => navigate('/dashboard')}
                    >
                        <div className="nav-icon">
                            <i className="fa-solid fa-newspaper" title="Dashboard"></i>
                        </div>
                        <div className="nav-content">
                            <div className="nav-title">
                                Dashboard
                            </div>
                        </div>
                    </div>
                </div>

                <div className="nav-item">
                    <div
                        className={`nav-link ${isActive('/surveys') ? 'active' : ''}`}
                        onClick={() => navigate('/surveys')}
                    >
                        <div className="nav-icon">
                            <i className="fa-solid fa-table" title="Khảo sát"></i>
                        </div>
                        <div className="nav-content">
                            <div className="nav-title">
                                Khảo sát
                            </div>
                        </div>
                    </div>
                </div>

                <div className="nav-item">
                    <div
                        className={`nav-link ${isActive('/create-survey') || isActive('/create-ai') ? 'active' : ''}`}
                        onClick={() => setShowCreateModal(true)}
                    >
                        <div className="nav-icon">
                            <i className="fa-solid fa-star-half-stroke" title="Tạo khảo sát"></i>
                        </div>
                        <div className="nav-content">
                            <div className="nav-title">
                                Tạo khảo sát
                            </div>
                        </div>
                    </div>
                </div>

                <div className="nav-item">
                    <div
                        className={`nav-link ${isActive('/responses') ? 'active' : ''}`}
                        onClick={() => navigate('#')}
                    >
                        <div className="nav-icon">
                            <i className="fa-solid fa-signal" title="Phản hồi/Kết quả"></i>
                        </div>
                        <div className="nav-content">
                            <div className="nav-title">
                                Quản lý Team
                            </div>
                        </div>
                    </div>
                </div>

                {/* <div className="nav-item">
                    <div
                        className={`nav-link ${isActive('/report') ? 'active' : ''}`}
                        onClick={() => navigate('/report')}
                    >
                        <div className="nav-icon">
                            <i className="fa-solid fa-chart-simple" title="Phân tích & Báo cáo"></i>
                        </div>
                        <div className="nav-content">
                            <div className="nav-title">
                                Phân tích & Báo cáo
                            </div>
                        </div>
                    </div>
                </div> */}
            </nav>

            {/* Modal chọn phương thức tạo khảo sát - Render ra ngoài bằng Portal */}
            {showCreateModal && createPortal(
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="modal-close-btn"
                            onClick={() => setShowCreateModal(false)}
                            aria-label="Đóng"
                        >
                            ×
                        </button>
                        <div className="modal-header">
                            <h3>Chọn phương thức tạo khảo sát</h3>
                            <p>Chọn phương thức tạo khảo sát phù hợp với nhu cầu của bạn</p>
                        </div>
                        <div className="modal-body">
                            <div
                                className="create-option"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    navigate('/create-ai');
                                }}
                            >
                                <div className="option-icon ai">
                                    <i className="fa-solid fa-robot" style={{ fontSize: '24px' }}></i>
                                </div>
                                <div className="option-title">Tạo bằng AI</div>
                                <p className="option-desc">
                                    Sử dụng AI để tự động tạo khảo sát từ mô tả của bạn
                                </p>
                                <ul>
                                    <li>Tự động tạo câu hỏi thông minh</li>
                                    <li>Tiết kiệm thời gian</li>
                                    <li>Đề xuất câu hỏi phù hợp</li>
                                </ul>
                                <button className="btn-primary small">
                                    Tạo bằng AI
                                </button>
                            </div>

                            <div
                                className="create-option"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    navigate('/create-survey');
                                }}
                            >
                                <div className="option-icon manual">
                                    <i className="fa-solid fa-pen-to-square" style={{ fontSize: '24px' }}></i>
                                </div>
                                <div className="option-title">Tạo thủ công</div>
                                <p className="option-desc">
                                    Tự thiết kế và chỉnh sửa khảo sát theo ý muốn
                                </p>
                                <ul>
                                    <li>Kiểm soát hoàn toàn</li>
                                    <li>Tùy chỉnh chi tiết</li>
                                    <li>Nhiều loại câu hỏi</li>
                                </ul>
                                <button className="btn-primary small">
                                    Tạo thủ công
                                </button>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <p className="note">Bạn có thể chuyển đổi giữa hai phương thức bất cứ lúc nào</p>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Sidebar;
