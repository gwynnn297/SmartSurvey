import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    ResponsiveContainer,
} from "recharts";

const RatingChart = ({ data }) => {
    if (!data || !data.distribution) {
        return (
            <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                Chưa có dữ liệu
            </div>
        );
    }

    // Convert distribution map to array và lọc bỏ các rating có count = 0
    const distributionData = Object.entries(data.distribution)
        .filter(([rating, count]) => (count || 0) > 0) // Lọc bỏ count = 0
        .map(([rating, count]) => ({
            rating: `${rating} sao`,
            count: count,
            ratingNum: parseInt(rating),
        }))
        .sort((a, b) => a.ratingNum - b.ratingNum); // Giữ nguyên cho bar chart (1→5)

    // Tạo dữ liệu riêng cho bảng, sắp xếp từ cao xuống thấp (5→1)
    const tableData = [...distributionData].sort((a, b) => b.ratingNum - a.ratingNum);

    // Nếu sau khi lọc không còn dữ liệu
    if (distributionData.length === 0) {
        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title">{data.questionText}</h4>
                <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                    Chưa có phản hồi nào
                </div>
            </div>
        );
    }

    const total = distributionData.reduce((sum, d) => sum + d.count, 0);
    const averageRating = data.averageRating || 0;

    // Render stars
    const renderStars = (rating) => {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        return (
            <div style={{ display: "flex", gap: "2px", fontSize: "1.2rem", justifyContent: "center" }}>
                {[...Array(fullStars)].map((_, i) => (
                    <span key={i} style={{ color: "#fbbf24" }}>★</span>
                ))}
                {hasHalfStar && <span style={{ color: "#fbbf24" }}>☆</span>}
                {[...Array(emptyStars)].map((_, i) => (
                    <span key={i} style={{ color: "#d1d5db" }}>★</span>
                ))}
            </div>
        );
    };

    return (
        <div className="question-chart-wrapper">
            <h4 className="question-title">{data.questionText}</h4>

            {/* Average Rating Display */}
            <div className="rating-average-box">
                <div className="rating-average-value">{averageRating.toFixed(1)}</div>
                <div className="rating-average-stars">{renderStars(averageRating)}</div>
                <p className="rating-average-label">Đánh giá trung bình</p>
            </div>

            {/* Distribution Bar Chart */}
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distributionData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                    <XAxis dataKey="rating" />
                    <YAxis />
                    <Tooltip
                        formatter={(value) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, "Số lượng"]}
                    />
                    <Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]}>
                        {distributionData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.ratingNum >= 4 ? "#10b981" : entry.ratingNum >= 3 ? "#fbbf24" : "#ef4444"}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            {/* Bảng thống kê chi tiết */}
            <div className="ranking-summary-table">
                <h5 className="chart-subtitle">Bảng thống kê chi tiết</h5>
                <table className="ranking-table">
                    <thead>
                        <tr>
                            <th>Đánh giá</th>
                            <th>Số lượng</th>
                            <th>Tỷ lệ (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((item, index) => {
                            const percentage = total > 0 ? (item.count / total) * 100 : 0;
                            return (
                                <tr key={index}>
                                    <td className="option-name">
                                        <strong>{item.rating}</strong>
                                    </td>
                                    <td><strong>{item.count}</strong></td>
                                    <td className="weighted-score">
                                        <strong>{percentage.toFixed(2)}%</strong>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="chart-stats">
                <p>Tổng: <strong>{total}</strong> phản hồi</p>
                <p>Đánh giá trung bình: <strong>{averageRating.toFixed(2)}</strong> / 5.0</p>
            </div>

        </div>
    );
};

export default RatingChart;