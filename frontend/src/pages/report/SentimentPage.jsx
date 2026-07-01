import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import ToolbarResult from "../../components/ToolbarResult";
import AIChat, { AIChatButton } from "../../components/AIChat";
import "./SentimentPage.css";
import { aiAnalysisService } from "../../services/aiAnalysisService";
import { responseService } from "../../services/responseService";
import { statisticsService } from "../../services/statisticsService";
import { surveyService } from "../../services/surveyService";
import { dashboardReportService } from "../../services/dashboardReportService";
import { teamManagementService } from "../../services/teamManagementService";
import MultipleChoiceChart from "../../components/Results/MultipleChoiceChart";
import RatingChart from "../../components/Results/RatingChart";
import BooleanChart from "../../components/Results/BooleanChart";
import RankingChart from "../../components/Results/RankingChart";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { normalizeAiText, normalizeAiTextArray } from "../../utils/normalizeAiText";

const SentimentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showAIChat, setShowAIChat] = useState(false);
  // Guards to prevent duplicate API calls (StrictMode and concurrent clicks)
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasCheckedPermRef = useRef(false);

  // State cho dữ liệu sentiment
  const [sentimentData, setSentimentData] = useState(null);
  const [loading, setLoading] = useState(false);

  // State cho dữ liệu summary
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const isFetchingSummaryRef = useRef(false);
  const hasLoadedSummaryRef = useRef(false);

  const [chartsData, setChartsData] = useState(null);
  const [chartsLoading, setChartsLoading] = useState(false);
  const isFetchingChartsRef = useRef(false);
  const hasLoadedChartsRef = useRef(false);

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

  // Thay đổi dòng 101 từ:
  // const COLORS = ["#22c55e", "#facc15", "#ef4444"];
  // Thành:
  const COLORS = [NEON_PALETTE[4], NEON_PALETTE[7], NEON_PALETTE[2]]; // Neon Green, Neon Yellow, Neon Pink

  // Hàm để tải dữ liệu sentiment (có chặn gọi trùng)
  // Sử dụng basicSentiment từ aiAnalysisService
  const loadSentimentData = async () => {
    if (isFetchingRef.current) return;

    // Chỉ chạy khi có surveyId từ location.state
    const surveyId = location.state?.surveyId;
    if (!surveyId) {
      console.warn('⚠️ Không có surveyId từ location.state');
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);

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

    // Chỉ chạy khi có surveyId từ location.state
    const surveyId = location.state?.surveyId;
    if (!surveyId) {
      console.warn('⚠️ Không có surveyId từ location.state');
      return;
    }

    try {
      isFetchingSummaryRef.current = true;
      setSummaryLoading(true);

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

  const loadChartsData = async () => {
    if (isFetchingChartsRef.current) return;

    // Chỉ chạy khi có surveyId từ location.state
    const surveyId = location.state?.surveyId;
    if (!surveyId) {
      console.warn('⚠️ Không có surveyId từ location.state');
      return;
    }

    try {
      isFetchingChartsRef.current = true;
      setChartsLoading(true);

      console.log('📊 Loading charts data for survey:', surveyId);
      const data = await statisticsService.getSurveyCharts(surveyId);
      setChartsData(data);
      console.log('✅ Charts data loaded:', data);
    } catch (error) {
      console.error('❌ Error loading charts data:', error);
      setChartsData(null);
    } finally {
      setChartsLoading(false);
      isFetchingChartsRef.current = false;
    }
  };

  // Kiểm tra quyền xem trang phân tích (Chỉ OWNER và ANALYST)
  useEffect(() => {
    if (hasCheckedPermRef.current) return;
    hasCheckedPermRef.current = true;
    const surveyIdCheck = location.state?.surveyId;
    if (!surveyIdCheck) return;
    const checkPermission = async () => {
      try {
        await dashboardReportService.getSurveyOverview(surveyIdCheck);
      } catch (err) {
        if (err.response?.status === 403) {
          alert('Bạn không có quyền xem phân tích. Chỉ OWNER và ANALYST mới có quyền.');
          navigate('/dashboard');
        }
      }
    };
    checkPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự động tải dữ liệu khi component mount (chặn StrictMode gọi 2 lần)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadSentimentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasLoadedChartsRef.current) return;
    hasLoadedChartsRef.current = true;
    loadChartsData();
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

  // Hàm để parse analysis text thành các mục: Tích cực, Tiêu cực, Đề xuất, Nhiễu
  const parseAnalysisText = (analysisText) => {
    if (!analysisText) return null;

    // Định nghĩa các mục và màu tương ứng
    const categories = [
      { key: 'Tích cực', label: 'Tích cực', color: '#22c55e', colorClass: 'text-green-600' },
      { key: 'Tiêu cực', label: 'Tiêu cực', color: '#ef4444', colorClass: 'text-red-600' },
      { key: 'Đề xuất', label: 'Đề xuất', color: '#3b82f6', colorClass: 'text-blue-600' },
      { key: 'Nhiễu', label: 'Nhiễu', color: '#eab308', colorClass: 'text-yellow-600' },
    ];

    const result = {
      positive: [],
      negative: [],
      suggestion: [],
      noise: [],
    };

    // Tách text theo các dấu mục
    // Xử lý cả trường hợp có xuống dòng và không xuống dòng
    let text = analysisText.trim();

    // Tìm tất cả các vị trí bắt đầu của các mục (case-insensitive)
    const matches = [];
    categories.forEach(cat => {
      // Tìm cả "Tích cực:" và "Tích cực :" (có thể có khoảng trắng)
      const regex = new RegExp(`${cat.key}\\s*:`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          index: match.index,
          category: cat,
          fullMatch: match[0],
        });
      }
    });

    // Sắp xếp matches theo vị trí
    matches.sort((a, b) => a.index - b.index);

    // Nếu không tìm thấy mục nào, trả về null
    if (matches.length === 0) {
      return null;
    }

    // Hàm helper để tách nội dung thành các ý riêng biệt
    const splitIntoItems = (content) => {
      if (!content || !content.trim()) return [];

      // Thử tách theo xuống dòng trước
      const lines = content.split('\n').filter(line => line.trim());

      if (lines.length > 1) {
        // Có xuống dòng, mỗi dòng là một ý (loại bỏ số thứ tự hoặc dấu đầu dòng)
        return lines.map(line => {
          // Loại bỏ số thứ tự (1., 2., 3.) hoặc dấu đầu dòng (-, •)
          return line.trim().replace(/^(\d+[\.\)]\s*|[-•]\s*)/, '').trim();
        }).filter(item => item.length > 0);
      }

      // Không có xuống dòng, thử các cách tách khác
      // 1. Tách theo số thứ tự (1., 2., 3.) hoặc dấu đầu dòng (-, •)
      const numberedPattern = /(?:\d+[\.\)]\s*|[-•]\s*)/;
      const numberedParts = content.split(numberedPattern).filter(part => part.trim());
      if (numberedParts.length > 1) {
        return numberedParts.map(part => part.trim()).filter(part => part.length > 0);
      }

      // 2. Tách theo dấu phẩy (nếu có nhiều ý ngắn)
      const commaParts = content.split(/[,，]/).map(part => part.trim()).filter(part => part.length > 0);
      if (commaParts.length > 1 && commaParts.every(part => part.length < 100)) {
        // Chỉ tách theo dấu phẩy nếu các phần đều ngắn (có thể là danh sách)
        return commaParts;
      }

      // 3. Nếu không tách được, coi toàn bộ là một ý
      return [content.trim()];
    };

    // Tách text thành các phần theo từng mục
    matches.forEach((match, index) => {
      const startIndex = match.index + match.fullMatch.length;
      const endIndex = index < matches.length - 1 ? matches[index + 1].index : text.length;
      const content = text.substring(startIndex, endIndex).trim();

      if (content) {
        const items = splitIntoItems(content);

        // Gán vào mục tương ứng
        const categoryKey = match.category.key.toLowerCase();
        if (categoryKey === 'tích cực') {
          result.positive = items;
        } else if (categoryKey === 'tiêu cực') {
          result.negative = items;
        } else if (categoryKey === 'đề xuất') {
          result.suggestion = items;
        } else if (categoryKey === 'nhiễu') {
          result.noise = items;
        }
      }
    });

    // Kiểm tra xem có mục nào không
    const hasData = result.positive.length > 0 ||
      result.negative.length > 0 ||
      result.suggestion.length > 0 ||
      result.noise.length > 0;

    return hasData ? result : null;
  };

  // Hàm để parse summary text thành các phần tử React (giữ lại cho tương thích)
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

    return [{
      id: 0,
      text: highlightKeywords(summaryText.trim()),
      isBullet: false
    }];
  };

  // Lấy summary text từ summaryData và normalize
  const rawSummaryText = summaryData?.summary || null;
  const summaryText = rawSummaryText ? normalizeAiText(rawSummaryText) : null;
  const parsedSummary = summaryText ? parseSummaryText(summaryText) : null;

  // Parse analysis text theo các mục: Tích cực, Tiêu cực, Đề xuất, Nhiễu
  const parsedAnalysis = summaryText ? parseAnalysisText(summaryText) : null;

  // Gộp tất cả các ý chính từ tất cả các trạng thái thành một danh sách và normalize
  const allMainPoints = parsedAnalysis ? normalizeAiTextArray([
    ...parsedAnalysis.positive,
    ...parsedAnalysis.negative,
    ...parsedAnalysis.suggestion,
    ...parsedAnalysis.noise
  ]) : null;

  // Kiểm tra có surveyId từ location.state không
  const surveyId = location.state?.surveyId;
  const surveyTitle = location.state?.surveyTitle;
  const surveyDescription = location.state?.surveyDescription;

  // Nếu không có surveyId, hiển thị thông báo
  if (!surveyId) {
    return (
      <MainLayout surveyId={null}>
        <div className="sentiment-container">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>Không tìm thấy khảo sát</h2>
            <p>Vui lòng chọn một khảo sát để xem thống kê.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      surveyId={surveyId}
      surveyTitle={surveyTitle}
      surveyDescription={surveyDescription}
    >
      <div className="sentiment-container">
        <ToolbarResult
          surveyId={surveyId}
          surveyTitle={surveyTitle}
          surveyDescription={surveyDescription}
        />
        <h1 className="page-title">
          {surveyTitle ? `Tên khảo sát : ${surveyTitle}` : 'Thống kê khảo sát'}
        </h1>


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
                        `${(percent * 100).toFixed(0)}%`
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
                  <strong><i className="fa-solid fa-robot"></i> Nhận xét AI</strong>
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
          <h2><i className="fa-solid fa-robot"></i> Phân tích AI</h2>

          <div className="ai-content">
            <h3><i className="fa-solid fa-brain"></i> Tóm tắt ý chính</h3>
            {summaryLoading ? (
              <div className="loading-summary">
                <p>Đang tải tóm tắt...</p>
              </div>
            ) : summaryText ? (
              <div className="ai-summary-all">
                {allMainPoints && allMainPoints.length > 0 ? (
                  <ul className="summary-items-list" style={{ listStyle: 'none', padding: 0 }}>
                    {allMainPoints.map((item, index) => (
                      <li
                        key={index}
                        style={{
                          marginBottom: '1rem',
                          lineHeight: '1.8',
                          paddingLeft: '1.5rem',
                          position: 'relative'
                        }}
                      >
                        <span style={{
                          position: 'absolute',
                          left: 0,
                          color: '#3b82f6',
                          fontWeight: 'bold'
                        }}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : parsedSummary ? (
                  <ul className="summary-items-list" style={{ listStyle: 'none', padding: 0 }}>
                    {parsedSummary.map((item) => (
                      <li
                        key={item.id}
                        style={{
                          marginBottom: '1rem',
                          lineHeight: '1.8',
                          paddingLeft: item.isBullet ? '1.5rem' : '0',
                          position: 'relative'
                        }}
                      >
                        {item.isBullet && (
                          <span style={{
                            position: 'absolute',
                            left: 0,
                            color: '#3b82f6',
                            fontWeight: 'bold'
                          }}>•</span>
                        )}
                        <span>
                          {item.text.map((part, idx) => (
                            part.highlight ? (
                              <strong key={idx} style={{ color: '#3b82f6' }}>"{part.text}"</strong>
                            ) : (
                              <span key={idx}>{part.text}</span>
                            )
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="summary-text" style={{ lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {summaryText}
                  </div>
                )}
              </div>
            ) : summaryData?.ok === false ? (
              <div className="error-summary">
                <p>{summaryData.summary || summaryData.error || 'Không thể tải tóm tắt. Vui lòng thử lại sau.'}</p>
              </div>
            ) : (
              <div className="no-summary">
                <p>Không có dữ liệu</p>
              </div>
            )}
            {summaryData && summaryData.count !== undefined && (
              <p className="summary-meta" style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                Dựa trên <strong>{summaryData.count}</strong> phản hồi
              </p>
            )}
          </div>
        </section>
        {/* Phần thống kê biểu đồ các câu hỏi */}
        <section className="survey-charts-section">
          <h2><i className="fa-solid fa-chart-bar"></i> Thống kê các câu hỏi</h2>

          {chartsLoading ? (
            <div className="loading-charts">
              <p>Đang tải dữ liệu biểu đồ...</p>
            </div>
          ) : chartsData ? (
            <div className="charts-content">
              {/* Multiple Choice Charts */}
              {chartsData.multipleChoiceData && chartsData.multipleChoiceData.length > 0 && (
                <div className="charts-category">
                  <h3 className="category-title">
                    <i className="fa-solid fa-list-check"></i> Câu hỏi lựa chọn
                  </h3>
                  <div className="charts-grid">
                    {chartsData.multipleChoiceData.map((item) => {
                      // ✅ Phân biệt ranking: Backend trả về ranking với chartType === "bar"
                      // Multiple choice thường có chartType === "pie" hoặc undefined
                      const isRanking = item.chartType === "bar";

                      if (isRanking) {
                        return (
                          <div key={item.questionId} className="chart-card-item ranking-card">
                            <RankingChart
                              data={item}
                              surveyId={surveyId}
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={item.questionId} className="chart-card-item">
                          <MultipleChoiceChart data={item} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rating Charts */}
              {chartsData.ratingData && chartsData.ratingData.length > 0 && (
                <div className="charts-category">
                  <h3 className="category-title">
                    <i className="fa-solid fa-star"></i> Câu hỏi đánh giá
                  </h3>
                  <div className="charts-grid">
                    {chartsData.ratingData.map((item) => (
                      <div key={item.questionId} className="chart-card-item">
                        <RatingChart data={item} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Boolean Charts */}
              {chartsData.booleanData && chartsData.booleanData.length > 0 && (
                <div className="charts-category">
                  <h3 className="category-title">
                    <i className="fa-solid fa-circle-check"></i> Câu hỏi Yes/No
                  </h3>
                  <div className="charts-grid">
                    {chartsData.booleanData.map((item) => (
                      <div key={item.questionId} className="chart-card-item">
                        <BooleanChart data={item} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {(!chartsData.multipleChoiceData || chartsData.multipleChoiceData.length === 0) &&
                (!chartsData.ratingData || chartsData.ratingData.length === 0) &&
                (!chartsData.booleanData || chartsData.booleanData.length === 0) && (
                  <div className="no-charts-message">
                    <p>Chưa có dữ liệu biểu đồ. Vui lòng đợi có phản hồi từ người tham gia khảo sát.</p>
                  </div>
                )}
            </div>
          ) : (
            <div className="no-charts-message">
              <p>Không thể tải dữ liệu biểu đồ. Vui lòng thử lại sau.</p>
            </div>
          )}
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

      {/* AI Chat Button - Hiển thị khi có surveyId */}
      {location.state?.surveyId && (
        <>
          {!showAIChat && (
            <AIChatButton
              onClick={() => setShowAIChat(true)}
              surveyId={location.state.surveyId}
            />
          )}
          {/* Keep AIChat mounted to preserve chat history */}
          <AIChat
            surveyId={location.state.surveyId}
            surveyTitle={location.state.surveyTitle}
            surveyDescription={location.state.surveyDescription}
            onClose={() => setShowAIChat(false)}
            isOpen={showAIChat}
          />
        </>
      )}
    </MainLayout>
  );
};

export default SentimentPage;
