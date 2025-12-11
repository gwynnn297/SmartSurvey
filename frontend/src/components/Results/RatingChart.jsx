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

const NEON_PALETTE = [
    "#00F0FF",  // Neon Cyan
    "#7B2FF7",  // Electric Purple
    "#FF2E63",  // Neon Pink
    "#FF8F00",  // Neon Amber
    "#38FF7A",  // Neon Green
    "#FF00F5",  // Ultra Violet Neon
    "#00FF9F",  // Neon Aqua Green
    "#FFD500",  // Neon Yellow
    "#3A0CA3",  // Deep Neon Violet
    "#7209B7",  // Cyber Grape Neon
];

const COLORS = NEON_PALETTE;

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
                <h4 className="question-title"> Câu hỏi : {data.questionText}</h4>
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
            <h4 className="question-title"> Câu hỏi : {data.questionText}</h4>

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
                    <Bar
                        dataKey="count"
                        fill={NEON_PALETTE[0]}
                        radius={[4, 4, 0, 0]}
                        label={{
                            position: 'top',
                            formatter: (value) => {
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${percentage}%`;
                            },
                            style: {
                                fontSize: '12px',
                                fill: '#374151',
                                fontWeight: '500'
                            }
                        }}
                    >
                        {distributionData.map((entry, index) => {

                            const colorIndex = (5 - entry.ratingNum) % NEON_PALETTE.length;
                            const color = NEON_PALETTE[colorIndex];

                            return (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={color}
                                />
                            );
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            <div className="chart-stats">
                <p>Tổng: <strong>{total}</strong> phản hồi</p>
            </div>

        </div>
    );
};

export default RatingChart;