import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { surveyService } from '../services/surveyService';
import { responseService } from '../services/responseService';
import { questionService } from '../services/questionSurvey';
import ShareSurveyPage from "../pages/Survey/ShareSurveyPage";
import NotificationModal from './NotificationModal';
import CloseSurvey from './CloseSurvey';
import './ListSurvey.css';

const ListSurvey = () => {
    const navigate = useNavigate();
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [confirmShareModalOpen, setConfirmShareModalOpen] = useState(false);
    const [surveyToShare, setSurveyToShare] = useState(null);
    const [responseCounts, setResponseCounts] = useState({});
    const [loadingResponseCounts, setLoadingResponseCounts] = useState(false);
    const [notification, setNotification] = useState(null);
    const [isCloseSurveyModalOpen, setIsCloseSurveyModalOpen] = useState(false);
    const [surveyToClose, setSurveyToClose] = useState(null);
    const [isClosingSurvey, setIsClosingSurvey] = useState(false);

    // Hàm helper để hiển thị notification
    const showNotification = (type, message) => {
        setNotification({ type, message });
    };

    // Hàm helper để lấy statusMeta
    const getStatusMeta = (status) => {
        const map = {
            published: {
                label: "Đang mở",
                className: "status-active",
                dotColor: "#22c55e"
            },
            draft: {
                label: "Bản nháp",
                className: "status-draft",
                dotColor: "#d97706"
            },
            archived: {
                label: "Đã đóng",
                className: "status-archived",
                dotColor: "#6b7280"
            }
        };
        return map[status] || {
            label: status || "Không xác định",
            className: "status-unknown",
            dotColor: "#6b7280"
        };
    };

    // Hàm xử lý đóng khảo sát
    const handleCloseSurvey = async () => {
        if (!surveyToClose?.id) return;
        try {
            setIsClosingSurvey(true);
            const surveyId = surveyToClose.id;
            const updated = await surveyService.updateSurvey(surveyId, { status: "archived" });

            // Cập nhật trạng thái trong danh sách hiện tại
            const updatedSurveys = surveys.map((item) =>
                (item.id === surveyId ? { ...item, status: "archived" } : item)
            );
            setSurveys(updatedSurveys);

            // Cập nhật localStorage nếu có
            const localSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
            if (Array.isArray(localSurveys) && localSurveys.length > 0) {
                const updatedLocal = localSurveys.map((item) =>
                    (item.id === surveyId ? { ...item, status: "archived" } : item)
                );
                localStorage.setItem('userSurveys', JSON.stringify(updatedLocal));
            }

            showNotification('success', "Khảo sát đã được đóng. Người tham gia sẽ không thể gửi phản hồi mới.");
            setIsCloseSurveyModalOpen(false);
            setSurveyToClose(null);
        } catch (error) {
            console.error("Error closing survey:", error);
            showNotification('error', "Không thể đóng khảo sát. Vui lòng thử lại sau.");
        } finally {
            setIsClosingSurvey(false);
        }
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [pageSize] = useState(12);

    // Function to fetch response counts for surveys
    const fetchResponseCounts = async (surveyList) => {
        if (!surveyList || surveyList.length === 0) return;

        setLoadingResponseCounts(true);
        try {
            const surveyIds = surveyList
                .filter(s => s.id || s._id)
                .map(s => s.id || s._id);

            if (surveyIds.length === 0) {
                setLoadingResponseCounts(false);
                return;
            }

            console.log('ListSurvey: Fetching response counts for surveys:', surveyIds);
            const counts = await responseService.getMultipleResponseCounts(surveyIds);
            console.log('ListSurvey: Received response counts:', counts);
            setResponseCounts(counts);
        } catch (error) {
            console.error('ListSurvey: Error fetching response counts:', error);
            // Set fallback counts to 0 (normalize ID to string for consistency)
            const fallbackCounts = {};
            surveyList.forEach(survey => {
                const id = survey.id || survey._id;
                fallbackCounts[String(id)] = 0;
            });
            setResponseCounts(fallbackCounts);
        } finally {
            setLoadingResponseCounts(false);
        }
    };

    // Function to load surveys data - extracted to be reusable
    const loadSurveysData = React.useCallback(async (forceRefresh = false) => {
        try {
            setLoading(true);

            // Always try to get data from API first (to get latest updates)
            let apiSurveys = null;
            try {
                apiSurveys = await surveyService.getSurveys(currentPage, pageSize);
            } catch (error) {
                console.log('ListSurvey: API surveys failed, using local data');
            }

            // Set surveys data (prefer API, fallback to local)
            let surveysList = [];
            if (apiSurveys) {
                // Backend trả về { meta: {...}, result: [...] }
                if (apiSurveys.meta) {
                    // Có thông tin phân trang từ API
                    surveysList = Array.isArray(apiSurveys.result) ? apiSurveys.result : [];
                    setTotalPages(apiSurveys.meta.pages || 0);
                    setTotalElements(apiSurveys.meta.total || 0);
                } else {
                    // Không có thông tin phân trang, xử lý như cũ
                    surveysList = Array.isArray(apiSurveys?.result) ? apiSurveys.result :
                        Array.isArray(apiSurveys) ? apiSurveys : [];
                    setTotalPages(1);
                    setTotalElements(surveysList.length);
                }

                // Update localStorage with latest API data if we got data from API
                if (forceRefresh && surveysList.length > 0) {
                    try {
                        // Update localStorage with latest survey info
                        const localSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
                        const updatedSurveys = localSurveys.map(localSurvey => {
                            const apiSurvey = surveysList.find(s => (s.id || s._id) === (localSurvey.id || localSurvey._id));
                            if (apiSurvey) {
                                // Update with latest data from API
                                return {
                                    ...localSurvey,
                                    title: apiSurvey.title || localSurvey.title,
                                    description: apiSurvey.description || localSurvey.description,
                                    status: apiSurvey.status || localSurvey.status,
                                    categoryId: apiSurvey.categoryId || apiSurvey.category?.id || localSurvey.categoryId,
                                    categoryName: apiSurvey.categoryName || apiSurvey.category?.categoryName || localSurvey.categoryName,
                                    updatedAt: apiSurvey.updatedAt || apiSurvey.updated_at || localSurvey.updatedAt
                                };
                            }
                            return localSurvey;
                        });

                        // Add new surveys from API that don't exist in localStorage
                        surveysList.forEach(apiSurvey => {
                            const exists = updatedSurveys.some(s => (s.id || s._id) === (apiSurvey.id || apiSurvey._id));
                            if (!exists) {
                                updatedSurveys.push({
                                    id: apiSurvey.id || apiSurvey._id,
                                    title: apiSurvey.title,
                                    description: apiSurvey.description,
                                    status: apiSurvey.status,
                                    categoryId: apiSurvey.categoryId || apiSurvey.category?.id,
                                    categoryName: apiSurvey.categoryName || apiSurvey.category?.categoryName,
                                    createdAt: apiSurvey.createdAt || apiSurvey.created_at,
                                    updatedAt: apiSurvey.updatedAt || apiSurvey.updated_at
                                });
                            }
                        });

                        localStorage.setItem('userSurveys', JSON.stringify(updatedSurveys));
                    } catch (updateError) {
                        console.error('Error updating localStorage:', updateError);
                    }
                }
            } else {
                // Fallback to local data with pagination (only if API fails)
                const localSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
                const startIndex = currentPage * pageSize;
                const endIndex = startIndex + pageSize;
                surveysList = localSurveys.slice(startIndex, endIndex);
                setTotalPages(Math.ceil(localSurveys.length / pageSize));
                setTotalElements(localSurveys.length);
            }

            setSurveys(surveysList);

            // Fetch response counts for the surveys
            fetchResponseCounts(surveysList);
        } catch (error) {
            console.error('ListSurvey: Error loading data:', error);
            console.error('ListSurvey: Error details:', error.response?.data);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageSize]);

    // Load surveys on mount and when page changes
    useEffect(() => {
        loadSurveysData(false);
    }, [currentPage, pageSize]);

    // Auto-refresh when window gains focus (user returns to tab/window)
    useEffect(() => {
        const handleFocus = () => {
            // Reload surveys when user returns to the page
            console.log('ListSurvey: Window focused, refreshing surveys...');
            loadSurveysData(true);
        };

        window.addEventListener('focus', handleFocus);

        // Also refresh when page becomes visible (if using visibility API)
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('ListSurvey: Page became visible, refreshing surveys...');
                loadSurveysData(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [loadSurveysData]);

    // Pagination handlers
    const handlePageChange = (newPage) => {
        if (newPage >= 0 && newPage < totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handlePreviousPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1);
        }
    };

    // Generate page numbers for pagination
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(0, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    if (loading) {
        return (
            <div className="list-survey-container">
                <div className="list-survey-content">
                    <div className="loading">
                        <div className="loading-spinner"></div>
                        <span>Đang tải...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Notification Modal */}
            {notification && (
                <NotificationModal
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div className="list-survey-container">
                <div className="section">
                    <div className="section-header">
                        <h2>Danh sách khảo sát:</h2>
                        <div className="dashboard-actions">
                            <button className="btn-createsurvey" onClick={() => setShowCreateModal(true)}>+ Tạo khảo sát mới</button>
                        </div>
                    </div>
                    <div className="survey-list grid-3">
                        {surveys.length === 0 && (
                            <div className="empty">
                                <div className="empty-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
                                        <path d="M9 3v4a2 2 0 0 0 2 2h4" />
                                    </svg>
                                </div>
                                <span>Chưa có khảo sát nào.</span>
                            </div>
                        )}
                        {surveys.map((s) => (
                            <div
                                className={`survey-item ${s.status || 'draft'}`}
                                key={s.id || s._id}
                                onClick={() => navigate('/create-survey', { state: { editSurvey: s } })}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="survey-left">
                                    <div className="survey-title">{s.title || 'Không tiêu đề'}</div>
                                    {s.description && (
                                        <div className="survey-description">{s.description}</div>
                                    )}
                                    <div className="survey-meta">
                                        <span className="meta-item">
                                            <i className="fa-regular fa-user" title="Phản hồi"></i>
                                            {loadingResponseCounts ? (
                                                <span style={{ color: '#666' }}>...</span>
                                            ) : (
                                                responseCounts[String(s.id || s._id)] ?? s.responses ?? s.responseCount ?? 0
                                            )} phản hồi
                                        </span>
                                        <span>•</span>
                                        <span className="meta-item">
                                            <i className="fa-regular fa-clock" title="Thời gian tạo"></i>
                                            {new Date(s.createdAt || s.created_at || Date.now()).toLocaleDateString('vi-VN')}
                                        </span>
                                        <span>•</span>
                                        <span className={`status-badge ${s.status || 'draft'}`}>
                                            {s.status === 'published' ? 'Đang mở' : s.status === 'archived' ? 'Đã đóng' : 'Bản nháp'}
                                        </span>
                                    </div>
                                </div>
                                <div className="survey-right">
                                    <button
                                        className="action-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const surveyId = s.id || s._id;
                                            navigate('/report', {
                                                state: {
                                                    surveyId: surveyId,
                                                    surveyTitle: s.title || 'Khảo sát không có tiêu đề',
                                                    surveyDescription: s.description || '',
                                                    questions: s.questions || [],
                                                    questionsCount: s.questions?.length || 0,
                                                    isFromCreateSurvey: false
                                                }
                                            });
                                        }}
                                        title="Báo cáo"
                                    >
                                        <i className="fa-solid fa-chart-simple"></i>
                                    </button>
                                    <button
                                        className="action-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSurveyToShare(s);
                                            setConfirmShareModalOpen(true);
                                        }}
                                        title="Chia sẻ"
                                    >
                                        <i className="fa-solid fa-share"></i>
                                    </button>
                                    {s.status === 'published' && (
                                        <button
                                            className="action-btn"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const surveyId = s.id || s._id;
                                                // Lấy số câu hỏi cho survey
                                                let totalQuestions = 0;
                                                try {
                                                    const questions = await questionService.getQuestionsBySurvey(surveyId);
                                                    totalQuestions = Array.isArray(questions) ? questions.length : 0;
                                                } catch (error) {
                                                    console.error('Error fetching questions:', error);
                                                    totalQuestions = s.questions?.length || 0;
                                                }

                                                setSurveyToClose({
                                                    id: surveyId,
                                                    totalQuestions: totalQuestions,
                                                    status: s.status
                                                });
                                                setIsCloseSurveyModalOpen(true);
                                            }}
                                            title="Đóng khảo sát"
                                        >
                                            <i className="fa-solid fa-circle-xmark" title="Đóng khảo sát"></i>
                                        </button>
                                    )}
                                    <button
                                        className="action-btn"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Bạn có chắc muốn xóa khảo sát này không? Tất cả câu hỏi và tùy chọn trong khảo sát cũng sẽ bị xóa.')) {
                                                try {
                                                    const surveyId = s.id;
                                                    await surveyService.deleteSurvey(surveyId);
                                                    const updatedSurveys = surveys.filter(survey => survey.id !== s.id);
                                                    localStorage.setItem('userSurveys', JSON.stringify(updatedSurveys));
                                                    setSurveys(updatedSurveys);

                                                    // Update response counts by removing deleted survey (normalize ID to string)
                                                    const updatedCounts = { ...responseCounts };
                                                    delete updatedCounts[String(surveyId)];
                                                    setResponseCounts(updatedCounts);

                                                    if (updatedSurveys.length === 0 && currentPage > 0) {
                                                        setCurrentPage(0);
                                                    }
                                                    showNotification('success', 'Đã xóa khảo sát thành công!');
                                                } catch (error) {
                                                    console.error('Lỗi khi xóa khảo sát:', error);
                                                    showNotification('error', 'Xóa khảo sát thất bại. Vui lòng thử lại.');
                                                }
                                            }
                                        }}
                                        title="Xóa"
                                    >
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="pagination-container">
                            <div className="pagination">
                                <button
                                    className="pagination-btn"
                                    onClick={handlePreviousPage}
                                    disabled={currentPage === 0}
                                >
                                    <span className="icon-inline" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                                    </span>
                                    Trước
                                </button>

                                {getPageNumbers().map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                                        onClick={() => handlePageChange(pageNum)}
                                    >
                                        {pageNum + 1}
                                    </button>
                                ))}

                                <button
                                    className="pagination-btn"
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages - 1}
                                >
                                    Sau
                                    <span className="icon-inline" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal tạo khảo sát */}
                {showCreateModal && (
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
                    </div>
                )}

                {/* Modal xác nhận chia sẻ khảo sát */}
                {confirmShareModalOpen && surveyToShare && (
                    <div className="modal-overlay" onClick={() => { setConfirmShareModalOpen(false); setSurveyToShare(null); }}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => { setConfirmShareModalOpen(false); setSurveyToShare(null); }}>&times;</button>
                            <div className="modal-header">
                                <h3>Bạn muốn chia sẻ khảo sát?</h3>
                                <p>Khi chia sẻ, trạng thái khảo sát sẽ chuyển sang "Đang mở" để bắt đầu nhận phản hồi.</p>
                            </div>
                            <div className="modal-actions">
                                <button
                                    className="btn-yes"
                                    onClick={async () => {
                                        try {
                                            const id = surveyToShare.id;
                                            await surveyService.updateSurvey(id, { status: 'published' });
                                            // Cập nhật trạng thái trong danh sách hiện tại và localStorage (nếu có)
                                            const updatedSurveys = surveys.map((item) =>
                                                (item.id === id ? { ...item, status: 'published' } : item)
                                            );
                                            setSurveys(updatedSurveys);
                                            const localSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
                                            if (Array.isArray(localSurveys) && localSurveys.length > 0) {
                                                const updatedLocal = localSurveys.map((item) =>
                                                    (item.id === id ? { ...item, status: 'published' } : item)
                                                );
                                                localStorage.setItem('userSurveys', JSON.stringify(updatedLocal));
                                            }

                                            // Refresh response counts after sharing survey
                                            fetchResponseCounts(updatedSurveys);
                                            setConfirmShareModalOpen(false);
                                            const shareSurvey = updatedSurveys.find((it) => it.id === id) || surveyToShare;
                                            navigate('/share-survey', { state: { surveyId: id, survey: shareSurvey } });
                                        } catch (error) {
                                            console.error('Lỗi khi cập nhật trạng thái khảo sát:', error);
                                            showNotification('error', 'Không thể chia sẻ khảo sát. Vui lòng thử lại.');
                                        }
                                    }}
                                >
                                    Có
                                </button>
                                <button
                                    className="btn-no"
                                    onClick={() => {
                                        setConfirmShareModalOpen(false);
                                        setSurveyToShare(null);
                                    }}
                                >
                                    Không
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal đóng khảo sát */}
                {surveyToClose && (
                    <CloseSurvey
                        isOpen={isCloseSurveyModalOpen}
                        onClose={() => {
                            setIsCloseSurveyModalOpen(false);
                            setSurveyToClose(null);
                        }}
                        survey={surveyToClose}
                        statusMeta={getStatusMeta(surveyToClose.status)}
                        onConfirm={handleCloseSurvey}
                        isClosingSurvey={isClosingSurvey}
                    />
                )}
            </div>
        </>
    );
};

export default ListSurvey;
