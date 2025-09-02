import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from "../../services/authService";
import './LoginPage.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const data = await login(email, password);

            // reqres.in trả về token trong data.token
            if (data.token) {
                localStorage.setItem('token', data.token);
                // Tạo thông tin user tối thiểu để hiển thị trên Header/Dashboard
                const derivedName = email?.split('@')[0] || 'User';
                const userObject = { name: derivedName, email };
                localStorage.setItem('user', JSON.stringify(userObject));
                navigate('/dashboard');
            } else {
                setError('Đăng nhập thất bại: Không nhận được token!');
            }
        } catch (err) {
            console.error('Login error:', err);
            if (err.response?.data?.error) {
                setError(`Đăng nhập thất bại: ${err.response.data.error}`);
            } else {
                setError('Đăng nhập thất bại! Vui lòng kiểm tra email và mật khẩu.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = () => {
        navigate("/login");
    };

    const handleRegister = () => {
        navigate("/register");
    };
    const handleHome = () => {
        navigate("/home");
    };
    return (
        <div className="login-container">
            {/* Header */}
            <header className="header">
                <div className="logo">
                    <div className="logo-icon">S</div>
                    <span onClick={handleHome}>SmartSurvey</span>
                </div>
                <div className="header-buttons">
                    <button className="btn-login" onClick={handleLogin}>
                        Đăng nhập
                    </button>
                    <button className="btn-register" onClick={handleRegister}>
                        Đăng kí
                    </button>
                </div>
            </header>

            <div className="login-content">
                <div className="login-card">
                    <div className="login-header">
                        <div className="avatar">👤</div>
                        <h2>Đăng Nhập</h2>
                        <p>Chào mừng bạn quay trở lại SmartSurvey</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="Nhập email của bạn"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                        />

                        <label>Mật khẩu</label>
                        <input
                            type="password"
                            placeholder="Nhập mật khẩu"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />

                        <div className="login-options">
                            <label>
                                <input type="checkbox" /> Ghi nhớ đăng nhập
                            </label>
                            <a href="#">Quên mật khẩu?</a>
                        </div>

                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                        </button>
                    </form>

                    {error && <p className="error">{error}</p>}

                    {/* <div className="divider">hoặc</div>

                    <button className="btn-google" disabled={isLoading}>Đăng nhập với Google</button>
                    <button className="btn-facebook" disabled={isLoading}>Đăng nhập với Facebook</button> */}

                    <p className="register-text">
                        Chưa có tài khoản? <a href="/register">Đăng ký ngay</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
