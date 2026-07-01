import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { dashboardReportService } from '../../services/dashboardReportService';
import { surveyService } from '../../services/surveyService';
import { teamManagementService } from '../../services/teamManagementService';
import ToolbarResult from '../../components/ToolbarResult';
import AIChat, { AIChatButton } from '../../components/AIChat';

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
    const [showAIChat, setShowAIChat] = useState(false);

    // Lấy dữ liệu survey từ state
    const surveyData = location.state || {};
    const {
        surveyId,
        surveyTitle: initialSurveyTitle,
        surveyDescription: initialSurveyDescription,
        questions = [],
        questionsCount = 0,
        isFromCreateSurvey = false
    } = surveyData;

    // State để lưu survey info đã load từ API
    const [surveyInfo, setSurveyInfo] = useState({
        title: initialSurveyTitle || null,
        description: initialSurveyDescription || null
    });

    // Sử dụng survey info từ API nếu có, nếu không thì dùng từ location.state hoặc giá trị mặc định
    const surveyTitle = surveyInfo.title || initialSurveyTitle || 'Khảo sát không có tiêu đề';
    const surveyDescription = surveyInfo.description || initialSurveyDescription || '';

    // State cho dữ liệu thống kê dashboard
    const [dashboardStats, setDashboardStats] = useState({
        totalResponses: 0,
        totalViews: 0,
        completionRate: 0,
        averageTime: '0m',
        loading: true,
        error: null,
        isRealData: false,
        fallbackReason: null
    });

    // State cho danh sách phản hồi gần đây
    const [recentResponses, setRecentResponses] = useState({
        hourlyData: [], // Dữ liệu theo giờ từ timeline API
        loading: true,
        error: null
    });

    // State cho thống kê số câu hỏi theo loại
    const [questionCounts, setQuestionCounts] = useState({
        data: null,
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
            boolean: questions.filter(q => q.question_type === 'boolean' || q.question_type === 'yes_no').length,
            ranking: questions.filter(q => q.question_type === 'ranking').length,
            rating: questions.filter(q => q.question_type === 'rating').length,
            dateTime: questions.filter(q => q.question_type === 'date_time').length,
            fileUpload: questions.filter(q => q.question_type === 'file_upload').length
        };
        return stats;
    }, [questions, questionsCount]);

    // Kiểm tra quyền xem báo cáo của người dùng hiện tại (Chỉ OWNER và ANALYST)
    useEffect(() => {
        const checkPermission = async () => {
            if (!surveyId) return;
            try {
                // Gọi API overview để mượn logic phân quyền của backend (StatisticsService)
                // Backend sẽ ném lỗi 403 nếu user cố truy cập mà không phải OWNER/ANALYST
                await dashboardReportService.getSurveyOverview(surveyId);
            } catch (err) {
                if (err.response?.status === 403) {
                    alert('Bạn không có quyền xem báo cáo. Chỉ OWNER và ANALYST mới có quyền.');
                    navigate('/dashboard');
                }
            }
        };

        checkPermission();
    }, [surveyId, navigate]);

    // Effect để load survey info nếu chưa có
    useEffect(() => {
        const loadSurveyInfo = async () => {
            if (!surveyId) return;
            // Nếu đã có surveyTitle từ location.state, không cần load lại
            if (initialSurveyTitle) return;

            try {
                const survey = await surveyService.getSurveyById(surveyId);
                setSurveyInfo({
                    title: survey.title || 'Khảo sát',
                    description: survey.description || ''
                });
            } catch (error) {
                console.error('Error loading survey info:', error);
            }
        };

        loadSurveyInfo();
    }, [surveyId, initialSurveyTitle]);

    // Effect để lấy dữ liệu thống kê từ API
    useEffect(() => {
        const fetchDashboardStats = async () => {
            if (!surveyId) {
                // Nếu không có surveyId, sử dụng dữ liệu mặc định là 0
                setDashboardStats(prev => ({
                    ...prev,
                    totalResponses: 0,
                    totalViews: 0,
                    completionRate: 0,
                    averageTime: '0m',
                    loading: false,
                    isRealData: false,
                    fallbackReason: 'No surveyId provided'
                }));

                setRecentResponses(prev => ({
                    ...prev,
                    hourlyData: [],
                    loading: false,
                    error: null
                }));
                return;
            }

            try {
                setDashboardStats(prev => ({ ...prev, loading: true, error: null }));
                setRecentResponses(prev => ({ ...prev, loading: true, error: null }));

                // Gọi API tổng hợp từ StatisticsController với fallback mechanism
                const dashboardData = await dashboardReportService.getDashboardData(surveyId);

                const { overview: overviewData, timeline: timelineData, questionCounts: questionCountsData, isRealData, fallbackReason } = dashboardData;

                // Log data source information
                if (isRealData) {
                    console.log('✅ Using real data from StatisticsController APIs');
                } else {
                    console.log('📊 API returned fallback/mock data:', fallbackReason);
                }

                // Nếu không có dữ liệu thực (API lỗi hoặc fallback), hiển thị 0
                if (!isRealData) {
                    setDashboardStats(prev => ({
                        ...prev,
                        totalResponses: 0,
                        totalViews: 0,
                        completionRate: 0,
                        averageTime: '0m',
                        loading: false,
                        error: 'Không thể lấy dữ liệu thống kê',
                        isRealData: false,
                        fallbackReason
                    }));

                    setRecentResponses(prev => ({
                        ...prev,
                        data: [],
                        loading: false,
                        error: 'Không thể tải danh sách phản hồi'
                    }));
                    return;
                }

                // Map dữ liệu từ SurveyOverviewResponseDTO (chỉ khi có dữ liệu thực)
                const totalResponses = overviewData.totalResponses || 0;
                const totalViews = overviewData.viewership || 0;
                const completionRate = overviewData.completionRate || 0;
                const averageTime = overviewData.avgCompletionTime || '0m';

                setDashboardStats(prev => ({
                    ...prev,
                    totalResponses,
                    totalViews,
                    completionRate,
                    averageTime,
                    loading: false,
                    error: null,
                    isRealData,
                    fallbackReason
                }));

                // Map hourly data từ timeline để tạo danh sách phản hồi gần đây
                const hourlyData = timelineData.hourly ? timelineData.hourly : [];

                setRecentResponses(prev => ({
                    ...prev,
                    hourlyData: hourlyData,
                    loading: false,
                    error: null
                }));

                // Lưu dữ liệu question counts từ API
                setQuestionCounts(prev => ({
                    ...prev,
                    data: questionCountsData,
                    loading: false,
                    error: null
                }));

            } catch (error) {
                console.error('Lỗi khi lấy dữ liệu thống kê:', error);

                // Fallback về dữ liệu mặc định khi có lỗi (tất cả là 0)
                setDashboardStats(prev => ({
                    ...prev,
                    totalResponses: 0,
                    totalViews: 0,
                    completionRate: 0,
                    averageTime: '0m',
                    loading: false,
                    error: 'Không thể tải dữ liệu thống kê',
                    isRealData: false,
                    fallbackReason: 'API error - using fallback data'
                }));

                setRecentResponses(prev => ({
                    ...prev,
                    hourlyData: [],
                    loading: false,
                    error: 'Không thể tải danh sách phản hồi'
                }));

                setQuestionCounts(prev => ({
                    ...prev,
                    data: null,
                    loading: false,
                    error: 'Không thể tải thống kê câu hỏi'
                }));
            }
        };

        fetchDashboardStats();
    }, [surveyId, isFromCreateSurvey, questionsCount]);

    // Helper function để format thời gian "X phút trước" từ hourly data
    // Hourly data là 24 giờ gần nhất (từ hôm qua đến hôm nay)
    const formatTimeAgoFromHourly = (hour, currentDate = new Date()) => {
        if (!hour) return 'Không xác định';

        try {
            // Parse hour format "HH:mm"
            const [hours, minutes] = hour.split(':').map(Number);
            const now = new Date(currentDate);
            const nowHours = now.getHours();
            const nowMinutes = now.getMinutes();

            // Xác định date: hourly data là 24 giờ gần nhất
            // Nếu hour > giờ hiện tại => là hôm qua (vì đã qua 24 giờ)
            // Nếu hour <= giờ hiện tại => là hôm nay
            const targetDate = new Date(now);

            if (hours > nowHours || (hours === nowHours && minutes > nowMinutes)) {
                // Hour này là từ hôm qua
                targetDate.setDate(targetDate.getDate() - 1);
            }

            targetDate.setHours(hours, minutes, 0, 0);

            // Tính khoảng thời gian từ targetDate đến hiện tại
            const diffInMs = now - targetDate;
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

            if (diffInMinutes < 1) {
                return 'Vừa xong';
            } else if (diffInMinutes < 60) {
                return `${diffInMinutes} phút trước`;
            } else if (diffInMinutes < 60 * 24) {
                return `${Math.floor(diffInMinutes / 60)} giờ trước`;
            } else {
                return `${Math.floor(diffInMinutes / (60 * 24))} ngày trước`;
            }
        } catch (error) {
            return 'Không xác định';
        }
    };

    const recentActivities = useMemo(() => {
        // Nếu đang loading, hiển thị thông báo loading
        if (recentResponses.loading) {
            return [
                { color: 'blue', text: 'Đang tải danh sách phản hồi...', time: '' }
            ];
        }

        // Nếu có lỗi, hiển thị thông báo lỗi
        if (recentResponses.error) {
            return [
                { color: 'red', text: 'Không thể tải danh sách phản hồi', time: '' }
            ];
        }

        // Nếu có hourlyData và có dữ liệu, hiển thị danh sách phản hồi thực tế
        if (recentResponses.hourlyData && recentResponses.hourlyData.length > 0) {
            // Tạo danh sách từ hourly data: mỗi response là một "Phản hồi mới từ Người tham gia XXX"
            const colors = ['green', 'blue', 'purple', 'orange', 'red', 'teal', 'yellow'];
            const activities = [];

            // Bắt đầu counter từ 0 và tăng dần (0, 1, 2, 3...)
            let participantCounter = 1;

            // Lấy hourly data và sắp xếp theo giờ (mới nhất trước)
            // Hourly data từ backend đã được sắp xếp theo giờ tăng dần, cần reverse để có mới nhất trước
            const sortedHourlyData = [...recentResponses.hourlyData].reverse();

            // Tạo danh sách items từ hourly data
            sortedHourlyData.forEach((hourData) => {
                const count = hourData.count || 0;
                const hour = hourData.hour || '';

                if (!hour || count === 0) return;

                // Tạo count items cho mỗi hour (mỗi item là một "Phản hồi mới từ Người tham gia XXX")
                for (let i = 0; i < count; i++) {
                    const colorIndex = activities.length % colors.length;
                    activities.push({
                        color: colors[colorIndex],
                        text: `Phản hồi mới từ Người tham gia ${participantCounter}`,
                        time: formatTimeAgoFromHourly(hour)
                    });
                    participantCounter++;
                }
            });

            // Trả về tất cả activities (sẽ có thanh cuộn nếu nhiều hơn 10 items)
            return activities;
        }

        // Nếu không có dữ liệu và đang ở chế độ tạo survey mới, hiển thị thông báo tạo survey
        if (isFromCreateSurvey && (!surveyId || !recentResponses.hourlyData || recentResponses.hourlyData.length === 0)) {
            return [
                { color: 'green', text: `Khảo sát "${surveyTitle}" đã được tạo`, time: 'Vừa xong' },
                { color: 'blue', text: `Tổng ${questionsCount} câu hỏi đã được thiết lập`, time: 'Vừa xong' },
                { color: 'purple', text: 'Chờ xuất bản để thu thập phản hồi', time: 'Vừa xong' }
            ];
        }

        // Mặc định: không có phản hồi nào
        return [
            { color: 'gray', text: 'Chưa có phản hồi nào', time: '' }
        ];
    }, [isFromCreateSurvey, surveyTitle, questionsCount, recentResponses, surveyId]);

    // Helper function để map loại câu hỏi sang tiếng Việt
    const getQuestionTypeLabel = (type) => {
        const typeMap = {
            'multiple_choice': 'Trắc nghiệm nhiều lựa chọn',
            'single_choice': 'Trắc nghiệm một lựa chọn',
            'open_ended': 'Câu hỏi mở',
            'rating': 'Đánh giá sao',
            'boolean': 'Đúng/Sai',
            'ranking': 'Xếp hạng',
            'file_upload': 'Tải file',
            'date_time': 'Ngày/Giờ'
        };
        return typeMap[type] || type;
    };

    // Helper function để lấy màu cho từng loại câu hỏi
    const getQuestionTypeColor = (type) => {
        const colorMap = {
            'multiple_choice': 'indigo',
            'single_choice': 'purple',
            'open_ended': 'green',
            'rating': 'yellow',
            'boolean': 'blue',
            'ranking': 'orange',
            'file_upload': 'red',
            'date_time': 'teal'
        };
        return colorMap[type] || 'indigo';
    };

    const normalizeQuestionTypeKey = (typeKey = '') => {
        const key = (typeKey || '').toString().toLowerCase();
        switch (key) {
            case 'multiplechoice':
            case 'multiple_choice':
                return 'multiple_choice';
            case 'singlechoice':
            case 'single_choice':
                return 'single_choice';
            case 'openended':
            case 'open_ended':
            case 'text':
                return 'open_ended';
            case 'rating':
            case 'rating_star':
            case 'star_rating':
                return 'rating';
            case 'boolean':
            case 'boolean_':
            case 'yes_no':
            case 'true_false':
                return 'boolean';
            case 'ranking':
            case 'rank':
                return 'ranking';
            case 'fileupload':
            case 'file_upload':
            case 'upload':
                return 'file_upload';
            case 'datetime':
            case 'date_time':
            case 'date':
            case 'time':
                return 'date_time';
            default:
                return key;
        }
    };

    // Helper function để render tất cả các loại câu hỏi
    const renderQuestionStats = (byType = {}, totalQuestions = 0) => {
        const allQuestionTypes = [
            'multiple_choice',
            'single_choice',
            'open_ended',
            'rating',
            'boolean',
            'ranking',
            'file_upload',
            'date_time'
        ];

        const normalizedCounts = Object.entries(byType || {}).reduce((acc, [rawType, rawCount]) => {
            const normalizedType = normalizeQuestionTypeKey(rawType);
            const count = Number(rawCount) || 0;
            if (!normalizedType) return acc;
            acc[normalizedType] = (acc[normalizedType] || 0) + count;
            return acc;
        }, {});

        const countsArray = allQuestionTypes.map((type) => normalizedCounts[type] || 0);
        const sumCounts = countsArray.reduce((sum, value) => sum + value, 0);
        const maxCount = countsArray.reduce((max, value) => Math.max(max, value), 0);
        const denominator = totalQuestions > 0 ? totalQuestions : (sumCounts > 0 ? sumCounts : maxCount);

        return allQuestionTypes.map((type) => {
            const count = normalizedCounts[type] || 0;
            const percent = denominator > 0 ? (count / denominator) * 100 : 0;

            return (
                <ProgressItem
                    key={type}
                    label={getQuestionTypeLabel(type)}
                    valueLabel={`${count} câu`}
                    percent={percent}
                    colorClass={getQuestionTypeColor(type)}
                />
            );
        });
    };

    const handleExport = () => {
        navigate('/report/export', {
            state: surveyId ? { surveyId, surveyTitle, surveyDescription } : undefined
        });
    };

    return (
        <MainLayout
            surveyId={surveyId}
            surveyTitle={surveyTitle}
            surveyDescription={surveyDescription}
        >
            <div className="report-container">
                <ToolbarResult
                    surveyId={surveyId}
                    surveyTitle={surveyTitle}
                    surveyDescription={surveyDescription}
                />
                <header className="report-header">
                    <div className="report-header__top">
                        <div className="report-header__titles">
                            <h1>
                                {surveyTitle || 'Tổng quan khảo sát'}
                            </h1>
                            <p>
                                {surveyDescription || 'Thống kê tổng thể về phản hồi và kết quả khảo sát của bạn'}
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

                {/* Data Source Notice
                {surveyId && !dashboardStats.error && !dashboardStats.loading && (
                    <div style={{
                        margin: '16px 0',
                        padding: '12px 16px',
                        background: dashboardStats.isRealData ? '#f0fdf4' : '#fffbeb',
                        border: dashboardStats.isRealData ? '1px solid #16a34a' : '1px solid #f59e0b',
                        borderRadius: '8px',
                        color: dashboardStats.isRealData ? '#166534' : '#92400e',
                        fontSize: '14px'
                    }}>
                        {dashboardStats.isRealData ? (
                            <>
                                <strong>✅ Đã kết nối:</strong> Đang sử dụng dữ liệu thực từ StatisticsController backend APIs
                            </>
                        ) : (
                            <>
                                <strong>⚠️ Chế độ fallback:</strong> StatisticsController APIs trả về lỗi 401 (Unauthorized).
                                Đang sử dụng dữ liệu mẫu. Cần cấu hình authentication cho StatisticsController ở backend.
                                <br />
                                <small>Lý do: {dashboardStats.fallbackReason}</small>
                            </>
                        )}
                    </div>
                )} */}

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
                        {/* 
                        📊 VIEW TRACKING SYSTEM:
                        - Số lượt xem tự động tăng khi người dùng truy cập /response/{surveyId}
                        - PublicResponsePage.jsx gọi incrementViewCount() qua /surveys/{id}/public endpoint  
                        - Backend SurveyController.getSurveyPublic() tự động track view với IP + User Agent
                        - StatisticsController.getSurveyOverview() trả về viewership count mới nhất
                        - Sử dụng "+1 View" button để test hoặc "Refresh" để cập nhật
                        */}
                        <div className="recent-list">
                            {recentActivities.map((item, idx) => (
                                <RecentItem key={idx} {...item} />
                            ))}
                        </div>
                    </div>

                    <div className="panel right">
                        <h3>Thống kê nhanh</h3>
                        <div className="quick-stats">
                            {questionCounts.loading ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                    Đang tải thống kê...
                                </div>
                            ) : (
                                <>
                                    {/* Luôn hiển thị tất cả các loại câu hỏi */}
                                    {/* Nếu có dữ liệu từ API thì dùng, nếu không thì hiển thị 0 cho tất cả */}
                                    {questionCounts.data && questionCounts.data.byType ? (
                                        renderQuestionStats(
                                            questionCounts.data.byType,
                                            questionCounts.data.total || 0
                                        )
                                    ) : isFromCreateSurvey && surveyStats.totalQuestions > 0 ? (
                                        // Fallback cho chế độ tạo survey mới với dữ liệu từ surveyStats
                                        renderQuestionStats({
                                            'multiple_choice': surveyStats.multipleChoice || 0,
                                            'single_choice': surveyStats.singleChoice || 0,
                                            'open_ended': surveyStats.openEnded || 0,
                                            'rating': surveyStats.rating || 0,
                                            'boolean': surveyStats.boolean || 0,
                                            'ranking': surveyStats.ranking || 0,
                                            'file_upload': surveyStats.fileUpload || 0,
                                            'date_time': surveyStats.dateTime || 0
                                        }, surveyStats.totalQuestions)
                                    ) : (
                                        // Không có dữ liệu: hiển thị tất cả với giá trị 0
                                        renderQuestionStats({}, 0)
                                    )}
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
                    {/* <button className="btn blue" onClick={() => navigate('/report/details-statistic', {
                        state: surveyId ? { surveyId, surveyTitle, surveyDescription } : undefined
                    })}>
                        <span className="btn-icon" aria-hidden="true"><i className="fa-solid fa-chart-bar"></i></span>
                        Xem thống kê chi tiết
                    </button>
                    <button className="btn green" onClick={() => navigate('/report/individual-responses', {
                        state: surveyId ? { surveyId, surveyTitle, surveyDescription } : undefined
                    })}>
                        <span className="btn-icon" aria-hidden="true"><i className="fa-solid fa-brain"></i></span>
                        Danh sách phản hồi
                    </button>
                    <button className="btn teal" onClick={() => navigate('/report/sentiment', {
                        state: surveyId ? { surveyId, surveyTitle, surveyDescription } : undefined
                    })}>
                        <span className="btn-icon" aria-hidden="true">😊</span>
                        Phân tích cảm xúc
                    </button> */}

                </section>
            </div>

            {/* AI Chat Button - Hiển thị khi có surveyId */}
            {surveyId && (
                <>
                    {!showAIChat && (
                        <AIChatButton
                            onClick={() => setShowAIChat(true)}
                            surveyId={surveyId}
                        />
                    )}
                    {showAIChat && (
                        <AIChat
                            surveyId={surveyId}
                            surveyTitle={surveyTitle}
                            surveyDescription={surveyDescription}
                            onClose={() => setShowAIChat(false)}
                            isOpen={showAIChat}
                        />
                    )}
                </>
            )}
        </MainLayout>
    );
}