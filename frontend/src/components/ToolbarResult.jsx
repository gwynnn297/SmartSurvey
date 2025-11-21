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

    const handleGoBack = () => {
        // Quay lại trang create-survey với survey đang xem báo cáo
        if (surveyId) {
            navigate('/create-survey', {
                state: {
                    editSurvey: {
                        id: surveyId,
                        title: surveyTitle || 'Khảo sát',
                        description: surveyDescription || ''
                    }
                }
            });
        } else {
            // Fallback: quay lại trang trước nếu không có surveyId
            navigate(-1);
        }
    };

    return (
        <div className="toolbar-result">
            <div className="toolbar-result-content">
                {/* Nút Quay lại */}
                <button
                    className="toolbar-result-btn toolbar-result-btn-back"
                    onClick={handleGoBack}
                    title="Quay lại trang chỉnh sửa khảo sát"
                >
                    <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
                    <span>Quay lại khảo sát </span>
                </button>

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