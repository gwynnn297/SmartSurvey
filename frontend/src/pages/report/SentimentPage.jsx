import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import "./SentimentPage.css";
import { aiAnalysisService } from "../../services/aiAnalysisService";
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

  // State cho dữ liệu summary
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const isFetchingSummaryRef = useRef(false);
  const hasLoadedSummaryRef = useRef(false);

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

  // Hàm để convert format từ basicSentiment response sang format hiện tại
  // Input: {ok: true, total: number, counts: {POS: number, NEU: number, NEG: number}}
  // Output: {total_responses, positive_percent, neutral_percent, negative_percent, positive, neutral, negative}
  const convertBasicSentimentFormat = (data) => {
    if (!data || !data.ok || !data.counts) {
      return null;
    }

    const total = data.total || 0;
    const counts = data.counts || { POS: 0, NEU: 0, NEG: 0 };
    const pos = counts.POS || 0;
    const neu = counts.NEU || 0;
    const neg = counts.NEG || 0;

    // Tính phần trăm
    const positivePercent = total > 0 ? (pos / total) * 100 : 0;
    const neutralPercent = total > 0 ? (neu / total) * 100 : 0;
    const negativePercent = total > 0 ? (neg / total) * 100 : 0;

    return {
      total_responses: total,
      positive_percent: Math.round(positivePercent * 100) / 100, // Làm tròn 2 chữ số
      neutral_percent: Math.round(neutralPercent * 100) / 100,
      negative_percent: Math.round(negativePercent * 100) / 100,
      positive: pos,
      neutral: neu,
      negative: neg,
    };
  };

  // Tính toán dữ liệu từ sentimentData hoặc dùng dữ liệu mặc định
  const stats = sentimentData ? {
    total: sentimentData.total_responses || 0,
    positive: sentimentData.positive || Math.round((sentimentData.positive_percent || 0) * (sentimentData.total_responses || 0) / 100),
    neutral: sentimentData.neutral || Math.round((sentimentData.neutral_percent || 0) * (sentimentData.total_responses || 0) / 100),
    negative: sentimentData.negative || Math.round((sentimentData.negative_percent || 0) * (sentimentData.total_responses || 0) / 100),
    percent: {
      positive: sentimentData.positive_percent || 0,
      neutral: sentimentData.neutral_percent || 0,
      negative: sentimentData.negative_percent || 0,
    },
  } : defaultStats;

  const COLORS = ["#22c55e", "#facc15", "#ef4444"];

  // Hàm để tải dữ liệu sentiment (có chặn gọi trùng)
  // Sử dụng basicSentiment từ aiAnalysisService
  const loadSentimentData = async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);

      let surveyId = location.state?.surveyId
        || JSON.parse(localStorage.getItem('userSurveys') || '[]')[0]?.id
        || 1;

      console.log('📊 Bắt đầu tải dữ liệu basic sentiment cho survey:', surveyId);

      // Lấy số phản hồi và dữ liệu sentiment gần nhất
      const currentResponseCount = await responseService.getResponseCount(surveyId);
      const storageKey = `basic_sentiment_count_${surveyId}`;
      const lastResponseCount = parseInt(localStorage.getItem(storageKey) || '0', 10);

      // Thử lấy basic sentiment gần nhất trước
      let latest = null;
      try {
        latest = await aiAnalysisService.getLatestAnalysis(surveyId, 'basic-sentiment');
      } catch (err) {
        console.log('ℹ️ Không tìm thấy basic sentiment gần nhất:', err);
      }

      // 🧩 1️⃣ Trường hợp chưa có sentiment hoặc sentiment không hợp lệ
      const noExistingSentiment = !latest || latest.ok === false || !latest.counts || (latest.total || 0) === 0;
      if (noExistingSentiment) {
        console.log('🆕 Trường hợp 1: Chưa có basic sentiment → chạy phân tích ban đầu');
        try {
          const analyzeResponse = await aiAnalysisService.basicSentiment(surveyId);
          const convertedData = convertBasicSentimentFormat(analyzeResponse);
          if (convertedData) {
            setSentimentData(convertedData);
            localStorage.setItem(storageKey, String(currentResponseCount));
            console.log('✅ Hoàn tất phân tích basic sentiment ban đầu');
          } else {
            console.warn('⚠️ Phân tích ban đầu thất bại → dùng dữ liệu mặc định');
            setSentimentData(null);
          }
        } catch (err) {
          console.error('❌ Lỗi khi phân tích ban đầu:', err);
          setSentimentData(null);
        }
        return; // ⛔ Dừng tại đây, không chạy tiếp
      }

      // Convert latest data sang format hiện tại
      const convertedLatest = convertBasicSentimentFormat(latest);
      if (!convertedLatest) {
        console.warn('⚠️ Không thể convert latest data → chạy phân tích lại');
        try {
          const analyzeResponse = await aiAnalysisService.basicSentiment(surveyId);
          const convertedData = convertBasicSentimentFormat(analyzeResponse);
          if (convertedData) {
            setSentimentData(convertedData);
            localStorage.setItem(storageKey, String(currentResponseCount));
            console.log('✅ Hoàn tất phân tích basic sentiment');
          } else {
            setSentimentData(null);
          }
        } catch (err) {
          console.error('❌ Lỗi khi phân tích:', err);
          setSentimentData(null);
        }
        return;
      }

      // 🧩 2️⃣ Trường hợp có sentiment và có phản hồi mới
      if (currentResponseCount > lastResponseCount) {
        console.log('🔁 Trường hợp 2: Có phản hồi mới → chạy phân tích lại');
        try {
          const analyzeResponse = await aiAnalysisService.basicSentiment(surveyId);
          const convertedData = convertBasicSentimentFormat(analyzeResponse);
          if (convertedData) {
            setSentimentData(convertedData);
            localStorage.setItem(storageKey, String(currentResponseCount));
            console.log('✅ Hoàn tất phân tích basic sentiment lại');
          } else {
            console.warn('⚠️ Phân tích lại thất bại → fallback sang latest');
            setSentimentData(convertedLatest);
          }
        } catch (err) {
          console.error('❌ Lỗi khi phân tích lại:', err);
          setSentimentData(convertedLatest);
        }
        return; // ⛔ Dừng tại đây, không chạy tiếp
      }

      // 🧩 3️⃣ Trường hợp không có phản hồi mới
      console.log('✅ Trường hợp 3: Không có phản hồi mới → dùng dữ liệu basic sentiment cũ');
      setSentimentData(convertedLatest);
      localStorage.setItem(storageKey, String(currentResponseCount));
      return; // ⛔ Dừng luôn

    } catch (error) {
      console.error('Lỗi khi tải dữ liệu basic sentiment:', error);
      setSentimentData(null);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };


  // Hàm để tải dữ liệu summary (có chặn gọi trùng)
  const loadSummaryData = async () => {
    if (isFetchingSummaryRef.current) return;
    try {
      isFetchingSummaryRef.current = true;
      setSummaryLoading(true);

      let surveyId = location.state?.surveyId
        || JSON.parse(localStorage.getItem('userSurveys') || '[]')[0]?.id
        || 1;

      console.log('📝 Bắt đầu tải dữ liệu summary cho survey:', surveyId);

      // Lấy số phản hồi và dữ liệu summary gần nhất
      const currentResponseCount = await responseService.getResponseCount(surveyId);
      const storageKey = `summary_count_${surveyId}`;
      const lastResponseCount = parseInt(localStorage.getItem(storageKey) || '0', 10);

      // Thử lấy summary gần nhất trước
      let latest = null;
      try {
        latest = await aiAnalysisService.getLatestAnalysis(surveyId, 'summary');
      } catch (err) {
        console.log('ℹ️ Không tìm thấy summary gần nhất:', err);
      }

      // 🧩 1️⃣ Trường hợp chưa có summary hoặc summary không hợp lệ
      const noExistingSummary = !latest || latest.ok === false || !latest.summary;
      if (noExistingSummary) {
        console.log('🆕 Trường hợp 1: Chưa có summary → chạy phân tích ban đầu');
        try {
          const summarizeResponse = await aiAnalysisService.summarize(surveyId);
          if (summarizeResponse?.ok && summarizeResponse?.summary) {
            setSummaryData(summarizeResponse);
            localStorage.setItem(storageKey, String(currentResponseCount));
            console.log('✅ Hoàn tất phân tích summary ban đầu');
          } else {
            console.warn('⚠️ Phân tích summary ban đầu thất bại');
            setSummaryData({ ok: false, summary: 'Không thể tạo tóm tắt. Vui lòng thử lại sau.' });
          }
        } catch (err) {
          console.error('❌ Lỗi khi phân tích summary ban đầu:', err);
          setSummaryData({ ok: false, summary: 'Đã xảy ra lỗi khi tạo tóm tắt.' });
        }
        return;
      }

      // 🧩 2️⃣ Trường hợp có summary và có phản hồi mới
      if (currentResponseCount > lastResponseCount) {
        console.log('🔁 Trường hợp 2: Có phản hồi mới → chạy phân tích summary lại');
        try {
          const summarizeResponse = await aiAnalysisService.summarize(surveyId);
          if (summarizeResponse?.ok && summarizeResponse?.summary) {
            setSummaryData(summarizeResponse);
            localStorage.setItem(storageKey, String(currentResponseCount));
            console.log('✅ Hoàn tất phân tích summary lại');
          } else {
            console.warn('⚠️ Phân tích summary lại thất bại → fallback sang latest');
            setSummaryData(latest);
          }
        } catch (err) {
          console.error('❌ Lỗi khi phân tích summary lại:', err);
          setSummaryData(latest);
        }
        return;
      }

      // 🧩 3️⃣ Trường hợp không có phản hồi mới
      console.log('✅ Trường hợp 3: Không có phản hồi mới → dùng dữ liệu summary cũ');
      setSummaryData(latest);
      localStorage.setItem(storageKey, String(currentResponseCount));
      return;

    } catch (error) {
      console.error('Lỗi khi tải dữ liệu summary:', error);
      setSummaryData({ ok: false, summary: 'Đã xảy ra lỗi khi tải tóm tắt.' });
    } finally {
      setSummaryLoading(false);
      isFetchingSummaryRef.current = false;
    }
  };

  // Tự động tải dữ liệu khi component mount (chặn StrictMode gọi 2 lần)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadSentimentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự động tải dữ liệu summary khi component mount
  useEffect(() => {
    if (hasLoadedSummaryRef.current) return;
    hasLoadedSummaryRef.current = true;
    loadSummaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const chartData = [
    { name: "Tích cực", value: stats.percent.positive },
    { name: "Trung lập", value: stats.percent.neutral },
    { name: "Tiêu cực", value: stats.percent.negative },
  ];

  // Hàm để parse summary text thành các phần tử React
  const parseSummaryText = (summaryText) => {
    if (!summaryText) return null;

    // Summary có thể là bullet points hoặc đoạn văn
    // Parse bullet points (bắt đầu bằng "- " hoặc "• ")
    const lines = summaryText.split('\n').filter(line => line.trim());

    // Hàm helper để highlight keywords trong text
    const highlightKeywords = (text) => {
      // Tìm các từ trong quotes để highlight
      const parts = [];
      const regex = /"([^"]+)"/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        // Thêm text trước keyword
        if (match.index > lastIndex) {
          parts.push({ text: text.substring(lastIndex, match.index), highlight: false });
        }
        // Thêm keyword được highlight
        parts.push({ text: match[1], highlight: true });
        lastIndex = regex.lastIndex;
      }

      // Thêm phần còn lại
      if (lastIndex < text.length) {
        parts.push({ text: text.substring(lastIndex), highlight: false });
      }

      // Nếu không có keywords, trả về text gốc
      if (parts.length === 0) {
        return [{ text, highlight: false }];
      }

      return parts;
    };

    // Nếu có bullet points, format thành array
    if (lines.some(line => line.trim().startsWith('-') || line.trim().startsWith('•'))) {
      return lines.map((line, index) => {
        // Loại bỏ bullet marker
        let text = line.trim().replace(/^[-•]\s*/, '');
        return {
          id: index,
          text: highlightKeywords(text),
          isBullet: true
        };
      });
    }

    // Nếu là đoạn văn, hiển thị như một đoạn với highlights
    // Giữ nguyên format gốc, chỉ highlight keywords
    return [{
      id: 0,
      text: highlightKeywords(summaryText.trim()),
      isBullet: false
    }];
  };

  // Lấy summary text từ summaryData
  const summaryText = summaryData?.summary || null;
  const parsedSummary = summaryText ? parseSummaryText(summaryText) : null;

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
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
                  <p>Đang tải dữ liệu...</p>
                </div>
              ) : (
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
              )}
            </div>
          </div>

          {/* Thống kê chi tiết */}
          <div className="summary-card stats-card">
            <h3><i className="fa-solid fa-chart-line" title="Thống kê chi tiết" ></i> Thống kê chi tiết</h3>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p>Đang tải dữ liệu...</p>
              </div>
            ) : (
              <>
                <div className="stat-item positive">
                  <div>
                    <h4>Tích cực</h4>
                    <p>Khách hàng hài lòng</p>
                  </div>
                  <span>{Number(stats.percent.positive || 0).toFixed(1)}%</span>
                </div>
                <div className="stat-item neutral">
                  <div>
                    <h4>Trung lập</h4>
                    <p>Không có ý kiến rõ ràng</p>
                  </div>
                  <span>{Number(stats.percent.neutral || 0).toFixed(1)}%</span>
                </div>
                <div className="stat-item negative">
                  <div>
                    <h4>Tiêu cực</h4>
                    <p>Cần cải thiện</p>
                  </div>
                  <span>{Number(stats.percent.negative || 0).toFixed(1)}%</span>
                </div>

                <div className="ai-insight">
                  <strong>🤖 Nhận xét AI</strong>
                  <p>
                    {stats.total > 0 ? (
                      <>
                        Tỷ lệ hài lòng <b>{Number(stats.percent.positive || 0).toFixed(1)}%</b> cho thấy dịch vụ đang đi đúng hướng. Tuy nhiên,{" "}
                        <b>{Number(stats.percent.negative || 0).toFixed(1)}%</b> phản hồi tiêu cực cần được ưu tiên xử lý để cải thiện trải nghiệm.
                      </>
                    ) : (
                      'Chưa có dữ liệu phân tích. Vui lòng đợi hệ thống xử lý.'
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <section className="ai-analysis">
          <h2>🤖 Phân tích AI</h2>

          <div className="ai-content">
            <h3>🧠 Tóm tắt ý chính</h3>
            {summaryLoading ? (
              <div className="loading-summary">
                <p>Đang tải tóm tắt...</p>
              </div>
            ) : parsedSummary && parsedSummary.length > 0 ? (
              <div className="ai-sum">
                {parsedSummary.map((item) => (
                  <p key={item.id} style={{ marginBottom: '0.75rem', lineHeight: '1.6' }}>
                    {item.isBullet && <span style={{ marginRight: '0.5rem' }}>•</span>}
                    {item.text.map((part, partIndex) => (
                      part.highlight ? (
                        <span key={partIndex} className="highlight">{part.text}</span>
                      ) : (
                        <span key={partIndex}>{part.text}</span>
                      )
                    ))}
                  </p>
                ))}
              </div>
            ) : summaryData?.ok === false ? (
              <div className="error-summary">
                <p>{summaryData.summary || summaryData.error || 'Không thể tải tóm tắt. Vui lòng thử lại sau.'}</p>
              </div>
            ) : (
              <div className="no-summary">
                <p>Chưa có dữ liệu tóm tắt. Vui lòng đợi hệ thống phân tích.</p>
              </div>
            )}
            {summaryData && summaryData.count !== undefined && (
              <p className="summary-meta" style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                Dựa trên <strong>{summaryData.count}</strong> phản hồi
              </p>
            )}
          </div>
        </section>

        {/* Chi tiết phản hồi */}
        {/* <div className="feedback-section">
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
        </div> */}
      </div>
    </MainLayout>
  );
};

export default SentimentPage;
