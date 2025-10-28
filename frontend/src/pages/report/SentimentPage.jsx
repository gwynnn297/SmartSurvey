import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import "./SentimentPage.css";
import { aiSentimentService } from "../../services/aiSentimentService";
import { responseService } from "../../services/responseService";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const SentimentPage = () => {
  const location = useLocation();
  // Guards to prevent duplicate API calls (StrictMode and concurrent clicks)
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // State cho dữ liệu sentiment
  const [sentimentData, setSentimentData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Dữ liệu mặc định khi chưa có dữ liệu thật
  const defaultStats = {
    total: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    percent: {
      positive: 0,
      neutral: 0,
      negative: 0,
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

  // Hàm để tải dữ liệu sentiment (có chặn gọi trùng)
  const loadSentimentData = async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
  
      let surveyId = location.state?.surveyId
        || JSON.parse(localStorage.getItem('userSurveys') || '[]')[0]?.id
        || 1;
  
      console.log('📊 Bắt đầu tải dữ liệu sentiment cho survey:', surveyId);
  
      // Lấy số phản hồi và dữ liệu sentiment gần nhất
      const currentResponseCount = await responseService.getResponseCount(surveyId);
      const storageKey = `sentiment_count_${surveyId}`;
      const lastResponseCount = parseInt(localStorage.getItem(storageKey) || '0', 10);
      const latest = await aiSentimentService.getLatestSentiment(surveyId);
  
      // 🧩 1️⃣ Trường hợp chưa có sentiment
      const noExistingSentiment = !latest.success || (latest.total_responses || 0) === 0;
      if (noExistingSentiment) {
        console.log('🆕 Trường hợp 1: Chưa có sentiment → chạy phân tích ban đầu');
        try {
          const analyzeResponse = await aiSentimentService.analyzeSentiment(surveyId);
          if (analyzeResponse?.success) {
            setSentimentData(analyzeResponse);
            localStorage.setItem(storageKey, String(currentResponseCount));
            console.log('✅ Hoàn tất phân tích ban đầu');
          } else {
            console.warn('⚠️ Phân tích ban đầu thất bại → dùng dữ liệu latest');
            setSentimentData(latest);
          }
        } catch (err) {
          console.error('❌ Lỗi khi phân tích ban đầu:', err);
          setSentimentData(latest);
        }
        return; // ⛔ Dừng tại đây, không chạy tiếp
      }
  
      // 🧩 2️⃣ Trường hợp có sentiment và có phản hồi mới
      if (currentResponseCount > lastResponseCount) {
        console.log('🔁 Trường hợp 2: Có phản hồi mới → chạy phân tích lại');
        try {
          const analyzeResponse = await aiSentimentService.analyzeSentiment(surveyId);
          if (analyzeResponse?.success) {
            setSentimentData(analyzeResponse);
            localStorage.setItem(storageKey, String(currentResponseCount));
            console.log('✅ Hoàn tất phân tích lại');
          } else {
            console.warn('⚠️ Phân tích lại thất bại → fallback sang latest');
            setSentimentData(latest);
          }
        } catch (err) {
          console.error('❌ Lỗi khi phân tích lại:', err);
          setSentimentData(latest);
        }
        return; // ⛔ Dừng tại đây, không chạy tiếp
      }
  
      // 🧩 3️⃣ Trường hợp không có phản hồi mới
      console.log('✅ Trường hợp 3: Không có phản hồi mới → dùng dữ liệu sentiment cũ');
      setSentimentData(latest);
      localStorage.setItem(storageKey, String(currentResponseCount));
      return; // ⛔ Dừng luôn
  
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu sentiment:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };
  

  // Tự động tải dữ liệu khi component mount (chặn StrictMode gọi 2 lần)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadSentimentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h1 className="page-title">
          {location.state?.surveyTitle ?
            `Phân tích cảm xúc: ${location.state.surveyTitle}` :
            'Phân tích cảm xúc tổng quan'
          }
        </h1>
        <p className="page-subtitle">
          {location.state?.surveyDescription ?
            location.state.surveyDescription :
            'AI phân tích cảm xúc dựa trên phản hồi khảo sát'
          }
        </p>

        <div className="sentiment-summary-grid">
          {/* Biểu đồ tròn phân bố cảm xúc */}
          <div className="summary-card chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-chart-pie" title="Phân bố cảm xúc"></i> Phân bố cảm xúc</h3>

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
