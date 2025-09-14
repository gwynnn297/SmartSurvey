import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HeaderComponent from "../../components/HeaderComponent";
import SurveyViewer from "../../components/Survey/SurveyViewer";
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
  const [showSurveyViewer, setShowSurveyViewer] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🏠 Dashboard: Starting to load data...');

        const storedUser = (() => {
          try {
            return JSON.parse(localStorage.getItem("user")) || null;
          } catch (e) {
            return null;
          }
        })();
        if (storedUser) {
          setUser(storedUser);
          console.log('👤 Dashboard: User loaded:', storedUser);
        }

        // Check token before making API calls
        const token = localStorage.getItem('token');
        console.log('🔑 Dashboard: Token check:', token ? 'Found' : 'Not found');

        console.log('📊 Dashboard: Calling getDashboardOverview...');
        const overviewRes = await apiService.getDashboardOverview();
        console.log('✅ Dashboard: Overview response:', overviewRes);

        console.log('📋 Dashboard: Calling getSurveys...');
        const surveysRes = await apiService.getSurveys({ page: 1, limit: 10 });
        console.log('✅ Dashboard: Surveys response:', surveysRes);

        // Load surveys from localStorage
        const localSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
        console.log('📋 Dashboard: Local surveys:', localSurveys);

        setOverview({
          totalSurveys: localSurveys.length,
          totalResponses: localSurveys.reduce((sum, s) => sum + (s.responses || 0), 0),
          activeSurveys: localSurveys.filter(s => s.status === 'active').length,
          completionRate: localSurveys.length > 0 ? 75 : 0 // Mock completion rate
        });

        // Use local surveys if available, otherwise use API response
        const list = localSurveys.length > 0 ? localSurveys : (Array.isArray(surveysRes?.items) ? surveysRes.items : (Array.isArray(surveysRes) ? surveysRes : []));
        setSurveys(list);
        console.log('🎉 Dashboard: Data loaded successfully');
      } catch (error) {
        console.error('❌ Dashboard: Error loading data:', error);
        console.error('❌ Dashboard: Error details:', error.response?.data);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const displayName = user?.name || user?.username || user?.email || "User";

  const handleViewSurvey = (survey) => {
    // Sử dụng câu hỏi thực sự từ localStorage hoặc mock nếu không có
    const surveyQuestions = survey.questions || [];

    // Nếu không có câu hỏi thực sự, hiển thị thông báo
    if (surveyQuestions.length === 0) {
      alert('Khảo sát này chưa có câu hỏi nào. Vui lòng tạo câu hỏi trước.');
      return;
    }

    setSelectedSurvey({
      ...survey,
      questions: surveyQuestions
    });
    setShowSurveyViewer(true);
  };

  const handleUpdateSurveyQuestions = (updatedQuestions) => {
    if (selectedSurvey) {
      const updatedSurvey = { ...selectedSurvey, questions: updatedQuestions };
      setSelectedSurvey(updatedSurvey);

      // Update in localStorage
      const updatedSurveys = surveys.map(s =>
        s.id === selectedSurvey.id
          ? { ...s, questionsCount: updatedQuestions.length, questions: updatedQuestions }
          : s
      );
      setSurveys(updatedSurveys);
      localStorage.setItem('userSurveys', JSON.stringify(updatedSurveys));
    }
  };

  const handleSaveSurveyChanges = async (updatedQuestions) => {
    try {
      if (selectedSurvey) {
        // Update in localStorage
        const updatedSurveys = surveys.map(s =>
          s.id === selectedSurvey.id
            ? { ...s, questionsCount: updatedQuestions.length, questions: updatedQuestions }
            : s
        );
        setSurveys(updatedSurveys);
        localStorage.setItem('userSurveys', JSON.stringify(updatedSurveys));

        // Update selectedSurvey state
        const updatedSurvey = { ...selectedSurvey, questions: updatedQuestions };
        setSelectedSurvey(updatedSurvey);

        console.log('Survey changes saved successfully');
      }
    } catch (error) {
      console.error('Error saving survey changes:', error);
      throw error; // Re-throw để SurveyViewer có thể handle
    }
  };

  const createSampleSurvey = () => {
    const sampleQuestions = [
      {
        id: 1,
        question_text: "Bạn có hài lòng với dịch vụ của chúng tôi không?",
        question_type: "multiple_choice",
        is_required: true,
        options: [
          { option_text: "Rất hài lòng" },
          { option_text: "Hài lòng" },
          { option_text: "Bình thường" },
          { option_text: "Không hài lòng" }
        ]
      },
      {
        id: 2,
        question_text: "Bạn có muốn giới thiệu dịch vụ cho người khác không?",
        question_type: "boolean",
        is_required: true
      },
      {
        id: 3,
        question_text: "Vui lòng chia sẻ thêm ý kiến của bạn:",
        question_type: "open_ended",
        is_required: false
      },
      {
        id: 4,
        question_text: "Đánh giá tổng thể về dịch vụ (1-5 sao):",
        question_type: "rating",
        is_required: true
      }
    ];

    const sampleSurvey = {
      id: Date.now(),
      title: "Khảo sát mẫu - Dịch vụ khách hàng",
      description: "Đây là khảo sát mẫu để test chức năng xem khảo sát với câu hỏi thực sự",
      status: 'active',
      createdAt: new Date().toISOString(),
      responses: 0,
      questionsCount: sampleQuestions.length,
      questions: sampleQuestions
    };

    const existingSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
    existingSurveys.unshift(sampleSurvey);
    localStorage.setItem('userSurveys', JSON.stringify(existingSurveys));

    // Reload surveys
    setSurveys(existingSurveys);
    setOverview(prev => ({
      ...prev,
      totalSurveys: existingSurveys.length,
      activeSurveys: existingSurveys.filter(s => s.status === 'active').length
    }));

    alert('Đã tạo khảo sát mẫu thành công!');
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
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Tạo khảo sát mới</button>
              <button className="btn-secondary" onClick={createSampleSurvey}>🧪 Tạo khảo sát mẫu</button>
            </div>
          </div>
          <div className="survey-list">
            {surveys.length === 0 && (
              <div className="empty">Chưa có khảo sát nào.</div>
            )}
            {surveys.map((s) => (
              <div className="survey-item" key={s.id || s._id}>
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
                  <button className="btn-text" onClick={() => handleViewSurvey(s)}>
                    👁️ Xem
                  </button>
                  <button className="btn-text" onClick={() => alert('Chức năng báo cáo sẽ được phát triển')}>
                    📊 Báo cáo
                  </button>
                  <button className="btn-text" onClick={() => {
                    const updatedSurveys = surveys.filter(survey => survey.id !== s.id);
                    localStorage.setItem('userSurveys', JSON.stringify(updatedSurveys));
                    setSurveys(updatedSurveys);
                  }}>
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

        {/* Survey Viewer Modal */}
        {showSurveyViewer && selectedSurvey && (
          <SurveyViewer
            surveyData={selectedSurvey}
            questions={selectedSurvey.questions || []}
            onClose={() => {
              setShowSurveyViewer(false);
              setSelectedSurvey(null);
            }}
            onUpdateQuestions={handleUpdateSurveyQuestions}
            onSaveChanges={handleSaveSurveyChanges}
          />
        )}
      </div>
    </div>
  );
}
