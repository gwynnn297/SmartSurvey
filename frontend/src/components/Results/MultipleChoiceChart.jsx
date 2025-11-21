import React from "react";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

const COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

const MultipleChoiceChart = ({ data }) => {
    if (!data || !data.chartData || data.chartData.length === 0) {
        return (
            <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                Chưa có dữ liệu
            </div>
        );
    }

    // 1️⃣ Lọc các option count = 0
    const filtered = data.chartData.filter((item) => item.count > 0);

    if (filtered.length === 0) {
        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title">{data.questionText}</h4>
                <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                    Chưa có phản hồi nào
                </div>
            </div>
        );
    }

    // 2️⃣ Tính tổng số lượt chọn → để phần trăm = 100%
    const total = filtered.reduce((sum, item) => sum + item.count, 0);

        // 3️⃣ Tự tính lại phần trăm mới và sắp xếp từ cao xuống thấp
        const chartData = filtered
        .map((item) => ({
            name: item.option,
            value: item.count,
            percentage: total > 0 ? (item.count / total) * 100 : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage); // Sắp xếp từ cao xuống thấp
    const isPie = data.chartType === "pie" || !data.chartType;

    return (
        <div className="question-chart-wrapper">
            <h4 className="question-title">{data.questionText}</h4>

            {isPie ? (
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value) =>
                            [`${value} (${((value / total) * 100).toFixed(1)}%)`, "Số lượt chọn"]
                        } />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={90} />
                        <Tooltip formatter={(value) =>
                            [`${value} (${((value / total) * 100).toFixed(1)}%)`, "Số lượt chọn"]
                        } />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
            {/* Bảng thống kê chi tiết */}
            <div className="ranking-summary-table">
                <h5 className="chart-subtitle">Bảng thống kê chi tiết</h5>
                <table className="ranking-table">
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Option</th>
                            <th>Số lượt chọn</th>
                            <th>Tỷ lệ (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chartData.map((item, index) => (
                            <tr key={index}>
                                <td className="rank-position">
                                    <strong>{index + 1}</strong>
                                </td>
                                <td className="option-name">{item.name}</td>
                                <td><strong>{item.value}</strong></td>
                                <td className="weighted-score">
                                    <strong>{item.percentage.toFixed(2)}%</strong>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="chart-stats">
                <p>Tổng: <strong>{total}</strong> lượt chọn</p>
            </div>
        </div>
    );
};

export default MultipleChoiceChart;
