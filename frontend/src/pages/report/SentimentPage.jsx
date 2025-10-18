import React, { useState, useEffect } from "react";
import MainLayout from "../../layouts/MainLayout";
import "./SentimentPage.css";
import { aiSentimentService } from "../../services/aiSentimentService";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const SentimentPage = () => {
  // State cho dữ liệu sentiment
  const [sentimentData, setSentimentData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Dữ liệu mặc định khi chưa có dữ liệu thật
  const defaultStats = {
    total: 200,
    positive: 130,
    neutral: 40,
    negative: 30,
    percent: {
      positive: 65,
      neutral: 20,
      negative: 15,
    },
  };

  // Tính toán dữ liệu từ sentimentData hoặc dùng dữ liệu mặc định
  const stats = sentimentData ? {
    total: sentimentData.total_responses || 0,
    positive: Math.round((sentimentData.positive_percent || 0) * (sentimentData.total_responses || 0) / 100),
    neutral: Math.round((sentimentData.neutral_percent || 0) * (sentimentData.total_responses || 0) / 100),
    negative: Math.round((sentimentData.negative_percent || 0) * (sentimentData.total_responses || 0) / 100),
    percent: {
      positive: sentimentData.positive_percent || 0,
      neutral: sentimentData.neutral_percent || 0,
      negative: sentimentData.negative_percent || 0,
    },
  } : defaultStats;

  const COLORS = ["#22c55e", "#facc15", "#ef4444"];

  // Hàm để tải dữ liệu sentiment
  const loadSentimentData = async () => {
    try {
      setLoading(true);

      // Lấy surveyId từ localStorage hoặc dùng surveyId mặc định
      const surveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
      const surveyId = surveys.length > 0 ? surveys[0].id : 1;

      console.log('Loading sentiment data for survey:', surveyId);

      // Thử lấy dữ liệu sentiment gần nhất trước
      let response = await aiSentimentService.getLatestSentiment(surveyId);

      // Nếu không có dữ liệu (404), thực hiện phân tích mới
      if (!response.success || !response.total_responses) {
        console.log('No existing sentiment data found, analyzing new...');
        try {
          response = await aiSentimentService.analyzeSentiment(surveyId);
          if (response.success) {
            setSentimentData(response);
            console.log('Sentiment analysis completed:', response);
          }
        } catch (analyzeError) {
          console.error('Error analyzing sentiment:', analyzeError);
          // Nếu cả analyze cũng lỗi, giữ nguyên dữ liệu mặc định
        }
      } else {
        setSentimentData(response);
        console.log('Sentiment data loaded:', response);
      }

    } catch (error) {
      console.error('Error loading sentiment data:', error);

      // Xử lý các loại lỗi khác nhau
      if (error.response?.status === 404) {
        console.log('Survey not found or no sentiment data available. Using default data.');
      } else if (error.response?.status === 500) {
        console.log('Server error. Using default data.');
      }
      // Giữ nguyên dữ liệu mặc định khi có lỗi
    } finally {
      setLoading(false);
    }
  };

  // Tự động tải dữ liệu khi component mount
  useEffect(() => {
    loadSentimentData();
  }, []);

  const chartData = [
    { name: "Tích cực", value: stats.percent.positive },
    { name: "Trung lập", value: stats.percent.neutral },
    { name: "Tiêu cực", value: stats.percent.negative },
  ];

  const feedbacks = [
    { id: 1, sentiment: "Tích cực", text: "Dịch vụ tuyệt vời, tôi rất hài lòng với chất lượng và thái độ phục vụ." },
    { id: 2, sentiment: "Tích cực", text: "Trải nghiệm rất tốt, nhân viên thân thiện và hỗ trợ tận tình." },
    { id: 3, sentiment: "Tiêu cực", text: "Thời gian phản hồi hơi chậm, cần cải thiện thêm." },
    { id: 4, sentiment: "Trung lập", text: "Dịch vụ ổn, không có gì đặc biệt." },
  ];

  return (
    <MainLayout>
      <div className="sentiment-container">
        <h1 className="page-title">Phân tích cảm xúc tổng quan</h1>
        <p className="page-subtitle">AI phân tích cảm xúc dựa trên phản hồi khảo sát</p>

        {!sentimentData && (
          <div className="data-notice">
            <i className="fa-solid fa-info-circle"></i>
            <span>Đang hiển thị dữ liệu mẫu. Vui lòng tạo khảo sát và có phản hồi để xem dữ liệu thật.</span>
          </div>
        )}

        <div className="sentiment-summary-grid">
          {/* Biểu đồ tròn phân bố cảm xúc */}
          <div className="summary-card chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-chart-pie" title="Phân bố cảm xúc"></i> Phân bố cảm xúc</h3>
              <button
                className="btn-refresh-small"
                onClick={loadSentimentData}
                disabled={loading}
                title="Làm mới dữ liệu"
              >
                <i className={`fa-solid fa-refresh ${loading ? 'fa-spin' : ''}`}></i>
              </button>
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              {/* <p className="chart-total">{stats.total}</p> */}
              {/* <p className="chart-sub">Tổng phản hồi</p> */}
            </div>
          </div>

          {/* Thống kê chi tiết */}
          <div className="summary-card stats-card">
            <h3><i className="fa-solid fa-chart-line" title="Thống kê chi tiết" ></i> Thống kê chi tiết</h3>
            <div className="stat-item positive">
              <div>
                <h4>Tích cực</h4>
                <p>Khách hàng hài lòng</p>
              </div>
              <span>{stats.percent.positive}%</span>
            </div>
            <div className="stat-item neutral">
              <div>
                <h4>Trung lập</h4>
                <p>Không có ý kiến rõ ràng</p>
              </div>
              <span>{stats.percent.neutral}%</span>
            </div>
            <div className="stat-item negative">
              <div>
                <h4>Tiêu cực</h4>
                <p>Cần cải thiện</p>
              </div>
              <span>{stats.percent.negative}%</span>
            </div>

            <div className="ai-insight">
              <strong>🤖 Nhận xét AI</strong>
              <p>
                Tỷ lệ hài lòng cao (<b>{stats.percent.positive}%</b>) cho thấy dịch vụ đang đi đúng hướng. Tuy nhiên,{" "}
                <b>{stats.percent.negative}%</b> phản hồi tiêu cực cần được ưu tiên xử lý để cải thiện trải nghiệm.
              </p>
            </div>
          </div>
        </div>

        <section className="ai-analysis">
          <h2>🤖 Phân tích AI</h2>

          <div className="ai-content">
            <h3>🧠 Tóm tắt ý chính</h3>
            <p className="ai-sum">
              <span className="highlight">chờ đợi lâu</span> và{" "}
              <span className="highlight">giá cả hơi cao</span>. Khách hàng mong muốn{" "}
              <span className="highlight">cải thiện ứng dụng mobile</span> và{" "}
              <span className="highlight">hỗ trợ kỹ thuật</span>.
            </p>
          </div>


        </section>

        {/* Chi tiết phản hồi */}
        <div className="feedback-section">
          <div className="feedback-header">
            <h3><i className="fa-regular fa-comment" title="Chi tiết phản hồi theo cảm xúc"></i> Chi tiết phản hồi theo cảm xúc</h3>
            <div className="feedback-filters">
              <button className="active">Tất cả ({stats.total})</button>
              <button className="positive">Tích cực ({stats.positive})</button>
              <button className="neutral">Trung lập ({stats.neutral})</button>
              <button className="negative">Tiêu cực ({stats.negative})</button>
            </div>
          </div>

          <div className="feedback-list">
            {feedbacks.map((fb) => (
              <div key={fb.id} className={`feedback-card ${fb.sentiment.toLowerCase()}`}>
                <span className="tag">{fb.sentiment}</span>
                <p>{fb.text}</p>
                <span className="index">#{fb.id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SentimentPage;
