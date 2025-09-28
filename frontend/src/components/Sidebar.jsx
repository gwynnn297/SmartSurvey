import React, { useState } from 'react';
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
                        className={`nav-link ${isActive('/create-survey') ? 'active' : ''}`}
                        onClick={() => navigate('/create-survey')}
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
                        onClick={() => navigate('/responses')}
                    >
                        <div className="nav-icon">
                            <i className="fa-solid fa-signal" title="Phản hồi/Kết quả"></i>
                        </div>
                        <div className="nav-content">
                            <div className="nav-title">
                                Phản hồi/Kết quả
                            </div>
                        </div>
                    </div>
                </div>

                <div className="nav-item">
                    <div
                        className={`nav-link ${isActive('/ai-analysis') ? 'active' : ''}`}
                        onClick={() => navigate('/ai-analysis')}
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
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
