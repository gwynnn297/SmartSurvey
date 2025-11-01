import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { dashboardReportService } from '../../services/dashboardReport';

import './DashboardReportPage.css';

const MetricCard = ({ bgClass, icon, title, value }) => (
    <div className={`report-card ${bgClass}`}>
        <div className="report-card__icon" aria-hidden="true">{icon}</div>
        <div className="report-card__content">
            <p className="report-card__title">{title}</p>
            <div className="report-card__value">{value}</div>
        </div>
    </div>
);

const RecentItem = ({ color, text, time }) => (
    <div className="recent-item">
        <span className={`recent-dot ${color}`} aria-hidden="true" />
        <span className="recent-text">{text}</span>
        <span className="recent-time">{time}</span>
    </div>
);

const ProgressItem = ({ label, valueLabel, percent, colorClass, showPlus = false }) => (
    <div className="progress-item">
        <div className="progress-item__head">
            <span>{label}</span>
            <span className="progress-item__value">{valueLabel}</span>
        </div>
        <div className="progress">
            <div className={`progress__bar ${colorClass}`} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
        </div>
        {showPlus && <div className="progress-item__note">+{percent}</div>}
    </div>
);

export default function DashboardReportPage() {
    const navigate = useNavigate();
    const location = useLocation();

    // Lấy dữ liệu survey từ state
    const surveyData = location.state || {};
    const {
        surveyId,
        surveyTitle = 'Khảo sát không có tiêu đề',
        surveyDescription = '',
        questions = [],
        questionsCount = 0,
        isFromCreateSurvey = false
    } = surveyData;

    // State cho dữ liệu thống kê dashboard
    const [dashboardStats, setDashboardStats] = useState({
        totalResponses: 0,
        totalViews: 0,
        completionRate: 0,
        averageTime: '0m',
        loading: true,
        error: null
    });

    // State cho danh sách phản hồi gần đây
    const [recentResponses, setRecentResponses] = useState({
        data: [],
        loading: true,
        error: null
    });

    // Tính toán thống kê từ dữ liệu questions
    const surveyStats = useMemo(() => {
        const stats = {
            totalQuestions: questionsCount,
            requiredQuestions: questions.filter(q => q.is_required).length,
            multipleChoice: questions.filter(q => q.question_type === 'multiple_choice').length,
            singleChoice: questions.filter(q => q.question_type === 'single_choice').length,
            openEnded: questions.filter(q => q.question_type === 'open_ended').length,
            boolean: questions.filter(q => q.question_type === 'boolean_' || q.question_type === 'yes_no').length,
            ranking: questions.filter(q => q.question_type === 'ranking').length,
            rating: questions.filter(q => q.question_type === 'rating').length,
            dateTime: questions.filter(q => q.question_type === 'date_time').length,
            fileUpload: questions.filter(q => q.question_type === 'file_upload').length
        };
        return stats;
    }, [questions, questionsCount]);

    // Effect để lấy dữ liệu thống kê từ API
    useEffect(() => {
        const fetchDashboardStats = async () => {
            if (!surveyId) {
                // Nếu không có surveyId, sử dụng dữ liệu mặc định
                setDashboardStats(prev => ({
                    ...prev,
                    totalResponses: isFromCreateSurvey ? questionsCount : 128,
                    totalViews: isFromCreateSurvey ? 0 : 1000,
                    completionRate: isFromCreateSurvey ? 0 : 95,
                    averageTime: isFromCreateSurvey ? '0m' : '3.2m',
                    loading: false
                }));

                setRecentResponses(prev => ({
                    ...prev,
                    data: [],
                    loading: false,
                    error: null
                }));
                return;
            }

            try {
                setDashboardStats(prev => ({ ...prev, loading: true, error: null }));
                setRecentResponses(prev => ({ ...prev, loading: true, error: null }));

                // Gọi API để lấy thống kê phản hồi
                const responseData = await dashboardReportService.getResponsesWithStats(surveyId, {
                    filter: { page: 0, size: 1 }, // Chỉ cần thống kê, không cần dữ liệu chi tiết
                    includeStats: true
                });

                // Gọi API để lấy danh sách phản hồi gần đây (5 phản hồi mới nhất)
                const recentResponsesData = await dashboardReportService.listResponses(surveyId, {
                    page: 0,
                    size: 5,
                    sortBy: 'submittedAt',
                    sortDir: 'desc'
                });

                // Tính toán dữ liệu thống kê
                const totalResponses = responseData.statistics?.totalResponses || responseData.totalElements || 0;
                const completionRate = responseData.statistics?.completionRate || 0;

                // Tính total views (giả sử = totalResponses * 1.5 cho demo, có thể thay đổi logic)
                const totalViews = Math.floor(totalResponses * 1.5) || 0;

                // Tính average time (giả sử mỗi response mất 3.2 phút, có thể thay đổi logic)
                const averageTimeMinutes = totalResponses > 0 ? 3.2 : 0;
                const averageTime = averageTimeMinutes > 0 ? `${averageTimeMinutes}m` : '0m';

                setDashboardStats(prev => ({
                    ...prev,
                    totalResponses,
                    totalViews,
                    completionRate,
                    averageTime,
                    loading: false,
                    error: null
                }));

                setRecentResponses(prev => ({
                    ...prev,
                    data: recentResponsesData.content || [],
                    loading: false,
                    error: null
                }));

            } catch (error) {
                console.error('Lỗi khi lấy dữ liệu thống kê:', error);

                // Fallback về dữ liệu mặc định khi có lỗi
                setDashboardStats(prev => ({
                    ...prev,
                    totalResponses: isFromCreateSurvey ? questionsCount : 128,
                    totalViews: isFromCreateSurvey ? 0 : 1000,
                    completionRate: isFromCreateSurvey ? 0 : 95,
                    averageTime: isFromCreateSurvey ? '0m' : '3.2m',
                    loading: false,
                    error: 'Không thể tải dữ liệu thống kê'
                }));

                setRecentResponses(prev => ({
                    ...prev,
                    data: [],
                    loading: false,
                    error: 'Không thể tải danh sách phản hồi'
                }));
            }
        };

        fetchDashboardStats();
    }, [surveyId, isFromCreateSurvey, questionsCount]);

    // Helper function để format thời gian
    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return 'Không xác định';

        try {
            const date = new Date(dateTimeString);
            const now = new Date();
            const diffInMs = now - date;
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
            const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

            if (diffInMinutes < 1) {
                return 'Vừa xong';
            } else if (diffInMinutes < 60) {
                return `${diffInMinutes} phút trước`;
            } else if (diffInHours < 24) {
                return `${diffInHours} giờ trước`;
            } else if (diffInDays === 1) {
                return 'Hôm qua';
            } else if (diffInDays < 7) {
                return `${diffInDays} ngày trước`;
            } else {
                return date.toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (error) {
            return 'Không xác định';
        }
    };

    const recentActivities = useMemo(() => {
        if (isFromCreateSurvey) {
            return [
                { color: 'green', text: `Khảo sát "${surveyTitle}" đã được tạo`, time: 'Vừa xong' },
                { color: 'blue', text: `Tổng ${questionsCount} câu hỏi đã được thiết lập`, time: 'Vừa xong' },
                { color: 'purple', text: 'Chờ xuất bản để thu thập phản hồi', time: 'Vừa xong' }
            ];
        }

        // Nếu đang loading hoặc có lỗi, hiển thị thông báo tương ứng
        if (recentResponses.loading) {
            return [
                { color: 'blue', text: 'Đang tải danh sách phản hồi...', time: '' }
            ];
        }

        if (recentResponses.error) {
            return [
                { color: 'red', text: 'Không thể tải danh sách phản hồi', time: '' }
            ];
        }

        // Nếu không có phản hồi nào
        if (!recentResponses.data || recentResponses.data.length === 0) {
            return [
                { color: 'gray', text: 'Chưa có phản hồi nào', time: '' }
            ];
        }

        // Tạo danh sách từ dữ liệu thật
        const colors = ['green', 'purple', 'orange', 'blue', 'red', 'teal', 'yellow'];
        return recentResponses.data.map((response, index) => ({
            color: colors[index % colors.length],
            text: 'Phản hồi mới từ Ẩn danh', // Luôn hiển thị "Ẩn danh" cho tất cả phản hồi
            time: formatDateTime(response.submittedAt || response.createdAt)
        }));
    }, [isFromCreateSurvey, surveyTitle, questionsCount, recentResponses]);

    const handleExport = () => {
        navigate('/report/export');
    };

    return (
        <MainLayout>
            <div className="report-container">
                <header className="report-header">
                    <div className="report-header__top">
                        <div className="report-header__titles">
                            <h1>
                                {isFromCreateSurvey ? `${surveyTitle}` : 'Tổng quan khảo sát'}
                            </h1>
                            <p>
                                {isFromCreateSurvey && surveyDescription
                                    ? surveyDescription
                                    : 'Thống kê tổng thể về phản hồi và kết quả khảo sát của bạn'
                                }
                            </p>
                            {/* {isFromCreateSurvey && (
                                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '6px', fontSize: '14px', color: '#0369a1' }}>
                                    <strong>Survey ID:</strong> {surveyId}
                                </div>
                            )} */}
                        </div>
                        <button className="export-btn" onClick={handleExport}>
                            <span className="btn-icon" aria-hidden="true">🧾</span>
                            Xuất báo cáo
                        </button>
                    </div>
                </header>

                {dashboardStats.error && (
                    <div style={{
                        margin: '16px 0',
                        padding: '12px 16px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        color: '#dc2626',
                        fontSize: '14px'
                    }}>
                        <strong>⚠️ Lỗi:</strong> {dashboardStats.error}
                    </div>
                )}

                <section className="report-metrics" aria-label="Chỉ số chính">
                    <MetricCard
                        bgClass="pink"
                        title="Tổng phản hồi"
                        value={dashboardStats.loading ? "..." : dashboardStats.totalResponses.toString()}
                        icon={(
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                                <rect x="7" y="12" width="2.5" height="5" fill="currentColor" />
                                <rect x="11" y="9" width="2.5" height="8" fill="currentColor" />
                                <rect x="15" y="6" width="2.5" height="11" fill="currentColor" />
                            </svg>
                        )}
                    />
                    <MetricCard
                        bgClass="yellow"
                        title="Số lượt xem"
                        value={dashboardStats.loading ? "..." : dashboardStats.totalViews.toString()}
                        icon={(
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="1.5">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    />
                    <MetricCard
                        bgClass="peach"
                        title="Hoàn thành"
                        value={dashboardStats.loading ? "..." : `${Math.round(dashboardStats.completionRate)}%`}
                        icon={(
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    />
                    <MetricCard
                        bgClass="pink"
                        title="Thời gian TB"
                        value={dashboardStats.loading ? "..." : dashboardStats.averageTime}
                        icon={(
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    />

                </section>

                <section className="report-panels">
                    <div className="panel left">
                        <h3>Hoạt động gần đây</h3>
                        <div className="recent-list">
                            {recentActivities.map((item, idx) => (
                                <RecentItem key={idx} {...item} />
                            ))}
                        </div>
                    </div>

                    <div className="panel right">
                        <h3>Thống kê nhanh</h3>
                        <div className="quick-stats">
                            {isFromCreateSurvey ? (
                                <>
                                    {surveyStats.multipleChoice > 0 && (
                                        <ProgressItem
                                            label="Trắc nghiệm nhiều lựa chọn"
                                            valueLabel={`${surveyStats.multipleChoice} câu`}
                                            percent={(surveyStats.multipleChoice / surveyStats.totalQuestions) * 100}
                                            colorClass="indigo"
                                        />
                                    )}
                                    {surveyStats.singleChoice > 0 && (
                                        <ProgressItem
                                            label="Trắc nghiệm một lựa chọn"
                                            valueLabel={`${surveyStats.singleChoice} câu`}
                                            percent={(surveyStats.singleChoice / surveyStats.totalQuestions) * 100}
                                            colorClass="purple"
                                        />
                                    )}
                                    {surveyStats.openEnded > 0 && (
                                        <ProgressItem
                                            label="Câu hỏi mở"
                                            valueLabel={`${surveyStats.openEnded} câu`}
                                            percent={(surveyStats.openEnded / surveyStats.totalQuestions) * 100}
                                            colorClass="green"
                                        />
                                    )}
                                    {surveyStats.boolean > 0 && (
                                        <ProgressItem
                                            label="Đúng/Sai"
                                            valueLabel={`${surveyStats.boolean} câu`}
                                            percent={(surveyStats.boolean / surveyStats.totalQuestions) * 100}
                                            colorClass="blue"
                                        />
                                    )}
                                    {surveyStats.ranking > 0 && (
                                        <ProgressItem
                                            label="Xếp hạng"
                                            valueLabel={`${surveyStats.ranking} câu`}
                                            percent={(surveyStats.ranking / surveyStats.totalQuestions) * 100}
                                            colorClass="orange"
                                        />
                                    )}
                                    {surveyStats.rating > 0 && (
                                        <ProgressItem
                                            label="Đánh giá sao"
                                            valueLabel={`${surveyStats.rating} câu`}
                                            percent={(surveyStats.rating / surveyStats.totalQuestions) * 100}
                                            colorClass="yellow"
                                        />
                                    )}
                                    {surveyStats.dateTime > 0 && (
                                        <ProgressItem
                                            label="Ngày/Giờ"
                                            valueLabel={`${surveyStats.dateTime} câu`}
                                            percent={(surveyStats.dateTime / surveyStats.totalQuestions) * 100}
                                            colorClass="teal"
                                        />
                                    )}
                                    {surveyStats.fileUpload > 0 && (
                                        <ProgressItem
                                            label="Tải file"
                                            valueLabel={`${surveyStats.fileUpload} câu`}
                                            percent={(surveyStats.fileUpload / surveyStats.totalQuestions) * 100}
                                            colorClass="red"
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    <ProgressItem label="Câu hỏi trắc nghiệm" valueLabel="8 câu" percent={100} colorClass="indigo" />
                                    <ProgressItem label="Trả lời ngắn" valueLabel="2 câu" percent={40} colorClass="indigo" />
                                    <ProgressItem label="Tỷ lệ hài lòng" valueLabel="87%" percent={87} colorClass="green" />
                                    <ProgressItem label="Xếp hạng" valueLabel={"5 sao"} percent={70} colorClass="blue" />
                                </>
                            )}
                        </div>
                    </div>
                </section>

                <section className="report-actions">
                    {/* {isFromCreateSurvey && (
                        <button className="btn orange" onClick={() => navigate('/create-survey', {
                            state: { editSurvey: { id: surveyId, title: surveyTitle, description: surveyDescription } }
                        })}>
                            <span className="btn-icon" aria-hidden="true">✏️</span>
                            Quay lại chỉnh sửa
                        </button>
                    )} */}
                    <button className="btn blue" onClick={() => navigate('/report/details-statistic', {
                        state: isFromCreateSurvey ? { surveyId, surveyTitle, surveyDescription } : undefined
                    })}>
                        <span className="btn-icon" aria-hidden="true">📊</span>
                        Xem thống kê chi tiết
                    </button>
                    <button className="btn green" onClick={() => navigate('/report/individual-responses', {
                        state: isFromCreateSurvey ? { surveyId, surveyTitle, surveyDescription } : undefined
                    })}>
                        <span className="btn-icon" aria-hidden="true">🧠</span>
                        Danh sách phản hồi
                    </button>
                    <button className="btn teal" onClick={() => navigate('/report/sentiment', {
                        state: isFromCreateSurvey ? { surveyId, surveyTitle, surveyDescription } : undefined
                    })}>
                        <span className="btn-icon" aria-hidden="true">😊</span>
                        Phân tích cảm xúc
                    </button>

                </section>
            </div>
        </MainLayout>
    );
}