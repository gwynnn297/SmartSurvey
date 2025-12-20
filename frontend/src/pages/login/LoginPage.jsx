import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from "../../services/authService";
import './LoginPage.css';
import logoSmartSurvey from '../../assets/logoSmartSurvey.png';
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

            const token = data.token;
            if (token) {
                localStorage.setItem('token', token);

                const userInfo = {
                    name: data.fullName || email?.split('@')[0] || 'User',
                    email: data.email,
                    id: data.id,
                    role: data.role
                };
                localStorage.setItem('user', JSON.stringify(userInfo));

                console.log('Login successful, token saved:', token);
                // Redirect admin to admin page, others to dashboard
                if (data.role === 'admin') {
                    navigate('/admin');
                } else {
                    navigate('/dashboard');
                }
            } else {
                console.warn('No token field in response. Raw data:', data);
                setError('Đăng nhập thất bại: Không nhận được token từ server!');
            }
        } catch (err) {
            console.error('Login error:', err);

            // Lấy thông báo lỗi từ các nguồn khác nhau
            const errorMessage = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message || '';

            // Kiểm tra nếu là lỗi tài khoản bị vô hiệu hóa
            const isAccountDeactivated = errorMessage.toLowerCase().includes('vô hiệu hóa') ||
                errorMessage.toLowerCase().includes('bị vô hiệu hóa') ||
                errorMessage.toLowerCase().includes('deactivated') ||
                errorMessage.toLowerCase().includes('tài khoản của bạn đã bị vô hiệu hóa');

            // Kiểm tra nếu là lỗi sai tài khoản/mật khẩu
            const isBadCredentials = errorMessage.toLowerCase().includes('bad credentials') ||
                errorMessage.toLowerCase().includes('sai thông tin đăng nhập') ||
                errorMessage.toLowerCase().includes('tài khoản hoặc mật khẩu') ||
                (err.response?.status === 401 && !isAccountDeactivated);

            if (isAccountDeactivated) {
                setError('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
            } else if (isBadCredentials) {
                setError('Email hoặc mật khẩu không chính xác!');
            } else if (err.response?.data?.message) {
                setError(`Đăng nhập thất bại: ${err.response.data.message}`);
            } else if (err.response?.data?.error) {
                setError(`Đăng nhập thất bại: ${err.response.data.error}`);
            } else if (err.message) {
                setError(`Lỗi kết nối: ${err.message}`);
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

    const handleForgotPassword = () => {
        navigate("/forgot-password");
    };

    return (
        <div className="login-container">
            {/* Header */}
            <header className="header">
                <div className="logo">
                    <img onClick={handleHome} className="logo-smart-survey" src={logoSmartSurvey} alt="logoSmartSurvey" />
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
                        <img className="logo-smart-survey" src={logoSmartSurvey} alt="logoSmartSurvey" />
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
                            <button
                                type="button"
                                className="link-button"
                                onClick={handleForgotPassword}
                            >
                                Quên mật khẩu?
                            </button>
                        </div>

                        <button type="submit" className="btn-dangnhap" disabled={isLoading}>
                            {isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                        </button>
                    </form>

                    {error && <p className="error">{error}</p>}

                    <p className="register-text">
                        Chưa có tài khoản? <a href="/register">Đăng ký ngay</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;