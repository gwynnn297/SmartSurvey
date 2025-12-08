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

const MultipleChoiceChart = ({ data }) => {
    if (!data || !data.chartData || data.chartData.length === 0) {
        return (
            <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                Chưa có dữ liệu
            </div>
        );
    }

    //  Lọc các option count = 0
    const filtered = data.chartData.filter((item) => item.count > 0);

    if (filtered.length === 0) {
        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title"> Câu hỏi : {data.questionText}</h4>
                <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                    Chưa có phản hồi nào
                </div>
            </div>
        );
    }

   
    const total = filtered.reduce((sum, item) => sum + item.count, 0);

    //  Tự tính lại phần trăm mới và sắp xếp từ cao xuống thấp
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
            <h4 className="question-title"> Câu hỏi : {data.questionText}</h4>

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
                            label={({ percentage }) => `${percentage.toFixed(1)}%`}
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


            <div className="chart-stats">
                <p>Tổng: <strong>{total}</strong> lượt chọn</p>
            </div>
        </div>
    );
};

export default MultipleChoiceChart;
