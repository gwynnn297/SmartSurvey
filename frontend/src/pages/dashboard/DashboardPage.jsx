import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import HeaderComponent from "../../components/HeaderComponent";
import "./DashboardPage.css";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    surveysCreated: 0,
    totalResponses: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Lấy thông tin user từ localStorage
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

        // Sử dụng thống kê mặc định
        setStats({
          surveysCreated: 0,
          totalResponses: 0,
          completionRate: 0
        });

      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  const displayName = user?.name || user?.username || user?.email || "User";

  const handleLogout = () => {
    logout();
    navigate("/login");
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
          <h1>Xin chào, {displayName}!</h1>
          <p>Chào mừng bạn đến với SmartSurvey Dashboard</p>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <h3>Khảo sát đã tạo</h3>
              <span className="stat-number">{stats.surveysCreated}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-info">
              <h3>Phản hồi nhận được</h3>
              <span className="stat-number">{stats.totalResponses}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <h3>Tỷ lệ hoàn thành</h3>
              <span className="stat-number">{stats.completionRate}%</span>
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
