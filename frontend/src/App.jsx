import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/home/HomePage";
import LoginPage from "./pages/login/LoginPage";
import Register from "./pages/register/Register";
import Dashboard from "./pages/dashboard/DashboardPage";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import CreateAI from "./pages/createsurvey/CreateAI";
import CreateSurvey from "./pages/createsurvey/CreateSurvey";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
