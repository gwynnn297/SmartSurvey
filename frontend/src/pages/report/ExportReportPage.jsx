import React, { useState } from "react";
import MainLayout from "../../layouts/MainLayout";
import "./ExportReportPage.css";

const ExportReportPage = () => {
    const [selectedFormat, setSelectedFormat] = useState(null);

    const formats = [
        {
            id: "pdf",
            title: "PDF",
            description: "Báo cáo trực quan với biểu đồ, dễ in ấn và chia sẻ",
            details: ["Dễ đọc và chia sẻ", "Gọn gàng chuyên nghiệp", "Phù hợp chia sẻ"],
            color: "#fee2e2",
            icon: <div style={{ fontSize: '48px', color: '#ef4444' }}>📄</div>,
        },
        {
            id: "excel",
            title: "Excel",
            description: "Dữ liệu chi tiết, phù hợp phân tích nâng cao",
            details: ["Có thể chỉnh sửa", "Hỗ trợ xuất biểu mẫu", "Phân tích tiện lợi"],
            color: "#dcfce7",
            icon: <div style={{ fontSize: '48px', color: '#16a34a' }}>📊</div>,
        },
        {
            id: "csv",
            title: "CSV",
            description: "Dữ liệu thô, tương thích mọi phần mềm",
            details: ["Dạng bảng mở rộng", "Dễ tích hợp hệ thống", "Dùng import/export"],
            color: "#dbeafe",
            icon: <div style={{ fontSize: '48px', color: '#2563eb' }}>📈</div>,
        },
    ];

    return (
        <MainLayout>
            <div className="export-container">
                {/* HEADER */}
                <div className="export-header">
                    <h1>Xuất báo cáo khảo sát</h1>
                    <p>Chọn định dạng để tải xuống báo cáo đầy đủ kết quả khảo sát</p>
                </div>

                {/* CHỌN ĐỊNH DẠNG */}
                <h2 className="section-title">📦 Chọn định dạng xuất báo cáo</h2>
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
                                        <span style={{ marginRight: '8px' }}>✓</span> {d}
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
                                <h4>Khảo sát hài lòng dịch vụ</h4>
                                <p className="date">Ngày: 15/12/2024</p>
                                <div className="summary">
                                    <span className="count">200</span>
                                    <span className="label">Tổng phản hồi</span>
                                    <div className="chart-info">
                                        <div className="chart-circle"></div>
                                        <div className="chart-text">
                                            <p className="positive">Tích cực: 65%</p>
                                            <p className="neutral">Trung lập: 20%</p>
                                            <p className="negative">Tiêu cực: 15%</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="preview-options">
                                    <label><input type="checkbox" defaultChecked /> Bao gồm dữ liệu chi tiết</label>
                                    <label><input type="checkbox" defaultChecked /> Bao gồm biểu đồ và hình ảnh</label>
                                    <label><input type="checkbox" /> Bao gồm phản hồi mở</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lịch sử xuất */}
                    <div className="history-card">
                        <h3>Lịch sử xuất báo cáo</h3>
                        <div className="history-list">
                            <div className="history-item">
                                <div>
                                    <b>📄 Báo cáo PDF</b>
                                    <p>14/12/2024 – 10:30 AM</p>
                                </div>
                                <a href="#" className="download-link">Tải lại</a>
                            </div>
                            <div className="history-item">
                                <div>
                                    <b>📊 Dữ liệu Excel</b>
                                    <p>13/12/2024 – 3:45 PM</p>
                                </div>
                                <a href="#" className="download-link">Tải lại</a>
                            </div>
                            <div className="history-item">
                                <div>
                                    <b>🧾 Raw Data CSV</b>
                                    <p>12/12/2024 – 9:45 AM</p>
                                </div>
                                <a href="#" className="download-link">Tải lại</a>
                            </div>
                        </div>
                        <p className="note">📦 Báo cáo được lưu tối đa 30 ngày. Sau thời hạn sẽ không còn tải lại.</p>
                    </div>
                </div>

                {/* TẢI XUỐNG */}
                <div className="export-footer">
                    <h3>🚀 Sẵn sàng xuất báo cáo</h3>
                    <p>Vui lòng chọn định dạng báo cáo ở trên</p>
                    <button className="btn-download" disabled={!selectedFormat}>
                        Tải xuống ngay
                    </button>
                </div>
            </div>
        </MainLayout>
    );
};

export default ExportReportPage;
