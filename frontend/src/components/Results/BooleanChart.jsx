import React from "react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

const COLORS = ["#10b981", "#ef4444"];

const BooleanChart = ({ data }) => {
    if (!data) {
        return (
            <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                Chưa có dữ liệu
            </div>
        );
    }

    const trueCount = data.trueCount || 0;
    const falseCount = data.falseCount || 0;
    const truePercentage = data.truePercentage || 0;
    const falsePercentage = 100 - truePercentage;

    // Lọc bỏ các giá trị = 0 và sắp xếp từ cao xuống thấp
    const chartData = [];
    if (trueCount > 0) {
        chartData.push({
            name: "Có / Đúng",
            value: trueCount,
            percentage: truePercentage
        });
    }
    if (falseCount > 0) {
        chartData.push({
            name: "Không / Sai",
            value: falseCount,
            percentage: falsePercentage
        });
    }

    // Sắp xếp từ cao xuống thấp theo percentage
    chartData.sort((a, b) => b.percentage - a.percentage);

    const total = trueCount + falseCount;

    // Nếu không có dữ liệu nào
    if (chartData.length === 0 || total === 0) {
        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title">{data.questionText}</h4>
                <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                    Chưa có phản hồi nào
                </div>
            </div>
        );
    }

    // Nếu chỉ có 1 giá trị, hiển thị thông báo đặc biệt
    if (chartData.length === 1) {
        const singleItem = chartData[0];
        const color = singleItem.name === "Có / Đúng" ? COLORS[0] : COLORS[1];

        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title">{data.questionText}</h4>

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
                            <Cell fill={color} />
                        </Pie>
                        <Tooltip formatter={(value) => `${value} (${((value / total) * 100).toFixed(1)}%)`} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>

                <div className="chart-stats">
                    <div style={{ display: "flex", gap: "2rem", justifyContent: "center", marginTop: "0.5rem" }}>
                        {trueCount > 0 && (
                            <div>
                                <span style={{ color: COLORS[0], fontWeight: "bold" }}>Có/Đúng: </span>
                                <strong>{trueCount}</strong> ({truePercentage.toFixed(1)}%)
                            </div>
                        )}
                        {falseCount > 0 && (
                            <div>
                                <span style={{ color: COLORS[1], fontWeight: "bold" }}>Không/Sai: </span>
                                <strong>{falseCount}</strong> ({falsePercentage.toFixed(1)}%)
                            </div>
                        )}
                    </div>
                    <p style={{ marginTop: "0.5rem" }}>Tổng: <strong>{total}</strong> phản hồi</p>
                    {/* Bảng thống kê chi tiết */}
                    <div className="ranking-summary-table">
                        <h5 className="chart-subtitle">Bảng thống kê chi tiết</h5>
                        <table className="ranking-table">
                            <thead>
                                <tr>
                                    <th>Lựa chọn</th>
                                    <th>Số lượng</th>
                                    <th>Tỷ lệ (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chartData.map((item, index) => (
                                    <tr key={index}>
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
                        <p>Tổng: <strong>{total}</strong> phản hồi</p>
                    </div>
                </div>
            </div>
        );
    }

    // Hiển thị bình thường nếu có cả 2 giá trị
    return (
        <div className="question-chart-wrapper">
            <h4 className="question-title">{data.questionText}</h4>

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
                        {chartData.map((entry, index) => {
                            const color = entry.name === "Có / Đúng" ? COLORS[0] : COLORS[1];
                            return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} (${((value / total) * 100).toFixed(1)}%)`} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>

            <div className="chart-stats">
                <div style={{ display: "flex", gap: "2rem", justifyContent: "center", marginTop: "0.5rem" }}>
                    {trueCount > 0 && (
                        <div>
                            <span style={{ color: COLORS[0], fontWeight: "bold" }}>Có/Đúng: </span>
                            <strong>{trueCount}</strong> ({truePercentage.toFixed(1)}%)
                        </div>
                    )}
                    {falseCount > 0 && (
                        <div>
                            <span style={{ color: COLORS[1], fontWeight: "bold" }}>Không/Sai: </span>
                            <strong>{falseCount}</strong> ({falsePercentage.toFixed(1)}%)
                        </div>
                    )}
                </div>
                <p style={{ marginTop: "0.5rem" }}>Tổng: <strong>{total}</strong> phản hồi</p>
            </div>
            {/* Bảng thống kê chi tiết */}
            <div className="ranking-summary-table">
                <h5 className="chart-subtitle">Bảng thống kê chi tiết</h5>
                <table className="ranking-table">
                    <thead>
                        <tr>
                            <th>Lựa chọn</th>
                            <th>Số lượng</th>
                            <th>Tỷ lệ (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chartData.map((item, index) => (
                            <tr key={index}>
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
                <p>Tổng: <strong>{total}</strong> phản hồi</p>
            </div>
        </div>
    );
};

export default BooleanChart;