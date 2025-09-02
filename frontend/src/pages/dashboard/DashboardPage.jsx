import React from "react";
import { useNavigate } from "react-router-dom";
import HeaderComponent from "../../components/HeaderComponent";
import { logout } from "../../services/authService";
import "./DashboardPage.css";

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch (e) {
      return null;
    }
  })();

  const displayName = user?.name || user?.username || user?.email || "User";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="dashboard-container">
      <HeaderComponent showUserInfo={true} />

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1>Xin chào, {displayName}!</h1>
          <p>Chào mừng bạn đến với SmartSurvey Dashboard</p>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <h3>Khảo sát đã tạo</h3>
              <span className="stat-number">12</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-info">
              <h3>Phản hồi nhận được</h3>
              <span className="stat-number">247</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <h3>Tỷ lệ hoàn thành</h3>
              <span className="stat-number">94%</span>
            </div>
          </div>
        </div>

        <div className="dashboard-actions">
          <button className="btn-create-survey">
            <span className="btn-icon">➕</span>
            Tạo khảo sát mới
          </button>
          <button className="btn-view-reports">
            <span className="btn-icon">📋</span>
            Xem báo cáo
          </button>
          <button className="btn-view-reports" onClick={handleLogout}>
            <span className="btn-icon">↩</span>
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
