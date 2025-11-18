import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ToolbarResult.css';

const ToolbarResult = ({ surveyId, surveyTitle, surveyDescription }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Xác định trang hiện tại dựa trên pathname
    const currentPath = location.pathname;
    const isDashboard = currentPath === '/report' || currentPath === '/report/';
    const isIndividualResponses = currentPath === '/report/individual-responses';
    const isSentiment = currentPath === '/report/sentiment';

    // Chuẩn bị state để truyền khi navigate
    const getNavigationState = () => {
        return {
            surveyId,
            surveyTitle,
            surveyDescription
        };
    };

    const handleNavigate = (path) => {
        navigate(path, {
            state: getNavigationState()
        });
    };

    return (
        <div className="toolbar-result">
            <div className="toolbar-result-content">
                <button
                    className={`toolbar-result-btn ${isDashboard ? 'active' : ''}`}
                    onClick={() => handleNavigate('/report')}
                    title="Tổng quan khảo sát"
                >
                    <i className="fa-solid fa-chart-line" aria-hidden="true"></i>
                    <span>Tổng quan</span>
                </button>
                <button
                    className={`toolbar-result-btn ${isIndividualResponses ? 'active' : ''}`}
                    onClick={() => handleNavigate('/report/individual-responses')}
                    title="Danh sách phản hồi"
                >
                    <i className="fa-solid fa-list" aria-hidden="true"></i>
                    <span>Danh sách phản hồi</span>
                </button>
                <button
                    className={`toolbar-result-btn ${isSentiment ? 'active' : ''}`}
                    onClick={() => handleNavigate('/report/sentiment')}
                    title="Phân tích cảm xúc"
                >
                    <i className="fa-solid fa-face-smile" aria-hidden="true"></i>
                    <span>Phân tích cảm xúc</span>
                </button>
            </div>
        </div>
    );
};

export default ToolbarResult;

