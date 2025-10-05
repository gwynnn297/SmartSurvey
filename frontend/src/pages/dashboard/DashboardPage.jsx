import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderComponent from "../../components/HeaderComponent";
import Sidebar from "../../components/Sidebar";
import MainLayout from "../../layouts/MainLayout";
import { surveyService } from "../../services/surveyService";
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

const calculateRealStats = (surveysData, metaData = null) => {
  const totalSurveys = metaData?.total ?? surveysData.length;
  const totalResponses = surveysData.reduce((sum, survey) => sum + (survey.responses || survey.responseCount || 0), 0);
  const activeSurveys = surveysData.filter((survey) => survey.status === "published").length;
  const surveysWithResponses = surveysData.filter((survey) => (survey.responses || survey.responseCount || 0) > 0);
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

const RecentSurveyItem = ({ survey, index, onOpen }) => {
  const statusLabel = survey.status === "published" ? "Đã xuất bản" : survey.status === "archived" ? "Đã lưu trữ" : "Bản nháp";
  const statusClass = survey.status || "draft";
  const createdDate = new Date(survey.createdAt || survey.created_at || Date.now()).toLocaleDateString("vi-VN");
  const totalResponses = survey.responses ?? survey.responseCount ?? 0;

  return (
    <article className="dash-recent__item" key={survey.id || survey._id || index}>
      <div className="dash-recent__index">{index + 1}</div>
      <div className="dash-recent__info">
        <h4 className="dash-recent__title">{survey.title || "Không tiêu đề"}</h4>
        <div className="dash-recent__meta">
          <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
          <span className="dash-recent__date">{createdDate}</span>
          <span className="dash-recent__responses">{totalResponses} phản hồi</span>
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

  const displayName = user?.name || user?.username || user?.fullName || "User";

  const recentSurveys = useMemo(() => surveys.slice(0, 5), [surveys]);

  const openSurveyForEditing = useCallback(
    (survey) => navigate("/create-survey", { state: { editSurvey: survey } }),
    [navigate]
  );

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
          }
        } catch (error) {
          console.log("Dashboard: Unable to fetch all surveys, using current page for statistics");
        }
      } else if (!pageResponse) {
        surveysForStatistics = localSurveys;
      }

      const stats = calculateRealStats(surveysForStatistics, pageResponse?.meta || paginationMeta);
      setOverview(stats);
    } catch (error) {
      console.error("Dashboard: Error loading data", error);
      console.error("Dashboard: Error details", error.response?.data);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, navigate]);

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
            {CHART_PLACEHOLDERS.map((chart) => (
              <ChartCard key={chart.title} {...chart} />
            ))}
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
                <RecentSurveyItem key={survey.id || survey._id || index} survey={survey} index={index} onOpen={openSurveyForEditing} />
              ))
            )}
          </div>
        </section>

        {totalElements > pageSize && (
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
        )}

        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>&times;</button>
              <div className="modal-header">
                <h3>Bạn muốn bắt đầu như thế nào?</h3>
                <p>Chọn phương thức tạo khảo sát phù hợp với nhu cầu của bạn</p>
              </div>
              <div className="modal-body">
                <div className="create-option" onClick={() => { setShowCreateModal(false); navigate('/create-ai'); }}>
                  <i className="fa-brands fa-discord" title="Tạo bằng AI" style={{ fontSize: '40px', color: '#6699FF', marginBottom: '15px' }}></i>
                  <div className="option-title">Tạo bằng AI</div>
                  <p className="option-desc">Mô tả ý tưởng của bạn, AI sẽ tự động tạo một bản nháp khảo sát để bạn bắt đầu.</p>
                  <ul>
                    <li>Tiết kiệm thời gian</li>
                    <li>Gợi ý câu hỏi thông minh</li>
                    <li>Tối ưu mục tiêu</li>
                  </ul>
                  <button className="btn-primary small">Bắt đầu ngay</button>
                </div>
                <div className="create-option" onClick={() => { setShowCreateModal(false); navigate('/create-survey'); }}>
                  <i className="fa-solid fa-pen-to-square" title="Tạo thủ công" style={{ fontSize: '40px', color: '#999999', marginBottom: '15px' }}></i>
                  <div className="option-title">Tạo thủ công</div>
                  <p className="option-desc">Tự tay xây dựng khảo sát từ đầu để toàn quyền kiểm soát mọi câu hỏi và chi tiết.</p>
                  <ul>
                    <li>Kiểm soát hoàn toàn</li>
                    <li>Tùy chỉnh chi tiết</li>
                    <li>Thiết kế theo ý muốn</li>
                  </ul>
                  <button className="btn-primary small">Bắt đầu ngay</button>
                </div>
              </div>
              <div className="modal-footer">
                <p className="note">Lưu ý: Bạn có thể chỉnh sửa và tùy chỉnh khảo sát sau khi tạo bằng cả hai phương thức.</p>
              </div>
            </div>
          </div>
        )}
      </main>

    </MainLayout>
  );
}