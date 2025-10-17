import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import HomePage from "./pages/home/HomePage";
import LoginPage from "./pages/login/LoginPage";
import Register from "./pages/register/Register";
import Dashboard from "./pages/dashboard/DashboardPage";
import SurveyListPage from "./pages/Survey/SurveyListPage";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import CreateAI from "./pages/Survey/CreateAI";
import CreateSurvey from "./pages/Survey/CreateSurvey";
import Profile from "./pages/Profile/Profile";
import ChangePassword from "./pages/ChangePassword/ChangePassword";
// import './lib/fontawesome';
import '@fortawesome/fontawesome-free/css/all.min.css';
import DashboardReportPage from "./pages/report/DashboardReportPage";
import SentimentPage from "./pages/report/SentimentPage";
import ExportReportPage from "./pages/report/ExportReportPage";
import DetailsStatisticPage from "./pages/report/DetailsStatisticPage";
import ResponseFormPage from "./pages/Response/ResponseFormPage";
import PublicResponsePage from "./pages/Response/PublicResponsePage";
import ShareSurveyPage from "./pages/Survey/ShareSurveyPage";
import ViewLinkSharePage from "./pages/Response/ViewLinkSharePage";
import OpenFeedbackPage from "./pages/report/OpenFeedbackPage";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

function ProtectedHomeRoute({ children }) {
  const token = localStorage.getItem("token");
  // Nếu đã đăng nhập, chuyển về dashboard
  // Nếu chưa đăng nhập, hiển thị trang chủ
  return token ? <Navigate to="/dashboard" /> : children;
}

function ResponsePreviewRoute() {
  const location = useLocation();
  const survey = location.state?.survey;
  if (!survey) {
    return <Navigate to="/dashboard" />;
  }
  return <ResponseFormPage survey={survey} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />   {/* Dùng LoginPage */}
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} /> {/* Thêm forgot */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/surveys"
          element={
            <PrivateRoute>
              <SurveyListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/create-ai"
          element={
            <PrivateRoute>
              <CreateAI />
            </PrivateRoute>
          }
        />
        <Route
          path="/create-survey"
          element={
            <PrivateRoute>
              <CreateSurvey />
            </PrivateRoute>
          }
        />
        <Route
          path="/survey/create"
          element={
            <PrivateRoute>
              <CreateSurvey />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            <PrivateRoute>
              <ChangePassword />
            </PrivateRoute>
          }
        />
        <Route
          path="/report/export"
          element={
            <PrivateRoute>
              <ExportReportPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/report/details-statistic"
          element={
            <PrivateRoute>
              <DetailsStatisticPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/report/sentiment"
          element={
            <PrivateRoute>
              <SentimentPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/report/open-feedback"
          element={
            <PrivateRoute>
              <OpenFeedbackPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/report"
          element={
            <PrivateRoute>
              <DashboardReportPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/response-preview"
          element={
            <PrivateRoute>
              <ResponsePreviewRoute />
            </PrivateRoute>
          }
        />
        <Route
          path="/share-survey"
          element={
            <PrivateRoute>
              <ShareSurveyPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/view-link-share/:surveyId"
          element={
            <PrivateRoute>
              <ViewLinkSharePage />
            </PrivateRoute>
          }
        />
        {/* Public response routes for participants */}
        <Route path="/response/:id" element={<PublicResponsePage />} />
        <Route path="/response/:surveyId" element={<PublicResponsePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
