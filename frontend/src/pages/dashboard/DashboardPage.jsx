import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HeaderComponent from "../../components/HeaderComponent";
import { apiService } from "../../services/apiService";
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

        const [overviewRes, surveysRes] = await Promise.all([
          apiService.getDashboardOverview(),
          apiService.getSurveys({ page: 1, limit: 10 })
        ]);

        setOverview({
          totalSurveys: Number(overviewRes?.totalSurveys) || 0,
          totalResponses: Number(overviewRes?.totalResponses) || 0,
          activeSurveys: Number(overviewRes?.activeSurveys) || 0,
          completionRate: Number(overviewRes?.completionRate) || 0
        });
        const list = Array.isArray(surveysRes?.items) ? surveysRes.items : (Array.isArray(surveysRes) ? surveysRes : []);
        setSurveys(list);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const displayName = user?.name || user?.username || user?.email || "User";

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
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Tạo khảo sát mới</button>
          </div>
          <div className="survey-list">
            {surveys.length === 0 && (
              <div className="empty">Chưa có khảo sát nào.</div>
            )}
            {surveys.map((s) => (
              <div className="survey-item" key={s.id || s._id}>
                <div className="survey-left">
                  <div className={`status-badge ${s.status || 'draft'}`}>
                    {s.status === 'active' ? 'Đang hoạt động' : s.status === 'closed' ? 'Đã đóng' : 'Nháp'}
                  </div>
                  <div className="survey-title">{s.title || 'Không tiêu đề'}</div>
                  <div className="survey-meta">
                    <span>{new Date(s.createdAt || s.created_at || Date.now()).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{(s.responses ?? s.responseCount ?? 0)} phản hồi</span>
                  </div>
                </div>
                <div className="survey-right">
                  <button className="btn-text">Xem</button>
                  <button className="btn-text">Báo cáo</button>
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