import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../../services/authService';
import './Register.css';
import logoSmartSurvey from '../../assets/logoSmartSurvey.png';
const Register = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password !== formData.confirmPassword) {
            setError('Mật khẩu xác nhận không khớp!');
            return;
        }

        setIsLoading(true);
        try {
            const response = await register(
                formData.fullName,
                formData.email,
                formData.password
            );

            if (response?.token) {
                setSuccess('Đăng ký thành công! Đang chuyển đến trang đăng nhập...');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            } else {
                setError('Đăng ký thất bại: API không trả dữ liệu hợp lệ!');
            }
        } catch (err) {
            console.error("Register page error:", err);

            setError(err.message || "Đăng ký thất bại! Vui lòng kiểm tra lại thông tin.");

            // Reset password để nhập lại
            setFormData((prev) => ({
                ...prev,
                password: '',
                confirmPassword: ''
            }));

            setIsLoading(false); // mở lại input để nhập tiếp
        }
    };




    const handleLogin = () => {
        navigate('/login');
    };
    const handleRegister = () => {
        navigate("/register");
    };
    const handleHome = () => {
        navigate("/home");
    };
    return (
        <div className="register-container">
            {/* Header */}
            <header className="header">
                <div className="logo" >
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

            <div className="register-content">
                <div className="register-card">
                    <div className="register-header">
                        <img className="logo-smart-survey" src={logoSmartSurvey} alt="logoSmartSurvey" />
                        <h2>Đăng Ký</h2>
                        <p>Tạo tài khoản mới để bắt đầu sử dụng SmartSurvey</p>
                    </div>

                    <form onSubmit={handleSubmit} className="register-form">
                        <div className="form-group">
                            <label>Họ và tên</label>
                            <input
                                type="text"
                                name="fullName"
                                placeholder="Nhập họ và tên của bạn"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                placeholder="Nhập email của bạn"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Mật khẩu</label>
                            <input
                                type="password"
                                name="password"
                                placeholder="Nhập mật khẩu"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Xác nhận mật khẩu</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                placeholder="Nhập lại mật khẩu"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button type="submit" className="btn-dangky" disabled={isLoading || success}>
                            {isLoading ? 'Đang đăng ký...' : success ? 'Đang chuyển trang...' : 'Đăng Ký'}
                        </button>
                    </form>

                    {error && <p className="error">{error}</p>}
                    {success && <p className="success">{success}</p>}

                    {/* <div className="divider">hoặc</div>

                    <button className="btn-google" disabled={isLoading}>Đăng ký với Google</button>
                    <button className="btn-facebook" disabled={isLoading}>Đăng ký với Facebook</button> */}

                    <p className="login-text">
                        Chưa có tài khoản? <a href="/login">Đăng nhập ngay</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;    