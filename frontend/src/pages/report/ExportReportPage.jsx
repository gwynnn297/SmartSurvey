import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import { exportReportService } from "../../services/exportReportService";
import { surveyService } from "../../services/surveyService";
import { dashboardReportService } from "../../services/dashboardReportService";
import { teamManagementService } from "../../services/teamManagementService";
import AIChat, { AIChatButton } from "../../components/AIChat";
import "./ExportReportPage.css";

const ExportReportPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showAIChat, setShowAIChat] = useState(false);

    // Lấy surveyId từ location.state
    const surveyData = location.state || {};
    const { surveyId, surveyTitle, surveyDescription } = surveyData;

    const [selectedFormat, setSelectedFormat] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [surveyInfo, setSurveyInfo] = useState(null);
    const [includeAnswers, setIncludeAnswers] = useState(true);
    const [exportHistory, setExportHistory] = useState([]);
    const [previewStats, setPreviewStats] = useState({
        totalResponses: 0,
        totalViews: 0,
        completionRate: 0,
        loading: true
    });

    // Kiểm tra quyền xem trang xuất báo cáo (Chỉ OWNER và ANALYST)
    useEffect(() => {
        const checkPermission = async () => {
            if (!surveyId) return;
            try {
                // Gọi API overview để mượn logic phân quyền của backend (StatisticsService)
                await dashboardReportService.getSurveyOverview(surveyId);
            } catch (err) {
                if (err.response?.status === 403) {
                    alert('Bạn không có quyền xuất báo cáo. Chỉ OWNER và ANALYST mới có quyền.');
                    navigate('/dashboard');
                }
            }
        };
        checkPermission();
    }, [surveyId, navigate]);

    // Load survey info và lịch sử xuất khi có surveyId
    useEffect(() => {
        const loadSurveyInfo = async () => {
            if (!surveyId) return;

            try {
                const survey = await surveyService.getSurveyById(surveyId);
                setSurveyInfo({
                    id: survey.id || survey.surveyId,
                    title: survey.title || surveyTitle || 'Khảo sát',
                    description: survey.description || surveyDescription || ''
                });
            } catch (error) {
                console.error('Error loading survey info:', error);
                setError('Không thể tải thông tin khảo sát');
            }
        };

        loadSurveyInfo();

        // Load lịch sử xuất báo cáo từ localStorage
        const loadExportHistory = () => {
            try {
                const historyKey = `export_history_${surveyId}`;
                const stored = localStorage.getItem(historyKey);
                if (stored) {
                    const history = JSON.parse(stored);
                    // Sắp xếp theo thời gian mới nhất trước
                    const sortedHistory = history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    setExportHistory(sortedHistory);
                } else {
                    setExportHistory([]);
                }
            } catch (error) {
                console.error('Error loading export history:', error);
                setExportHistory([]);
            }
        };

        loadExportHistory();
    }, [surveyId, surveyTitle, surveyDescription]);

    // Load preview stats
    useEffect(() => {
        const loadPreviewStats = async () => {
            if (!surveyId) return;

            setPreviewStats(prev => ({ ...prev, loading: true }));

            try {
                // Thử lấy từ dashboard overview API
                const overviewData = await dashboardReportService.getSurveyOverview(surveyId);

                setPreviewStats({
                    totalResponses: overviewData.totalResponses || 0,
                    totalViews: overviewData.viewership || 0,
                    completionRate: overviewData.completionRate || 0,
                    loading: false
                });
            } catch (error) {
                console.error('Error loading preview stats:', error);

                // Kiểm tra nếu là lỗi quyền truy cập
                if (error.isPermissionError || error.status === 403 ||
                    (error.message && (error.message.includes('quyền') || error.message.includes('OWNER') || error.message.includes('ANALYST')))) {
                    // Hiển thị thông báo lỗi quyền và không cho phép export
                    const permissionErrorMessage = error.message || 'Bạn không có quyền xem báo cáo. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo.';
                    setError(permissionErrorMessage);
                    setPreviewStats(prev => ({
                        ...prev,
                        loading: false
                    }));
                    return; // Không fallback nếu là lỗi quyền
                }

                // Fallback: Lấy từ listResponses để có total count (chỉ khi không phải lỗi quyền)
                try {
                    const responseData = await exportReportService.listResponses(surveyId, {
                        page: 0,
                        size: 1
                    });

                    const total = responseData.meta?.total || 0;

                    setPreviewStats({
                        totalResponses: total,
                        totalViews: 0,
                        completionRate: 0,
                        loading: false
                    });
                } catch (fallbackError) {
                    console.error('Error loading preview stats fallback:', fallbackError);
                    setPreviewStats(prev => ({
                        ...prev,
                        loading: false
                    }));
                }
            }
        };

        loadPreviewStats();
    }, [surveyId]);

    // Formats được hỗ trợ bởi backend API
    const formats = [
        {
            id: "pdf",
            title: "PDF",
            description: "Báo cáo tổng hợp với biểu đồ và thống kê",
            details: ["Báo cáo chuyên nghiệp", "Kèm biểu đồ trực quan", "Dễ chia sẻ và in ấn"],
            color: "#fef3c7",
            icon: <i className="fa-solid fa-file-pdf" style={{ fontSize: '48px', color: '#d97706' }}></i>,
        },
        {
            id: "excel",
            title: "Excel",
            description: "Dữ liệu chi tiết, phù hợp phân tích nâng cao",
            details: ["Có thể chỉnh sửa", "Hỗ trợ xuất biểu mẫu", "Phân tích tiện lợi"],
            color: "#dcfce7",
            icon: <i className="fa-solid fa-file-excel" style={{ fontSize: '48px', color: '#16a34a' }}></i>,
        },
        {
            id: "csv",
            title: "CSV",
            description: "Dữ liệu thô, tương thích mọi phần mềm",
            details: ["Dạng bảng mở rộng", "Dễ tích hợp hệ thống", "Dùng import/export"],
            color: "#dbeafe",
            icon: <i className="fa-solid fa-chart-line" style={{ fontSize: '48px', color: '#2563eb' }}></i>,
        },
    ];

    // Format thời gian
    const formatDateTime = (dateTimeString) => {
        try {
            const date = new Date(dateTimeString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${day}/${month}/${year} – ${hours}:${minutes}`;
        } catch (error) {
            return dateTimeString;
        }
    };

    // Lấy icon và tên format
    const getFormatDisplay = (format) => {
        const formatMap = {
            'pdf': { icon: <i className="fa-solid fa-file-pdf"></i>, name: 'Báo cáo PDF' },
            'excel': { icon: <i className="fa-solid fa-file-excel"></i>, name: 'Dữ liệu Excel' },
            'csv': { icon: <i className="fa-solid fa-file-csv"></i>, name: 'Raw Data CSV' }
        };
        return formatMap[format] || { icon: <i className="fa-solid fa-file"></i>, name: `Báo cáo ${format.toUpperCase()}` };
    };

    // Xử lý xuất báo cáo
    const handleExport = async () => {
        if (!selectedFormat || !surveyId) {
            setError('Vui lòng chọn định dạng xuất báo cáo');
            return;
        }

        // Kiểm tra quyền trước khi export
        if (error && (error.includes('quyền') || error.includes('OWNER') || error.includes('ANALYST'))) {
            setError('Bạn không có quyền xuất báo cáo. Chỉ chủ sở hữu (OWNER) và phân tích viên (ANALYST) mới có quyền xem báo cáo.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // PDF sử dụng API riêng (exportAndDownloadPDF)
            if (selectedFormat === 'pdf') {
                await exportReportService.exportAndDownloadPDF(surveyId);
            } else {
                // CSV và Excel sử dụng exportAndDownload với options
                await exportReportService.exportAndDownload(surveyId, {
                    format: selectedFormat,
                    includeAnswers: includeAnswers,
                    filter: {
                        // Có thể thêm filters ở đây nếu cần
                        sort: 'submittedAt,desc'
                    }
                });
            }

            // Success - file sẽ tự động download
            console.log('✅ Xuất báo cáo thành công');

            // Tạo tên file
            const getFileName = () => {
                if (selectedFormat === 'pdf') {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');
                    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
                    return `survey_report_${surveyId}_${timestamp}.pdf`;
                } else {
                    const extension = selectedFormat === 'excel' ? 'xlsx' : 'csv';
                    return `survey-${surveyId}-responses-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.${extension}`;
                }
            };

            // Lưu vào lịch sử
            const exportRecord = {
                id: Date.now().toString(),
                surveyId: surveyId,
                surveyTitle: surveyInfo?.title || surveyTitle || 'Khảo sát',
                format: selectedFormat,
                includeAnswers: selectedFormat === 'pdf' ? undefined : includeAnswers, // PDF không có includeAnswers
                timestamp: new Date().toISOString(),
                fileName: getFileName()
            };

            // Lưu vào localStorage
            try {
                const historyKey = `export_history_${surveyId}`;
                const existingHistory = localStorage.getItem(historyKey);
                let history = existingHistory ? JSON.parse(existingHistory) : [];

                // Thêm record mới vào đầu danh sách
                history.unshift(exportRecord);

                // Giới hạn tối đa 20 records gần nhất
                if (history.length > 20) {
                    history = history.slice(0, 20);
                }

                localStorage.setItem(historyKey, JSON.stringify(history));
                setExportHistory(history);
            } catch (storageError) {
                console.error('Error saving export history:', storageError);
            }
        } catch (error) {
            console.error('❌ Lỗi khi xuất báo cáo:', error);

            // Xử lý lỗi đặc biệt cho PDF (403 permission error)
            let errorMessage = 'Không thể xuất báo cáo: ';
            if (error.status === 403) {
                errorMessage += error.message || 'Bạn không có quyền xuất báo cáo PDF. Chỉ OWNER và ANALYST mới có quyền.';
            } else {
                errorMessage += error.response?.data?.message || error.message || 'Đã xảy ra lỗi không xác định';
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Tải lại báo cáo đã xuất trước đó
    const handleReExport = async (historyItem) => {
        if (!historyItem || !surveyId) return;

        setLoading(true);
        setError(null);

        try {
            // PDF sử dụng API riêng
            if (historyItem.format === 'pdf') {
                await exportReportService.exportAndDownloadPDF(surveyId);
            } else {
                // CSV và Excel sử dụng exportAndDownload với options
                await exportReportService.exportAndDownload(surveyId, {
                    format: historyItem.format,
                    includeAnswers: historyItem.includeAnswers !== undefined ? historyItem.includeAnswers : true,
                    filter: {
                        sort: 'submittedAt,desc'
                    }
                });
            }

            console.log('✅ Tải lại báo cáo thành công');

            // Cập nhật timestamp trong lịch sử
            const updatedHistory = exportHistory.map(item =>
                item.id === historyItem.id
                    ? { ...item, timestamp: new Date().toISOString() }
                    : item
            );

            try {
                const historyKey = `export_history_${surveyId}`;
                localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
                setExportHistory(updatedHistory);
            } catch (storageError) {
                console.error('Error updating export history:', storageError);
            }
        } catch (error) {
            console.error('❌ Lỗi khi tải lại báo cáo:', error);

            // Xử lý lỗi đặc biệt cho PDF
            let errorMessage = 'Không thể tải lại báo cáo: ';
            if (error.status === 403) {
                errorMessage += error.message || 'Bạn không có quyền xuất báo cáo PDF. Chỉ OWNER và ANALYST mới có quyền.';
            } else {
                errorMessage += error.response?.data?.message || error.message || 'Đã xảy ra lỗi không xác định';
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (!surveyId) {
        return (
            <MainLayout>
                <div className="export-container">
                    {/* <div style={{ padding: '40px', textAlign: 'center' }}>
                        <p>Vui lòng chọn khảo sát để xuất báo cáo.</p>
                        <button
                            onClick={() => navigate('/report')}
                            style={{
                                marginTop: '20px',
                                padding: '10px 20px',
                                background: '#6366f1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Quay lại trang báo cáo
                        </button>
                    </div> */}
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="export-container">
                {/* HEADER */}
                <div className="export-header">
                    <h1>Xuất báo cáo khảo sát</h1>
                    <p>{surveyInfo?.title || surveyTitle || 'Chọn định dạng để tải xuống báo cáo đầy đủ kết quả khảo sát'}</p>
                    {error && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: '#fee2e2',
                            border: '1px solid #ef4444',
                            borderRadius: '8px',
                            color: '#991b1b'
                        }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* CHỌN ĐỊNH DẠNG */}
                <h2 className="section-title"><i className="fa-solid fa-box" style={{ marginRight: '8px' }}></i> Chọn định dạng xuất báo cáo</h2>
                <div className="format-grid">
                    {formats.map((f) => (
                        <div
                            key={f.id}
                            className={`format-card ${selectedFormat === f.id ? "selected" : ""}`}
                            style={{ background: f.color }}
                            onClick={() => setSelectedFormat(f.id)}
                        >
                            <div className="icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.description}</p>
                            <ul>
                                {f.details.map((d, i) => (
                                    <li key={i}>
                                        <span style={{ marginRight: '8px' }}><i className="fa-solid fa-check"></i></span> {d}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* NỘI DUNG DƯỚI */}
                <div className="report-section">
                    {/* Xem trước báo cáo */}
                    <div className="preview-card">
                        <h3>Xem trước báo cáo</h3>
                        <div className="preview-content">
                            <div className="preview-stats">
                                <h4>{surveyInfo?.title || surveyTitle || 'Khảo sát'}</h4>
                                <p className="date">Ngày: {new Date().toLocaleDateString('vi-VN')}</p>
                                <div className="summary">
                                    {previewStats.loading ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                                            Đang tải dữ liệu...
                                        </div>
                                    ) : (
                                        <>
                                            {/* <span className="count">{previewStats.totalResponses} phản hồi</span> */}
                                            <span className="label">Tổng phản hồi: {previewStats.totalResponses}</span>
                                            {previewStats.totalViews > 0 && (
                                                <div style={{

                                                    fontSize: '13px',
                                                    color: '#6b7280'
                                                }}>
                                                    <i className="fa-solid fa-eye" style={{ marginRight: '4px' }}></i> {previewStats.totalViews} lượt xem
                                                </div>
                                            )}
                                            {previewStats.completionRate > 0 && (
                                                <div style={{
                                                    marginTop: '4px',
                                                    fontSize: '13px',
                                                    color: '#16a34a',
                                                    fontWeight: 500
                                                }}>
                                                    <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> Tỷ lệ hoàn thành: {previewStats.completionRate.toFixed(1)}%
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div className="preview-options">
                                    {/* PDF không có option includeAnswers vì nó là báo cáo tổng hợp với biểu đồ */}
                                    {selectedFormat !== 'pdf' && (
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={includeAnswers}
                                                onChange={(e) => setIncludeAnswers(e.target.checked)}
                                            />
                                            Bao gồm câu trả lời chi tiết
                                        </label>
                                    )}
                                    {selectedFormat === 'pdf' && (
                                        <div style={{
                                            padding: '8px 12px',
                                            background: '#fffbeb',
                                            border: '1px solid #fbbf24',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            color: '#92400e'
                                        }}>
                                            <i className="fa-solid fa-file-pdf" style={{ marginRight: '6px' }}></i> Báo cáo PDF bao gồm biểu đồ và thống kê tổng hợp
                                        </div>
                                    )}
                                </div>
                                {!previewStats.loading && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '8px 12px',
                                        background: '#f0f9ff',
                                        border: '1px solid #0ea5e9',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        color: '#0369a1'
                                    }}>
                                        <i className="fa-solid fa-chart-bar" style={{ marginRight: '8px' }}></i> Báo cáo sẽ chứa {previewStats.totalResponses} phản hồi
                                        {selectedFormat === 'pdf'
                                            ? ' với biểu đồ và thống kê tổng hợp'
                                            : (includeAnswers ? ' với câu trả lời chi tiết' : '')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Lịch sử xuất báo cáo */}
                    <div className="history-card">
                        <h3>Lịch sử xuất báo cáo</h3>
                        {exportHistory.length === 0 ? (
                            <div style={{
                                padding: '20px',
                                textAlign: 'center',
                                color: '#6b7280',
                                fontSize: '14px'
                            }}>
                                Chưa có lịch sử xuất báo cáo
                            </div>
                        ) : (
                            <>
                                <div className="history-list">
                                    {exportHistory.map((item) => {
                                        const formatDisplay = getFormatDisplay(item.format);
                                        return (
                                            <div key={item.id} className="history-item">
                                                <div>
                                                    <b>{formatDisplay.icon} {formatDisplay.name}</b>
                                                    <p>{formatDateTime(item.timestamp)}</p>
                                                    {item.includeAnswers !== undefined && (
                                                        <p style={{
                                                            fontSize: '12px',
                                                            color: '#9ca3af',
                                                            marginTop: '4px'
                                                        }}>
                                                            {item.includeAnswers ? 'Có câu trả lời chi tiết' : 'Không có câu trả lời'}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    className="download-link-btn"
                                                    onClick={() => handleReExport(item)}
                                                    disabled={loading}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#4f46e5',
                                                        fontWeight: 500,
                                                        cursor: loading ? 'not-allowed' : 'pointer',
                                                        fontSize: '14px',
                                                        opacity: loading ? 0.5 : 1
                                                    }}
                                                >
                                                    Tải lại
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="note">📦 Lịch sử được lưu tối đa 20 bản ghi gần nhất</p>
                            </>
                        )}
                    </div>
                </div>

                {/* TẢI XUỐNG */}
                <div className="export-footer">
                    <h3><i className="fa-solid fa-rocket" style={{ marginRight: '8px' }}></i> Sẵn sàng xuất báo cáo</h3>
                    <p>{selectedFormat ? `Đã chọn định dạng: ${formats.find(f => f.id === selectedFormat)?.title}` : 'Vui lòng chọn định dạng báo cáo ở trên'}</p>
                    <button
                        className="btn-download"
                        disabled={!selectedFormat || loading || (error && (error.includes('quyền') || error.includes('OWNER') || error.includes('ANALYST')))}
                        onClick={handleExport}
                    >
                        {loading ? 'Đang xuất...' : 'Tải xuống ngay'}
                    </button>
                    {error && (error.includes('quyền') || error.includes('OWNER') || error.includes('ANALYST')) && (
                        <p style={{
                            marginTop: '12px',
                            padding: '8px 12px',
                            background: '#fee2e2',
                            border: '1px solid #ef4444',
                            borderRadius: '6px',
                            color: '#991b1b',
                            fontSize: '14px'
                        }}>
                            ⚠️ Bạn không có quyền xuất báo cáo này
                        </p>
                    )}
                </div>
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
};

export default ExportReportPage;
