import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderComponent from "../../components/HeaderComponent";
import Sidebar from "../../components/Sidebar";
import MainLayout from "../../layouts/MainLayout";
import { surveyService } from "../../services/surveyService";
import { responseService } from "../../services/responseService";
import { individualResponseService } from "../../services/individualResponseService";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import "./DashboardPage.css";

const METRIC_CARDS = [
  {
    key: "totalSurveys",
    label: "Tổng khảo sát",
    icon: "fa-solid fa-table-list",
    accent: "blue"
  },
  {
    key: "totalResponses",
    label: "Tổng phản hồi",
    icon: "fa-solid fa-list",
    accent: "emerald"
  },
  {
    key: "activeSurveys",
    label: "Đang hoạt động",
    icon: "fa-solid fa-hexagon-nodes",
    accent: "amber"
  },
  {
    key: "completionRate",
    label: "Tỉ lệ hoàn thành",
    icon: "fa-solid fa-chart-line",
    accent: "violet",
    suffix: "%"
  }
];

const CHART_PLACEHOLDERS = [
  {
    title: "Phân bố trạng thái khảo sát",
    type: "Biểu đồ tròn",
    description: "Biểu đồ tròn hiển thị tỷ lệ khảo sát theo trạng thái",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
      </svg>
    )
  },
  {
    title: "Xu hướng phản hồi",
    type: "Biểu đồ đường",
    description: "Biểu đồ đường hiển thị xu hướng phản hồi theo thời gian",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M19 17V9l-5 5-3-3-4 4" />
      </svg>
    )
  },
  {
    title: "So sánh khảo sát",
    type: "Biểu đồ cột",
    description: "Biểu đồ cột so sánh số lượng phản hồi giữa các khảo sát",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <rect x="7" y="8" width="3" height="8" />
        <rect x="12" y="5" width="3" height="11" />
        <rect x="17" y="10" width="3" height="6" />
      </svg>
    )
  }
];


const DEFAULT_PAGE_SIZE = 10;

const calculateRealStats = async (surveysData, metaData = null, responseCounts = {}) => {
  const totalSurveys = metaData?.total ?? surveysData.length;

  // Tính tổng phản hồi từ API response counts thay vì từ dữ liệu local
  const totalResponses = surveysData.reduce((sum, survey) => {
    const surveyId = survey.id || survey._id;
    const apiCount = responseCounts[surveyId] || 0;
    const fallbackCount = survey.responses || survey.responseCount || 0;
    return sum + apiCount + fallbackCount;
  }, 0);

  const activeSurveys = surveysData.filter((survey) => survey.status === "published").length;

  // Tính completion rate dựa trên API response counts
  const surveysWithResponses = surveysData.filter((survey) => {
    const surveyId = survey.id || survey._id;
    const apiCount = responseCounts[surveyId] || 0;
    const fallbackCount = survey.responses || survey.responseCount || 0;
    return (apiCount + fallbackCount) > 0;
  });

  const completionRate = totalSurveys > 0 ? Math.round((surveysWithResponses.length / totalSurveys) * 100) : 0;

  return {
    totalSurveys,
    totalResponses,
    activeSurveys,
    completionRate
  };
};

const KpiCard = ({ icon, label, value, accent, suffix }) => (
  <article className={`dash-kpi dash-kpi--${accent}`}>
    <span className="dash-kpi__icon" aria-hidden="true">
      <i className={icon} />
    </span>
    <div className="dash-kpi__content">
      <p>{label}</p>
      <strong>{typeof value === "number" ? value.toLocaleString("vi-VN") : value}{suffix}</strong>
    </div>
    <span className="dash-kpi__glow" aria-hidden="true" />
  </article>
);

const ChartCard = ({ title, type, description, icon }) => (
  <article className="dash-chart">
    <header className="dash-chart__header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="dash-chart__type">{type}</span>
    </header>
    <div className="dash-chart__placeholder">
      <span className="dash-chart__icon" aria-hidden="true">{icon}</span>
    </div>
  </article>
);

