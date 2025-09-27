import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HeaderComponent from "../../components/HeaderComponent";
import Sidebar from "../../components/Sidebar";
import { surveyService } from "../../services/surveyService";
import "./DashboardPage.css";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize] = useState(10);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Lấy user từ localStorage
        const storedUser = (() => {
          try {
            return JSON.parse(localStorage.getItem("user")) || null;
          } catch (e) {
            return null;
          }
        })();
        if (storedUser) {
          setUser(storedUser);
        }

        // Check token before making API calls
        const token = localStorage.getItem('token');
        // Load surveys from localStorage first
        const localSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
        // Try to get data from API
        let apiOverview = null;
        let apiSurveys = null;
        try {
          apiOverview = await surveyService.getDashboardOverview();
        } catch (error) {
          console.log('Dashboard: API overview failed, using local data');
        }

        try {
          apiSurveys = await surveyService.getSurveys(currentPage, pageSize);
        } catch (error) {
          console.log('Dashboard: API surveys failed, using local data');
        }
        // Calculate real statistics from actual data
        const calculateRealStats = (surveysData, metaData = null) => {
          let totalSurveys, totalResponses, activeSurveys, completionRate;
          if (metaData) {
            // Use meta data for accurate total count
            totalSurveys = metaData.total || 0;
          } else {
            totalSurveys = surveysData.length;
          }

          totalResponses = surveysData.reduce((sum, s) => sum + (s.responses || s.responseCount || 0), 0);
          activeSurveys = surveysData.filter(s => s.status === 'published').length;

          // Calculate completion rate based on surveys with responses
          const surveysWithResponses = surveysData.filter(s => (s.responses || s.responseCount || 0) > 0);
          completionRate = totalSurveys > 0 ? Math.round((surveysWithResponses.length / totalSurveys) * 100) : 0;

          return {
            totalSurveys,
            totalResponses,
            activeSurveys,
            completionRate
          };
        };

        // Use real data from API or local storage
        let finalSurveysData = [];
        let metaData = null;

        if (apiSurveys) {
          if (apiSurveys.meta) {
            metaData = apiSurveys.meta;
            // Try to get all surveys from API for detailed stats
            try {
              const allSurveysResponse = await surveyService.getSurveys(0, 1000);
              finalSurveysData = Array.isArray(allSurveysResponse?.result) ? allSurveysResponse.result : [];
            } catch (error) {
              console.log('Could not fetch all surveys, using current page data');
              finalSurveysData = surveysList;
            }
          } else {
            finalSurveysData = surveysList;
          }
        } else {
          finalSurveysData = localSurveys;
        }

        const realStats = calculateRealStats(finalSurveysData, metaData);
        setOverview(realStats);

        // Set surveys data (prefer API, fallback to local)
        let surveysList = [];
        if (apiSurveys) {
          // Backend trả về { meta: {...}, result: [...] }
          if (apiSurveys.meta) {
            // Có thông tin phân trang từ API
            surveysList = Array.isArray(apiSurveys.result) ? apiSurveys.result : [];
            setTotalPages(apiSurveys.meta.pages || 0);
            setTotalElements(apiSurveys.meta.total || 0);
          } else {
            // Không có thông tin phân trang, xử lý như cũ
            surveysList = Array.isArray(apiSurveys?.result) ? apiSurveys.result :
              Array.isArray(apiSurveys) ? apiSurveys : localSurveys;
            setTotalPages(1);
            setTotalElements(surveysList.length);
          }
        } else {
          // Fallback to local data with pagination
          const startIndex = currentPage * pageSize;
          const endIndex = startIndex + pageSize;
          surveysList = localSurveys.slice(startIndex, endIndex);
          setTotalPages(Math.ceil(localSurveys.length / pageSize));
          setTotalElements(localSurveys.length);
        }

        setSurveys(surveysList);
      } catch (error) {
        console.error('Dashboard: Error loading data:', error);
        console.error('Dashboard: Error details:', error.response?.data);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentPage, pageSize]);

  const displayName = user?.name || user?.username || user?.fullName || "User";

  const handleViewSurvey = (survey) => {
    alert('Chức năng xem khảo sát sẽ được phát triển');
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };


  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="loading">
            <div className="loading-spinner"></div>
            <span>Đang tải...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <HeaderComponent showUserInfo={true} />
      <Sidebar />

      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="dashboard-content">
        <div className="dashboard-header">
          <div className="header-texts">
            <h1>Xin chào, {displayName}</h1>
            <p>Quản lý và phân tích khảo sát một cách thông minh</p>
          </div>
        </div>

        <div className="stats-sections">
          <section className="stats-block">
            <div className="kpi-card kpi-card-1">
              <i class="fa-solid fa-table-list" title="Tổng khảo sát"></i>
              <div className="kpi-info">
                <h3>Tổng Khảo sát</h3>
                <span className="kpi-number">{overview.totalSurveys}</span>
              </div>
            </div>
          </section>

          <section className="stats-block">
            <div className="kpi-card kpi-card-2">
              <i class="fa-solid fa-list" title="Tổng phản hồi"></i>
              <div className="kpi-info">
                <h3>Tổng Phản hồi</h3>
                <span className="kpi-number">{overview.totalResponses}</span>
              </div>
            </div>
          </section>

          <section className="stats-block">
            <div className="kpi-card kpi-card-3">
              <i class="fa-solid fa-hexagon-nodes" title="Đang hoạt động"></i>
              <div className="kpi-info">
                <h3>Đang hoạt động</h3>
                <span className="kpi-number">{overview.activeSurveys}</span>
              </div>
            </div>
          </section>

          <section className="stats-block">
            <div className="kpi-card kpi-card-4">
              <i class="fa-solid fa-chart-line" title="Tỉ lệ hoàn thành"></i>
              <div className="kpi-info">
                <h3>Tỉ lệ hoàn thành</h3>
                <span className="kpi-number">{overview.completionRate}%</span>
              </div>
            </div>
          </section>
        </div>

        {/* Quick Charts Section */}
        <div className="charts-section">
          <div className="section">
            <div className="section-header">
              <h2>Thống kê nhanh</h2>
            </div>
            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-header">
                  <h3>Phân bố trạng thái khảo sát</h3>
                  <div className="chart-type">Biểu đồ tròn</div>
                </div>
                <div className="chart-placeholder">
                  <div className="chart-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8" />
                      <path d="M12 8v8" />
                    </svg>
                  </div>
                  <p>Biểu đồ tròn hiển thị tỷ lệ khảo sát theo trạng thái</p>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <h3>Xu hướng phản hồi</h3>
                  <div className="chart-type">Biểu đồ đường</div>
                </div>
                <div className="chart-placeholder">
                  <div className="chart-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18" />
                      <path d="M19 17V9l-5 5-3-3-4 4" />
                    </svg>
                  </div>
                  <p>Biểu đồ đường hiển thị xu hướng phản hồi theo thời gian</p>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <h3>So sánh khảo sát</h3>
                  <div className="chart-type">Biểu đồ cột</div>
                </div>
                <div className="chart-placeholder">
                  <div className="chart-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <rect x="7" y="8" width="3" height="8" />
                      <rect x="12" y="5" width="3" height="11" />
                      <rect x="17" y="10" width="3" height="6" />
                    </svg>
                  </div>
                  <p>Biểu đồ cột so sánh số lượng phản hồi giữa các khảo sát</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Surveys Section */}
        <div className="recent-surveys-section">
          <div className="section">
            <div className="section-header">
              <h2>5 khảo sát gần đây</h2>
              <button className="btn-view-all" onClick={() => navigate('/surveys')}>
                Xem tất cả
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <div className="recent-surveys-list">
              {surveys.slice(0, 5).length === 0 ? (
                <div className="empty-recent">
                  <div className="empty-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
                      <path d="M9 3v4a2 2 0 0 0 2 2h4" />
                    </svg>
                  </div>
                  <span>Chưa có khảo sát nào.</span>
                </div>
              ) : (
                surveys.slice(0, 5).map((survey, index) => (
                  <div key={survey.id || survey._id} className="recent-survey-item">
                    <div className="survey-number">{index + 1}</div>
                    <div className="survey-info">
                      <div className="survey-title">{survey.title || 'Không tiêu đề'}</div>
                      <div className="survey-meta">
                        <span className={`status-badge ${survey.status || 'draft'}`}>
                          {survey.status === 'published' ? 'Đã xuất bản' : survey.status === 'archived' ? 'Đã lưu trữ' : 'Bản nháp'}
                        </span>
                        <span className="survey-date">
                          {new Date(survey.createdAt || survey.created_at || Date.now()).toLocaleDateString('vi-VN')}
                        </span>
                        <span className="survey-responses">
                          {survey.responses ?? survey.responseCount ?? 0} phản hồi
                        </span>
                      </div>
                    </div>
                    <div className="survey-actions">
                      <button
                        className="btn-view"
                        onClick={() => navigate('/create-survey', { state: { editSurvey: survey } })}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Xem
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

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
                  <div className="option-icon ai" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  </div>
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
                  <div className="option-icon manual" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                  </div>
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

      </div>
    </div>
  );
}