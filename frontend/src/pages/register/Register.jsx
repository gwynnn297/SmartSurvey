import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../../services/authService';
import './Register.css';

const Register = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
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

        if (response?.msg) {
            setIsLoading(false);
            alert("Đăng ký thành công!"); // Hoặc dùng setSuccess nếu bạn muốn hiện trong giao diện
            navigate('/login');
        } else {
            setIsLoading(false);
            setError('Đăng ký thất bại: API không trả dữ liệu hợp lệ!');
        }
    } catch (err) {
        setIsLoading(false);
        if (err.response?.data?.error) {
            setError(`Đăng ký thất bại: ${err.response.data.error}`);
        } else if (err.message) {
            setError(`Lỗi: ${err.message}`);
        } else {
            setError('Đăng ký thất bại! Vui lòng kiểm tra lại thông tin.');
        }
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

            <div className="register-content">
                <div className="register-card">
                    <div className="register-header">
                        <div className="avatar">👤</div>
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

                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'Đang đăng ký...' : 'Đăng Ký'}
                        </button>
                    </form>

                    {error && <p className="error">{error}</p>}

                    {/* <div className="divider">hoặc</div>

                    <button className="btn-google" disabled={isLoading}>Đăng ký với Google</button>
                    <button className="btn-facebook" disabled={isLoading}>Đăng ký với Facebook</button> */}

                    <p className="login-text">
                        Đã có tài khoản? <button onClick={handleLogin} className="link-button">Đăng nhập ngay</button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
