import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';

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

    const recentActivities = useMemo(() => (
        [
            { color: 'green', text: 'Phản hồi mới từ Người tham gia 128', time: '2 phút trước' },
            { color: 'purple', text: 'Phản hồi mới từ Người tham gia 127', time: '5 phút trước' },
            { color: 'orange', text: 'Phản hồi mới từ Người tham gia 126', time: '9 phút trước' },
            { color: 'blue', text: 'Phản hồi mới từ Người tham gia 125', time: '12 phút trước' },
            { color: 'red', text: 'Phản hồi mới từ Người tham gia 124', time: '15 phút trước' }
        ]
    ), []);

    const handleExport = () => {
        navigate('/report/export');
    };

    return (
        <MainLayout>
            <div className="report-container">
                <header className="report-header">
                    <div className="report-header__top">
                        <div className="report-header__titles">
                            <h1>Tổng quan khảo sát</h1>
                            <p>Thống kê tổng thể về phản hồi và kết quả khảo sát của bạn</p>
                        </div>
                        <button className="export-btn" onClick={handleExport}>
                            <span className="btn-icon" aria-hidden="true">🧾</span>
                            Xuất báo cáo
                        </button>
                    </div>
                </header>

                <section className="report-metrics" aria-label="Chỉ số chính">
                    <MetricCard
                        bgClass="pink"
                        title="Tổng phản hồi"
                        value="128"
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
                        bgClass="peach"
                        title="Hoàn thành"
                        value="95%"
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
                        value="3.2m"
                        icon={(
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    />
                    <MetricCard
                        bgClass="yellow"
                        title="Đánh giá TB"
                        value="4.2/5"
                        icon={(
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 3l2.9 5.88 6.1.89-4.4 4.29 1.04 6.06L12 17.77 6.36 21.12 7.4 15.06 3 9.77l6.1-.89L12 3z" />
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
                            <ProgressItem label="Câu hỏi trắc nghiệm" valueLabel="8 câu" percent={100} colorClass="indigo" />
                            <ProgressItem label="Trả lời ngắn" valueLabel="2 câu" percent={40} colorClass="indigo" />
                            <ProgressItem label="Tỷ lệ hài lòng" valueLabel="87%" percent={87} colorClass="green" />
                            <ProgressItem label="Xếp hạng" valueLabel={"+42"} percent={70} colorClass="blue" />
                        </div>
                    </div>
                </section>

                <section className="report-actions">
                    <button className="btn blue" onClick={() => navigate('/report/details-statistic')}>
                        <span className="btn-icon" aria-hidden="true">📊</span>
                        Xem thống kê chi tiết
                    </button>
                    <button className="btn green" onClick={() => navigate('/report/open-feedback')}>
                        <span className="btn-icon" aria-hidden="true">🧠</span>
                        Phân tích phản hồi mở
                    </button>
                    <button className="btn teal" onClick={() => navigate('/report/sentiment')}>
                        <span className="btn-icon" aria-hidden="true">😊</span>
                        Phân tích cảm xúc
                    </button>
                </section>
            </div>
        </MainLayout>
    );
}
