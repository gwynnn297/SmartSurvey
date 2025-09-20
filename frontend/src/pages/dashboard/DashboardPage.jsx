import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HeaderComponent from "../../components/HeaderComponent";
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

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🏠 Dashboard: Starting to load data...');

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
          console.log('👤 Dashboard: User loaded from localStorage:', storedUser);
        }

        // Check token before making API calls
        const token = localStorage.getItem('token');
        console.log('🔑 Dashboard: Token check:', token ? 'Found' : 'Not found');

        // Load surveys from localStorage first
        const localSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
        console.log('📋 Dashboard: Local surveys:', localSurveys);

        // Try to get data from API
        let apiOverview = null;
        let apiSurveys = null;

        try {
          console.log('📊 Dashboard: Calling getDashboardOverview...');
          apiOverview = await surveyService.getDashboardOverview();
          console.log('✅ Dashboard: Overview response:', apiOverview);
        } catch (error) {
          console.log('⚠️ Dashboard: API overview failed, using local data');
        }

        try {
          console.log('📋 Dashboard: Calling getSurveys...');
          apiSurveys = await surveyService.getSurveys(0, 10);
          console.log('✅ Dashboard: Surveys response:', apiSurveys);
        } catch (error) {
          console.log('⚠️ Dashboard: API surveys failed, using local data');
        }

        // Set overview data (prefer API, fallback to local)
        if (apiOverview) {
          setOverview({
            totalSurveys: apiOverview.totalSurveys || localSurveys.length,
            totalResponses: apiOverview.totalResponses || localSurveys.reduce((sum, s) => sum + (s.responses || 0), 0),
            activeSurveys: apiOverview.activeSurveys || localSurveys.filter(s => s.status === 'active').length,
            completionRate: apiOverview.completionRate || (localSurveys.length > 0 ? 75 : 0)
          });
        } else {
          setOverview({
            totalSurveys: localSurveys.length,
            totalResponses: localSurveys.reduce((sum, s) => sum + (s.responses || 0), 0),
            activeSurveys: localSurveys.filter(s => s.status === 'active').length,
            completionRate: localSurveys.length > 0 ? 75 : 0
          });
        }

        // Set surveys data (prefer API, fallback to local)
        let surveysList = [];
        if (apiSurveys) {
          // Backend trả về { meta: {...}, result: [...] }
          surveysList = Array.isArray(apiSurveys?.result) ? apiSurveys.result :
            Array.isArray(apiSurveys) ? apiSurveys : localSurveys;
        } else {
          surveysList = localSurveys;
        }

        setSurveys(surveysList);
        console.log('🎉 Dashboard: Data loaded successfully');
      } catch (error) {
        console.error('Dashboard: Error loading data:', error);
        console.error('Dashboard: Error details:', error.response?.data);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const displayName = user?.name || user?.username || user?.fullName || "User";

  const handleViewSurvey = (survey) => {
    alert('Chức năng xem khảo sát sẽ được phát triển');
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="loading">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <HeaderComponent showUserInfo={true} />
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div className="header-texts">
            <h1>Xin chào, {displayName}</h1>
            <p>Quản lý và phân tích khảo sát một cách thông minh</p>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon kpi-blue">📋</div>
            <div className="kpi-info">
              <h3>Tổng Khảo sát</h3>
              <span className="kpi-number">{overview.totalSurveys}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon kpi-green">🗳️</div>
            <div className="kpi-info">
              <h3>Tổng Phản hồi</h3>
              <span className="kpi-number">{overview.totalResponses}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon kpi-orange">✅</div>
            <div className="kpi-info">
              <h3>Đang hoạt động</h3>
              <span className="kpi-number">{overview.activeSurveys}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon kpi-purple">📈</div>
            <div className="kpi-info">
              <h3>Tỉ lệ hoàn thành</h3>
              <span className="kpi-number">{overview.completionRate}%</span>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h2>Danh sách khảo sát:</h2>
            <div className="dashboard-actions">
              {/* <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Tạo khảo sát mới</button> */}
              <button className="btn-createsurvey" onClick={() => setShowCreateModal(true)}>+ Tạo khảo sát mới</button>
            </div>
          </div>
          <div className="survey-list">
            {surveys.length === 0 && (
              <div className="empty">Chưa có khảo sát nào.</div>
            )}
            {surveys.map((s) => (
              <div
                className="survey-item"
                key={s.id || s._id}
                onClick={() => navigate('/create-survey', { state: { editSurvey: s } })}
                style={{ cursor: 'pointer' }}
              >
                <div className="survey-left">
                  <div className={`status-badge ${s.status || 'draft'}`}>
                    {s.status === 'active' ? '🟢 Đang hoạt động' : s.status === 'closed' ? '🔴 Đã đóng' : '📝 Nháp'}
                  </div>
                  <div className="survey-title">{s.title || 'Không tiêu đề'}</div>
                  {s.description && (
                    <div className="survey-description">{s.description}</div>
                  )}
                  <div className="survey-meta">
                    <span>📅 {new Date(s.createdAt || s.created_at || Date.now()).toLocaleDateString('vi-VN')}</span>
                    <span>•</span>
                    <span>💬 {s.responses ?? s.responseCount ?? 0} phản hồi</span>
                    {s.questionsCount && (
                      <>
                        <span>•</span>
                        <span>❓ {s.questionsCount} câu hỏi</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="survey-right">

                  <button
                    className="btn-text"
                    onClick={(e) => {
                      e.stopPropagation();
                      alert('Chức năng báo cáo sẽ được phát triển');
                    }}
                  >
                    📊 Báo cáo
                  </button>
                  <button
                    className="btn-text"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm('Bạn có chắc muốn xóa khảo sát này không?')) {
                        try {
                          // Gọi API xóa trên backend
                          await surveyService.deleteSurvey(s.id);

                          // Xóa trong localStorage và state để cập nhật UI
                          const updatedSurveys = surveys.filter(survey => survey.id !== s.id);
                          localStorage.setItem('userSurveys', JSON.stringify(updatedSurveys));
                          setSurveys(updatedSurveys);

                          alert('Đã xóa khảo sát thành công!');
                        } catch (error) {
                          console.error('Lỗi khi xóa khảo sát:', error);
                          alert('Xóa khảo sát thất bại. Vui lòng thử lại.');
                        }
                      }
                    }}
                  >
                    🗑️ Xóa
                  </button>

                </div>
              </div>
            ))}
          </div>
        </div>
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              {/* === NÚT X ĐÃ ĐƯỢC THÊM VÀO ĐÂY === */}
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>&times;</button>
              <div className="modal-header">
                <h3>Bạn muốn bắt đầu như thế nào?</h3>
                <p>Chọn phương thức tạo khảo sát phù hợp với nhu cầu của bạn</p>
              </div>
              <div className="modal-body">
                <div className="create-option" onClick={() => { setShowCreateModal(false); navigate('/create-ai'); }}>
                  <div className="option-icon ai">⚡</div>
                  <div className="option-title">Tạo bằng AI</div>
                  <ul>
                    <li>Tiết kiệm thời gian</li>
                    <li>Gợi ý câu hỏi thông minh</li>
                    <li>Tối ưu mục tiêu</li>
                  </ul>
                  <button className="btn-primary small">Bắt đầu ngay</button>
                </div>
                <div className="create-option" onClick={() => { setShowCreateModal(false); navigate('/create-survey'); }}>
                  <div className="option-icon manual">✍️</div>
                  <div className="option-title">Tạo thủ công</div>
                  <ul>
                    <li>Kiểm soát hoàn toàn</li>
                    <li>Tùy chỉnh chi tiết</li>
                    <li>Thiết kế theo ý muốn</li>
                  </ul>
                  <button className="btn-primary outlined small">Bắt đầu ngay</button>
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
