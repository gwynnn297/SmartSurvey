import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Xóa token trong môi trường development để tránh lỗi khi dev/test
if (import.meta.env.MODE === "development") {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  console.log("🧹 Development mode: Cleared stored tokens");
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
