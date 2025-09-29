import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from "../../services/authService";
import './LoginPage.css';
import logoSmartSurvey from '../../assets/logoSmartSurvey.png';

const AuthNavButton = ({ label, onClick, variant = 'ghost' }) => (
    <button
        type="button"
        className={`auth-nav-btn auth-nav-btn--${variant}`}
        onClick={onClick}
    >
        {label}
    </button>
);

const FormField = ({ label, type, placeholder, value, onChange, disabled }) => (
    <label className="auth-form-field">
        <span className="auth-form-label">{label}</span>
        <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            required
            disabled={disabled}
            autoComplete={type === 'password' ? 'current-password' : 'email'}
        />
    </label>
);

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const formFields = useMemo(() => ([
        {
            id: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'Nhập email của bạn',
            value: email,
            onChange: (e) => setEmail(e.target.value)
        },
        {
            id: 'password',
            label: 'Mật khẩu',
            type: 'password',
            placeholder: 'Nhập mật khẩu',
            value: password,
            onChange: (e) => setPassword(e.target.value)
        }
    ]), [email, password]);

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
                navigate('/dashboard');
            } else {
                setError('Đăng nhập thất bại: Không nhận được token từ server!');
            }
        } catch (err) {
            console.error('Login error:', err);
            if (err.response?.data?.message) {
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

    const navigateTo = (path) => () => navigate(path);

    return (
        <div className="login-page">
            <div className="login-background"></div>
            <div className="login-shape login-shape--one" aria-hidden="true"></div>
            <div className="login-shape login-shape--two" aria-hidden="true"></div>

            <header className="auth-header">
                <div className="auth-logo" role="button" tabIndex={0} onClick={navigateTo('/home')} onKeyDown={(e) => (e.key === 'Enter') && navigateTo('/home')()}>
                    <img className="auth-logo__img" src={logoSmartSurvey} alt="SmartSurvey" />
                </div>
                <nav className="auth-nav">
                    <AuthNavButton label="Đăng nhập" onClick={navigateTo('/login')} variant="ghost" />
                    <AuthNavButton label="Đăng kí" onClick={navigateTo('/register')} variant="solid" />
                </nav>
            </header>

            <main className="auth-main">
                <section className="auth-card" aria-labelledby="login-title">
                    <div className="auth-card__header">
                        <div className="auth-card__logo-wrapper">
                            <span className="auth-card__logo-glow" aria-hidden="true"></span>
                            <span className="auth-card__logo-ring" aria-hidden="true"></span>
                            <img className="auth-card__logo" src={logoSmartSurvey} alt="SmartSurvey" />
                        </div>
                        <h1 id="login-title">Đăng nhập</h1>
                        <p>Chào mừng bạn quay trở lại SmartSurvey</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form" noValidate>
                        {formFields.map((field) => (
                            <FormField
                                key={field.id}
                                label={field.label}
                                type={field.type}
                                placeholder={field.placeholder}
                                value={field.value}
                                onChange={field.onChange}
                                disabled={isLoading}
                            />
                        ))}

                        <div className="auth-form__options">
                            <label className="auth-remember">
                                <input type="checkbox" />
                                <span>Ghi nhớ đăng nhập</span>
                            </label>
                            <button type="button" className="auth-link" onClick={navigateTo('/forgot-password')}>
                                Quên mật khẩu?
                            </button>
                        </div>

                        {error && <p className="auth-error" role="alert">{error}</p>}

                        <button type="submit" className="auth-submit" disabled={isLoading}>
                            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                            <span className="auth-submit__glow" aria-hidden="true" />
                        </button>
                    </form>

                    <p className="auth-footer-text">
                        Chưa có tài khoản?
                        <button type="button" className="auth-link auth-link--inline" onClick={navigateTo('/register')}>
                            Đăng ký ngay
                        </button>
                    </p>
                </section>
            </main>
        </div>
    );
};

export default Login;
