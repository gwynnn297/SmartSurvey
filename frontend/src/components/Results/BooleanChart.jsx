import React from "react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

const NEON_PALETTE = [
    "#00F0FF",  
    "#7B2FF7",  
    "#FF2E63",  
    "#FF8F00",  
    "#38FF7A",  
    "#FF00F5",  
    "#00FF9F",  
    "#FFD500",  
    "#3A0CA3", 
    "#7209B7",  
];

const COLORS = [NEON_PALETTE[0], NEON_PALETTE[1]]; 

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
            name: "Có ",
            value: trueCount,
            percentage: truePercentage
        });
    }
    if (falseCount > 0) {
        chartData.push({
            name: "Không ",
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
                <h4 className="question-title"> Câu hỏi : {data.questionText}</h4>
                <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                    Chưa có phản hồi nào
                </div>
            </div>
        );
    }

    // Nếu chỉ có 1 giá trị, hiển thị thông báo đặc biệt
    if (chartData.length === 1) {
        const singleItem = chartData[0];
      
        const color = NEON_PALETTE[0];

        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title">Câu hỏi : {data.questionText}</h4>

                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ percentage }) => ` ${percentage.toFixed(1)}%`}
                        >
                            <Cell fill={color} />
                        </Pie>
                        <Tooltip formatter={(value) => `${value} (${((value / total) * 100).toFixed(1)}%)`} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>

                <div className="chart-stats">



                    <p style={{ marginTop: "0.5rem" }}>Tổng: <strong>{total}</strong> phản hồi</p>
                </div>
            </div>
        );
    }

    // Hiển thị bình thường nếu có cả 2 giá trị
    return (
        <div className="question-chart-wrapper">
            <h4 className="question-title">Câu hỏi :{data.questionText}</h4>

            <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ percentage }) => ` ${percentage.toFixed(1)}%`}
                    >
                        {chartData.map((entry, index) => {

                            const color = index === 0 ? NEON_PALETTE[0] : NEON_PALETTE[1];
                            return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} (${((value / total) * 100).toFixed(1)}%)`} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>

            <div className="chart-stats">

                <p style={{ marginTop: "0.5rem" }}>Tổng: <strong>{total}</strong> phản hồi</p>
            </div>
        </div>
    );
};

export default BooleanChart;