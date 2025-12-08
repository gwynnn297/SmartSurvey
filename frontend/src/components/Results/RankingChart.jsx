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

const RankingChart = ({ data, surveyId }) => {
    if (!data || !data.chartData || data.chartData.length === 0) {
        return (
            <div className="question-chart-wrapper">
                <h4 className="question-title"> Câu hỏi : {data?.questionText || 'Câu hỏi xếp hạng'}</h4>
                <div style={{ padding: "1rem", textAlign: "center", color: "#666" }}>
                    Chưa có dữ liệu ranking
                </div>
            </div>
        );
    }

  
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
                <h4 className="question-title"> Câu hỏi :{data.questionText}</h4>
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
            <h4 className="question-title"> Câu hỏi : {data.questionText}</h4>

            {/* Bar Chart - Xếp hạng ưu tiên */}
            <div className="ranking-chart-container">
                <ResponsiveContainer width="100%" height="100%">

                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ right: 100, top: 20, bottom: 20 }}
                    >
                        <XAxis
                            type="number"
                            domain={[0, 'dataMax']}
                            label={{

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
                        <Bar
                            dataKey="value"
                            fill={NEON_PALETTE[0]}
                            radius={[0, 4, 4, 0]}
                            label={{
                                position: 'right',
                                formatter: (value) => `${value.toFixed(1)}%`,
                                style: {
                                    fontSize: '12px',
                                    fill: '#374151',
                                    fontWeight: '500'
                                }
                            }}
                        >
                            {chartData.map((entry, index) => {

                                const color = NEON_PALETTE[index % NEON_PALETTE.length];

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

            <div className="chart-stats">
                <p>Tổng: <strong>{totalResponses}</strong> phản hồi</p>
            </div>
        </div>
    );
};

export default RankingChart;