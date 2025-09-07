// src/pages/ForgotPassword/ForgotPassword.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ForgotPassword.css"; 
const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("http://localhost:8080/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setMessage("✅ Vui lòng kiểm tra email để đặt lại mật khẩu.");
      } else {
        const data = await res.json();
        setMessage(`❌ Lỗi: ${data.message || "Không thể gửi email."}`);
      }
    } catch (err) {
      setMessage("❌ Lỗi kết nối server.");
    }
  };

  return (
    <div className="forgot-container">
      <h2>Quên mật khẩu</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Nhập email của bạn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Gửi yêu cầu</button>
        <button type="button" onClick={() => navigate("/login")}>
          Quay lại đăng nhập
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default ForgotPassword;
