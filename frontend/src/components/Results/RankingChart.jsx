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

const COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

const RankingChart = ({ data, surveyId }) => {
    if (!data || !data.chartData || data.chartData.length === 0) {
        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title">{data?.questionText || 'Câu hỏi xếp hạng'}</h4>
                <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                    Chưa có dữ liệu ranking
                </div>
            </div>
        );
    }

    // Backend đã tính toán và sắp xếp sẵn theo thứ tự ưu tiên (cao nhất = ưu tiên nhất)
    const chartData = data.chartData
        .filter(item => (item.count || 0) > 0)
        .map((item, index) => ({
            name: item.option,
            value: item.percentage, // Điểm ưu tiên (%)
            count: item.count, // Số lần được xếp hạng
            rank: index + 1 // Vị trí trong danh sách (1 = ưu tiên nhất)
        }));

    if (chartData.length === 0) {
        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title">{data.questionText}</h4>
                <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                    Chưa có phản hồi nào
                </div>
            </div>
        );
    }

    // Tính tổng số responses
    const totalResponses = chartData[0]?.count || 0;

    return (
        <div className="question-chart-wrapper">
            <h4 className="question-title">{data.questionText}</h4>

            {/* Bar Chart - Xếp hạng ưu tiên */}
            <div className="ranking-chart-container">
                <ResponsiveContainer width="100%" height="100%">

                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 10, right: 30, top: 20, bottom: 50 }}
                    >
                        <XAxis
                            type="number"
                            domain={[0, 'dataMax']}
                            label={{
                                value: 'Điểm ưu tiên (%)',
                                position: 'bottom',
                                offset: 15,
                                style: {
                                    textAnchor: 'middle',
                                    fontSize: '13px',
                                    fill: '#6b7280',
                                    fontWeight: '500'
                                }
                            }}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={100}
                            tick={{ fontSize: 13 }}
                            tickMargin={5}
                        />
                        <Tooltip
                            formatter={(value) => [`${value.toFixed(2)}%`, 'Điểm ưu tiên']}
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                padding: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => {
                                // Màu sắc: điểm cao (tốt) = xanh lá, điểm thấp = đỏ
                                const maxScore = Math.max(...chartData.map(d => d.value));
                                const scoreRatio = entry.value / maxScore;
                                const color = scoreRatio >= 0.7
                                    ? "#10b981"  // Xanh lá - Ưu tiên cao
                                    : scoreRatio >= 0.4
                                        ? "#fbbf24"  // Vàng - Ưu tiên trung bình
                                        : "#ef4444"; // Đỏ - Ưu tiên thấp

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
            </div>

            {/* Bảng thống kê chi tiết */}
            <div className="ranking-summary-table">
                <h5 className="chart-subtitle">Bảng thống kê chi tiết</h5>
                <table className="ranking-table">
                    <thead>
                        <tr>
                            <th>Xếp hạng</th>
                            <th>Option</th>
                            <th>Số lượt chọn</th>
                            <th>Điểm ưu tiên (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chartData.map((item, index) => {
                            // item.value đã là weighted score percentage từ backend
                            return (
                                <tr key={index}>
                                    <td className="rank-position">
                                        <strong>#{item.rank}</strong>
                                    </td>
                                    <td className="option-name">{item.name}</td>
                                    <td><strong>{item.count}</strong></td>
                                    <td className="weighted-score">
                                        <strong>{item.value.toFixed(2)}%</strong>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="chart-stats">
                <p>Tổng: <strong>{totalResponses}</strong> phản hồi</p>
            </div>
        </div>
    );
};

export default RankingChart;