// Component biểu đồ phân bố trạng thái khảo sát
const StatusDistributionChart = ({ surveysData, loading }) => {
  // Tính toán phân bố trạng thái
  const statusDistribution = useMemo(() => {
    if (!surveysData || surveysData.length === 0) {
      return [];
    }

    const statusCounts = {
      published: 0,
      archived: 0,
      draft: 0,
    };

    surveysData.forEach((survey) => {
      const status = survey.status || "draft";
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      } else {
        statusCounts.draft++;
      }
    });

    const total = surveysData.length;
    const data = [
      {
        name: "Đang mở",
        value: statusCounts.published,
        count: statusCounts.published,
        percentage: total > 0 ? Math.round((statusCounts.published / total) * 100) : 0,
        color: "#22c55e", // green
      },
      {
        name: "Đã đóng",
        value: statusCounts.archived,
        count: statusCounts.archived,
        percentage: total > 0 ? Math.round((statusCounts.archived / total) * 100) : 0,
        color: "#ef4444", // red
      },
      {
        name: "Bản nháp",
        value: statusCounts.draft,
        count: statusCounts.draft,
        percentage: total > 0 ? Math.round((statusCounts.draft / total) * 100) : 0,
        color: "#3b82f6", // blue
      },
    ].filter((item) => item.value > 0); // Chỉ hiển thị các trạng thái có dữ liệu

    return data;
  }, [surveysData]);

  if (loading) {
    return (
      <article className="dash-chart">
        <header className="dash-chart__header">
          <div>
            <h3>Phân bố trạng thái khảo sát</h3>
            <p>Biểu đồ tròn hiển thị tỷ lệ khảo sát theo trạng thái</p>
          </div>
          <span className="dash-chart__type">Biểu đồ tròn</span>
        </header>
        <div className="dash-chart__placeholder">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
            <p>Đang tải dữ liệu...</p>
          </div>
        </div>
      </article>
    );
  }

  if (statusDistribution.length === 0) {
    return (
      <article className="dash-chart">
        <header className="dash-chart__header">
          <div>
            <h3>Phân bố trạng thái khảo sát</h3>
            <p>Biểu đồ tròn hiển thị tỷ lệ khảo sát theo trạng thái</p>
          </div>
          <span className="dash-chart__type">Biểu đồ tròn</span>
        </header>
        <div className="dash-chart__placeholder">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px', flexDirection: 'column', gap: '12px' }}>
            <span className="dash-chart__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8" />
                <path d="M12 8v8" />
              </svg>
            </span>
            <p style={{ margin: 0, color: 'rgba(15, 23, 42, 0.6)' }}>Chưa có dữ liệu khảo sát</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="dash-chart">
      <header className="dash-chart__header">
        <div>
          <h3>Phân bố trạng thái khảo sát</h3>
          <p>Biểu đồ tròn hiển thị tỷ lệ khảo sát theo trạng thái</p>
        </div>
        <span className="dash-chart__type">Biểu đồ tròn</span>
      </header>
      <div style={{ padding: '20px', minHeight: '280px' }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={statusDistribution}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={80}
              labelLine={false}
              label={({ name, percentage }) =>
                `${name}: ${percentage}%`
              }
            >
              {statusDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, props) => [
                `${props.payload.count} khảo sát (${props.payload.percentage}%)`,
                props.payload.name,
              ]}
            />
            <Legend
              formatter={(value, entry) => {
                const data = statusDistribution.find((d) => d.name === value);
                return `${value}: ${data?.count || 0} (${data?.percentage || 0}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
};

// Component biểu đồ xu hướng phản hồi
const ResponseTrendChart = ({ surveysData, loading }) => {
  const [trendData, setTrendData] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // Lấy dữ liệu xu hướng phản hồi
  useEffect(() => {
    const fetchTrendData = async () => {
      if (!surveysData || surveysData.length === 0 || loading) {
        setTrendData([]);
        return;
      }

      setLoadingTrend(true);
      try {
        // Lấy tất cả responses từ các surveys published
        const publishedSurveys = surveysData.filter(s => s.status === "published");

        if (publishedSurveys.length === 0) {
          setTrendData([]);
          setLoadingTrend(false);
          return;
        }

        // Lấy responses từ tất cả surveys (chỉ lấy summary với submittedAt)
        const allResponses = [];
        const promises = publishedSurveys.map(async (survey) => {
          try {
            const surveyId = survey.id || survey._id;
            if (!surveyId) return;

            // Lấy responses với size lớn để có đủ dữ liệu
            const responseData = await individualResponseService.listResponses(surveyId, {
              page: 0,
              size: 1000, // Lấy tối đa 1000 responses
              sort: 'submittedAt,desc'
            });

            const responses = responseData.result || [];
            responses.forEach(resp => {
              if (resp.submittedAt) {
                allResponses.push({
                  date: resp.submittedAt,
                  surveyId: surveyId
                });
              }
            });
          } catch (error) {
            console.error(`Error fetching responses for survey ${survey.id}:`, error);
          }
        });

        await Promise.all(promises);

        // Nhóm responses theo ngày (7 ngày gần nhất)
        const now = new Date();
        const days = 7;
        const dateMap = {};

        // Khởi tạo 7 ngày gần nhất với giá trị 0
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const dateKey = date.toISOString().split('T')[0];
          dateMap[dateKey] = 0;
        }

        // Đếm responses theo ngày
        allResponses.forEach(resp => {
          try {
            const responseDate = new Date(resp.date);
            responseDate.setHours(0, 0, 0, 0);
            const dateKey = responseDate.toISOString().split('T')[0];

            // Chỉ tính các ngày trong 7 ngày gần nhất
            if (dateMap.hasOwnProperty(dateKey)) {
              dateMap[dateKey]++;
            }
          } catch (error) {
            console.error('Error parsing date:', error);
          }
        });

        // Chuyển đổi thành mảng để hiển thị
        const trendArray = Object.keys(dateMap)
          .sort()
          .map(dateKey => {
            const date = new Date(dateKey);
            const day = date.getDate();
            const month = date.getMonth() + 1;
            return {
              date: `${day}/${month}`,
              fullDate: dateKey,
              count: dateMap[dateKey]
            };
          });

        setTrendData(trendArray);
      } catch (error) {
        console.error('Error fetching trend data:', error);
        setTrendData([]);
      } finally {
        setLoadingTrend(false);
      }
    };

    fetchTrendData();
  }, [surveysData, loading]);

  if (loading || loadingTrend) {
    return (
      <article className="dash-chart">
        <header className="dash-chart__header">
          <div>
            <h3>Xu hướng phản hồi</h3>
            <p>Biểu đồ đường hiển thị xu hướng phản hồi theo thời gian</p>
          </div>
          <span className="dash-chart__type">Biểu đồ đường</span>
        </header>
        <div className="dash-chart__placeholder">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
            <p>Đang tải dữ liệu...</p>
          </div>
        </div>
      </article>
    );
  }

  if (trendData.length === 0) {
    return (
      <article className="dash-chart">
        <header className="dash-chart__header">
          <div>
            <h3>Xu hướng phản hồi</h3>
            <p>Biểu đồ đường hiển thị xu hướng phản hồi theo thời gian</p>
          </div>
          <span className="dash-chart__type">Biểu đồ đường</span>
        </header>
        <div className="dash-chart__placeholder">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px', flexDirection: 'column', gap: '12px' }}>
            <span className="dash-chart__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M19 17V9l-5 5-3-3-4 4" />
              </svg>
            </span>
            <p style={{ margin: 0, color: 'rgba(15, 23, 42, 0.6)' }}>Chưa có dữ liệu phản hồi</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="dash-chart">
      <header className="dash-chart__header">
        <div>
          <h3>Xu hướng phản hồi</h3>
          <p>Biểu đồ đường hiển thị xu hướng phản hồi theo thời gian (7 ngày gần nhất)</p>
        </div>
        <span className="dash-chart__type">Biểu đồ đường</span>
      </header>
      <div style={{ padding: '20px', minHeight: '280px' }}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis
              dataKey="date"
              stroke="rgba(15, 23, 42, 0.6)"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="rgba(15, 23, 42, 0.6)"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              formatter={(value) => [`${value} phản hồi`, 'Số lượng']}
              labelFormatter={(label) => `Ngày: ${label}`}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                padding: '8px'
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
};

// Component biểu đồ so sánh khảo sát
const SurveyComparisonChart = ({ surveysData, responseCounts, loading }) => {
  // Tính toán dữ liệu so sánh
  const comparisonData = useMemo(() => {
    if (!surveysData || surveysData.length === 0 || !responseCounts) {
      return [];
    }

    // Lấy top 10 surveys có nhiều phản hồi nhất
    const surveysWithCounts = surveysData
      .map(survey => {
        const surveyId = String(survey.id || survey._id);
        const count = responseCounts[surveyId] || 0;
        return {
          name: survey.title || "Không tiêu đề",
          count: count,
          surveyId: surveyId,
          status: survey.status || "draft"
        };
      })
      .filter(item => item.count > 0) // Chỉ hiển thị surveys có phản hồi
      .sort((a, b) => b.count - a.count) // Sắp xếp giảm dần
      .slice(0, 10); // Lấy top 10

    return surveysWithCounts;
  }, [surveysData, responseCounts]);

  if (loading) {
    return (
      <article className="dash-chart">
        <header className="dash-chart__header">
          <div>
            <h3>So sánh khảo sát</h3>
            <p>Biểu đồ cột so sánh số lượng phản hồi giữa các khảo sát</p>
          </div>
          <span className="dash-chart__type">Biểu đồ cột</span>
        </header>
        <div className="dash-chart__placeholder">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
            <p>Đang tải dữ liệu...</p>
          </div>
        </div>
      </article>
    );
  }

  if (comparisonData.length === 0) {
    return (
      <article className="dash-chart">
        <header className="dash-chart__header">
          <div>
            <h3>So sánh khảo sát</h3>
            <p>Biểu đồ cột so sánh số lượng phản hồi giữa các khảo sát</p>
          </div>
          <span className="dash-chart__type">Biểu đồ cột</span>
        </header>
        <div className="dash-chart__placeholder">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px', flexDirection: 'column', gap: '12px' }}>
            <span className="dash-chart__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <rect x="7" y="8" width="3" height="8" />
                <rect x="12" y="5" width="3" height="11" />
                <rect x="17" y="10" width="3" height="6" />
              </svg>
            </span>
            <p style={{ margin: 0, color: 'rgba(15, 23, 42, 0.6)' }}>Chưa có dữ liệu phản hồi</p>
          </div>
        </div>
      </article>
    );
  }

  // Rút ngắn tên khảo sát nếu quá dài
  const formatName = (name) => {
    if (name.length > 20) {
      return name.substring(0, 20) + '...';
    }
    return name;
  };

  return (
    <article className="dash-chart">
      <header className="dash-chart__header">
        <div>
          <h3>So sánh khảo sát</h3>
          <p>Biểu đồ cột so sánh số lượng phản hồi giữa các khảo sát (Top {comparisonData.length})</p>
        </div>
        <span className="dash-chart__type">Biểu đồ cột</span>
      </header>
      <div style={{ padding: '20px', minHeight: '280px' }}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={comparisonData}
            margin={{ top: 5, right: 30, bottom: 60, left: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis
              type="category"
              dataKey="name"
              stroke="rgba(15, 23, 42, 0.6)"
              style={{ fontSize: '11px' }}
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fontSize: '10px' }}
              tickFormatter={formatName}
            />
            <YAxis
              type="number"
              stroke="rgba(15, 23, 42, 0.6)"
              style={{ fontSize: '12px' }}
              label={{ value: 'Số lượng phản hồi', angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: 'rgba(15, 23, 42, 0.6)', textAnchor: 'middle' } }}
            />
            <Tooltip
              formatter={(value) => [`${value} phản hồi`, 'Số lượng']}
              labelFormatter={(label) => `Khảo sát: ${label}`}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                padding: '8px'
              }}
            />
            <Bar
              dataKey="count"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            >
              {comparisonData.map((entry, index) => {
                // Màu sắc dựa trên số lượng phản hồi
                const maxCount = Math.max(...comparisonData.map(d => d.count));
                const ratio = entry.count / maxCount;
                let color = "#3b82f6"; // Mặc định xanh dương

                if (ratio >= 0.7) {
                  color = "#22c55e"; // Xanh lá - Nhiều phản hồi
                } else if (ratio >= 0.4) {
                  color = "#3b82f6"; // Xanh dương - Trung bình
                } else {
                  color = "#8b5cf6"; // Tím - Ít phản hồi
                }

                return (
                  <Cell key={`cell-${index}`} fill={color} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
};

const RecentSurveyItem = ({ survey, index, onOpen, responseCounts, loadingResponseCounts }) => {
  const statusLabel = survey.status === "published" ? "Đang mở" : survey.status === "archived" ? "Đã đóng" : "Bản nháp";
  const statusClass = survey.status || "draft";
  const createdDate = new Date(survey.createdAt || survey.created_at || Date.now()).toLocaleDateString("vi-VN");
  const totalResponses = responseCounts[survey.id || survey._id] ?? survey.responses ?? survey.responseCount ?? 0;

  return (
    <article className="dash-recent__item" key={survey.id || survey._id || index}>
      <div className="dash-recent__index">{index + 1}</div>
      <div className="dash-recent__info">
        <h4 className="dash-recent__title">{survey.title || "Không tiêu đề"}</h4>
        <div className="dash-recent__meta">
          <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
          <span className="dash-recent__date">{createdDate}</span>
          <span className="dash-recent__responses">
            {loadingResponseCounts ? (
              <span style={{ color: '#666' }}>...</span>
            ) : (
              totalResponses
            )} phản hồi
          </span>
        </div>
      </div>
      <button type="button" className="dash-recent__action" onClick={() => onOpen(survey)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Xem chi tiết
      </button>
    </article>
  );
};

const LoadingState = () => (
  <div className="dash-loading">
    <div className="dash-loading__spinner" />
    <p>Đang tải dữ liệu dashboard...</p>
  </div>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [overview, setOverview] = useState({
    totalSurveys: 0,
    totalResponses: 0,
    activeSurveys: 0,
    completionRate: 0
  });
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [responseCounts, setResponseCounts] = useState({});
  const [loadingResponseCounts, setLoadingResponseCounts] = useState(false);
  const [allSurveysForChart, setAllSurveysForChart] = useState([]);

  const displayName = user?.name || user?.username || user?.fullName || "User";

  // Lấy 5 khảo sát mới tạo gần đây nhất
  const recentSurveys = useMemo(() => {
    if (!allSurveysForChart || allSurveysForChart.length === 0) {
      return [];
    }

    // Sắp xếp theo ngày tạo (mới nhất trước)
    const sortedSurveys = [...allSurveysForChart].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at || 0);
      const dateB = new Date(b.createdAt || b.created_at || 0);
      return dateB - dateA; // Sắp xếp giảm dần (mới nhất trước)
    });

    // Lấy 5 khảo sát đầu tiên
    return sortedSurveys.slice(0, 5);
  }, [allSurveysForChart]);

  const openSurveyForEditing = useCallback(
    (survey) => navigate("/create-survey", { state: { editSurvey: survey } }),
    [navigate]
  );

  // Function to fetch response counts for surveys
  const fetchResponseCounts = useCallback(async (surveyList) => {
    if (!surveyList || surveyList.length === 0) {
      setResponseCounts({});
      return {};
    }

    setLoadingResponseCounts(true);
    try {
      const surveyIds = surveyList
        .filter(s => s.id || s._id)
        .map(s => s.id || s._id);

      if (surveyIds.length === 0) {
        setResponseCounts({});
        return {};
      }

      console.log('Dashboard: Fetching response counts for surveys:', surveyIds);
      const counts = await responseService.getMultipleResponseCounts(surveyIds);
      console.log('Dashboard: Received response counts:', counts);
      setResponseCounts(counts);
      return counts;
    } catch (error) {
      console.error('Dashboard: Error fetching response counts:', error);
      // Set fallback counts to 0
      const fallbackCounts = {};
      surveyList.forEach(survey => {
        const id = survey.id || survey._id;
        fallbackCounts[id] = 0;
      });
      setResponseCounts(fallbackCounts);
      return fallbackCounts;
    } finally {
      setLoadingResponseCounts(false);
    }
  }, []);

  // Function to fetch total response count from API
  const fetchTotalResponseCount = useCallback(async () => {
    try {
      console.log('Dashboard: Fetching total response count from API');
      const totalCount = await responseService.getTotalResponseCount();
      console.log('Dashboard: Received total response count:', totalCount);
      return totalCount;
    } catch (error) {
      console.error('Dashboard: Error fetching total response count:', error);
      return 0;
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const storedUser = (() => {
        try {
          return JSON.parse(localStorage.getItem("user")) || null;
        } catch (error) {
          return null;
        }
      })();
      if (storedUser) {
        setUser(storedUser);
      }

      const localSurveys = JSON.parse(localStorage.getItem("userSurveys") || "[]");

      let pageResponse = null;
      try {
        pageResponse = await surveyService.getSurveys(currentPage, pageSize);
      } catch (error) {
        console.log("Dashboard: API surveys failed, falling back to local cache");
      }

      let surveysForDisplay = [];
      let paginationMeta = { pages: 0, total: 0 };

      if (pageResponse?.meta) {
        surveysForDisplay = Array.isArray(pageResponse.result) ? pageResponse.result : [];
        paginationMeta = {
          pages: pageResponse.meta.pages || 0,
          total: pageResponse.meta.total || surveysForDisplay.length
        };
      } else if (Array.isArray(pageResponse?.result)) {
        surveysForDisplay = pageResponse.result;
        paginationMeta = {
          pages: 1,
          total: surveysForDisplay.length
        };
      } else if (Array.isArray(pageResponse)) {
        surveysForDisplay = pageResponse;
        paginationMeta = {
          pages: 1,
          total: surveysForDisplay.length
        };
      } else {
        const startIndex = currentPage * pageSize;
        const endIndex = startIndex + pageSize;
        surveysForDisplay = localSurveys.slice(startIndex, endIndex);
        paginationMeta = {
          pages: localSurveys.length ? Math.ceil(localSurveys.length / pageSize) : 0,
          total: localSurveys.length
        };
      }

      setSurveys(surveysForDisplay);
      setTotalPages(paginationMeta.pages);
      setTotalElements(paginationMeta.total);

      let surveysForStatistics = surveysForDisplay;
      if (pageResponse?.meta) {
        try {
          const allSurveysResponse = await surveyService.getSurveys(0, 1000);
          const allSurveys = Array.isArray(allSurveysResponse?.result)
            ? allSurveysResponse.result
            : Array.isArray(allSurveysResponse)
              ? allSurveysResponse
              : [];
          if (allSurveys.length > 0) {
            surveysForStatistics = allSurveys;
            setAllSurveysForChart(allSurveys); // Lưu tất cả surveys cho biểu đồ
          } else {
            setAllSurveysForChart(surveysForDisplay);
          }
        } catch (error) {
          console.log("Dashboard: Unable to fetch all surveys, using current page for statistics");
          setAllSurveysForChart(surveysForDisplay);
        }
      } else if (!pageResponse) {
        surveysForStatistics = localSurveys;
        setAllSurveysForChart(localSurveys);
      } else {
        setAllSurveysForChart(surveysForDisplay);
      }

      const [countsMap, apiTotalResponses] = await Promise.all([
        fetchResponseCounts(surveysForStatistics),
        fetchTotalResponseCount()
      ]);

      // Calculate stats with API total response count
      const stats = await calculateRealStats(
        surveysForStatistics,
        pageResponse?.meta || paginationMeta,
        countsMap || {}
      );

      // Override totalResponses with API value if available
      if (apiTotalResponses > 0) {
        stats.totalResponses = apiTotalResponses;
      }

      setOverview(stats);
    } catch (error) {
      console.error("Dashboard: Error loading data", error);
      console.error("Dashboard: Error details", error.response?.data);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, navigate, fetchResponseCounts, fetchTotalResponseCount]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCreateSurvey = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleModalOption = useCallback(
    (path) => {
      setShowCreateModal(false);
      navigate(path);
    },
    [navigate]
  );

  if (loading) {
    return (
      <div className="dashboard-shell">
        <HeaderComponent showUserInfo={true} />
        <Sidebar />
        {/* <main className="dashboard-main"> */}
        <LoadingState />
        {/* </main> */}
      </div>
    );
  }

  return (
    <MainLayout>
      <main className="dashboard-main">
        <section className="dash-hero">
          <div>
            <p className="dash-hero__eyebrow">SmartSurvey Insights</p>
            <h1>Xin chào {displayName}</h1>
            <p className="dash-hero__subtitle">Quản lý và phân tích khảo sát thông minh, trực quan và hiện đại.</p>
          </div>
          <div className="dash-hero__actions">
            <button type="button" className="dash-hero__btn dash-hero__btn--ghost" onClick={() => navigate("/surveys")}>
              Khảo sát của tôi
            </button>
            <button type="button" className="dash-hero__btn dash-hero__btn--primary" onClick={handleCreateSurvey}>
              <span aria-hidden="true">+</span> Tạo khảo sát mới
            </button>
          </div>
        </section>

        <section className="dash-metrics" aria-label="Tổng quan khảo sát">
          {METRIC_CARDS.map((card) => (
            <KpiCard
              key={card.key}
              icon={card.icon}
              label={card.label}
              value={overview[card.key] ?? 0}
              accent={card.accent}
              suffix={card.suffix || ""}
            />
          ))}
        </section>

        <section className="dash-charts" aria-label="Thống kê nhanh">
          <header className="dash-section__header">
            <h2>Thống kê nhanh</h2>
            <p>Cập nhật tổng quan trực quan để bạn sẵn sàng ra quyết định.</p>
          </header>
          <div className="dash-charts__grid">
            <StatusDistributionChart surveysData={allSurveysForChart} loading={loading} />
            <ResponseTrendChart surveysData={allSurveysForChart} loading={loading} />
            <SurveyComparisonChart
              surveysData={allSurveysForChart}
              responseCounts={responseCounts}
              loading={loading || loadingResponseCounts}
            />
          </div>
        </section>

        <section className="dash-recent" aria-label="Khảo sát gần đây">
          <header className="dash-section__header">
            <h2>Khảo sát gần đây</h2>
            <button type="button" className="dash-link" onClick={() => navigate("/surveys")}>
              Xem tất cả
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </header>
          <div className="dash-recent__list">
            {recentSurveys.length === 0 ? (
              <div className="dash-empty">
                <span className="dash-empty__icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
                    <path d="M9 3v4a2 2 0 0 0 2 2h4" />
                  </svg>
                </span>
                <p>Chưa có khảo sát nào. Hãy tạo khảo sát đầu tiên của bạn!</p>
              </div>
            ) : (
              recentSurveys.map((survey, index) => (
                <RecentSurveyItem
                  key={survey.id || survey._id || index}
                  survey={survey}
                  index={index}
                  onOpen={openSurveyForEditing}
                  responseCounts={responseCounts}
                  loadingResponseCounts={loadingResponseCounts}
                />
              ))
            )}
          </div>
        </section>

        {/* {totalElements > pageSize && (
          <div className="dash-pagination" role="navigation" aria-label="Phân trang khảo sát">
            <button type="button" className="dash-pagination__btn" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))} disabled={currentPage === 0}>
              Trước
            </button>
            <span className="dash-pagination__info">
              Trang {currentPage + 1} / {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              className="dash-pagination__btn"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.max(totalPages - 1, 0)))}
              disabled={currentPage >= Math.max(totalPages - 1, 0)}
            >
              Tiếp
            </button>
          </div>
        )} */}

        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
                aria-label="Đóng"
              >
                ×
              </button>
              <div className="modal-header">
                <h3>Chọn phương thức tạo khảo sát</h3>
                <p>Chọn phương thức tạo khảo sát phù hợp với nhu cầu của bạn</p>
              </div>
              <div className="modal-body">
                <div
                  className="create-option"
                  onClick={() => {
                    setShowCreateModal(false);
                    navigate('/create-ai');
                  }}
                >
                  <div className="option-icon ai">
                    <i className="fa-solid fa-robot" style={{ fontSize: '24px' }}></i>
                  </div>
                  <div className="option-title">Tạo bằng AI</div>
                  <p className="option-desc">
                    Sử dụng AI để tự động tạo khảo sát từ mô tả của bạn
                  </p>
                  <ul>
                    <li>Tự động tạo câu hỏi thông minh</li>
                    <li>Tiết kiệm thời gian</li>
                    <li>Đề xuất câu hỏi phù hợp</li>
                  </ul>
                  <button className="btn-primary small">
                    Tạo bằng AI
                  </button>
                </div>

                <div
                  className="create-option"
                  onClick={() => {
                    setShowCreateModal(false);
                    navigate('/create-survey');
                  }}
                >
                  <div className="option-icon manual">
                    <i className="fa-solid fa-pen-to-square" style={{ fontSize: '24px' }}></i>
                  </div>
                  <div className="option-title">Tạo thủ công</div>
                  <p className="option-desc">
                    Tự thiết kế và chỉnh sửa khảo sát theo ý muốn
                  </p>
                  <ul>
                    <li>Kiểm soát hoàn toàn</li>
                    <li>Tùy chỉnh chi tiết</li>
                    <li>Nhiều loại câu hỏi</li>
                  </ul>
                  <button className="btn-primary small">
                    Tạo thủ công
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <p className="note">Bạn có thể chuyển đổi giữa hai phương thức bất cứ lúc nào</p>
              </div>
            </div>
          </div>
        )}
      </main>

    </MainLayout>
  );
}