import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { surveyService } from '../services/surveyService';
import './ListSurvey.css';

const ListSurvey = () => {
    const navigate = useNavigate();
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [pageSize] = useState(12);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Check token before making API calls
                const token = localStorage.getItem('token');
                // Load surveys from localStorage first
                const localSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
                // Try to get data from API
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
                            Array.isArray(apiSurveys) ? apiSurveys : localSurveys;
                        setTotalPages(1);
                        setTotalElements(surveysList.length);
                    }
                } else {
                    // Fallback to local data with pagination
                    const startIndex = currentPage * pageSize;
                    const endIndex = startIndex + pageSize;
                    surveysList = localSurveys.slice(startIndex, endIndex);
                    setTotalPages(Math.ceil(localSurveys.length / pageSize));
                    setTotalElements(localSurveys.length);
                }

                setSurveys(surveysList);
            } catch (error) {
                console.error('ListSurvey: Error loading data:', error);
                console.error('ListSurvey: Error details:', error.response?.data);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentPage, pageSize]);

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
                                        {s.responses ?? s.responseCount ?? 0} phản hồi
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
                                        alert('Chức năng báo cáo sẽ được phát triển');
                                    }}
                                    title="Báo cáo"
                                >
                                    <i className="fa-solid fa-chart-simple"></i>
                                </button>
                                <button
                                    className="action-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        alert('Chức năng chia sẻ sẽ được phát triển');
                                    }}
                                    title="Chia sẻ"
                                >
                                    <i className="fa-solid fa-share"></i>
                                </button>
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
                                                if (updatedSurveys.length === 0 && currentPage > 0) {
                                                    setCurrentPage(0);
                                                }
                                                alert('Đã xóa khảo sát thành công!');
                                            } catch (error) {
                                                console.error('Lỗi khi xóa khảo sát:', error);
                                                alert('Xóa khảo sát thất bại. Vui lòng thử lại.');
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
                        <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>&times;</button>
                        <div className="modal-header">
                            <h3>Bạn muốn bắt đầu như thế nào?</h3>
                            <p>Chọn phương thức tạo khảo sát phù hợp với nhu cầu của bạn</p>
                        </div>
                        <div className="modal-body">
                            <div className="create-option" onClick={() => { setShowCreateModal(false); navigate('/create-ai'); }}>
                                
                                <i className="fa-brands fa-discord" title="Tạo bằng AI" style={{ fontSize: '50px', marginBottom: '16px', color: '#3b82f6' }}></i>
                                
                                <div className="option-title">Tạo bằng AI</div>
                                <p className="option-desc">Mô tả ý tưởng của bạn, AI sẽ tự động tạo một bản nháp khảo sát để bạn bắt đầu.</p>
                                <ul>
                                    <li>Tiết kiệm thời gian</li>
                                    <li>Gợi ý câu hỏi thông minh</li>
                                    <li>Tối ưu mục tiêu</li>
                                </ul>
                                <button className="btn-primary small">Bắt đầu ngay</button>
                            </div>
                            <div className="create-option" onClick={() => { setShowCreateModal(false); navigate('/create-survey'); }}>
                               
                                <i className="fa-solid fa-square-pen" title="Tạo thủ công" style={{ fontSize: '50px', marginBottom: '16px', color: '#64748b' }}></i>
                               
                                <div className="option-title">Tạo thủ công</div>
                                <p className="option-desc">Tự tay xây dựng khảo sát từ đầu để toàn quyền kiểm soát mọi câu hỏi và chi tiết.</p>
                                <ul>
                                    <li>Kiểm soát hoàn toàn</li>
                                    <li>Tùy chỉnh chi tiết</li>
                                    <li>Thiết kế theo ý muốn</li>
                                </ul>
                                <button className="btn-primary small">Bắt đầu ngay</button>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <p className="note">Lưu ý: Bạn có thể chỉnh sửa và tùy chỉnh khảo sát sau khi tạo bằng cả hai phương thức.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};

export default ListSurvey;
