import React from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";
import logoSmartSurvey from '../../assets/logoSmartSurvey.png';
const HomePage = () => {
    const navigate = useNavigate();

    const handleLogin = () => {
        navigate("/login");
    };

    const handleRegister = () => {
        navigate("/register");
    };

    return (
        <div className="home-container">
            {/* Header */}
            <header className="header">
                <div className="logo">
                <img className="logo-smart-survey" src={logoSmartSurvey} alt="logoSmartSurvey" />
                </div>
                <nav className="nav">
                    <a href="#features">Tính năng</a>
                    <a href="#how-it-works">Cách hoạt động</a>
                    <a href="#contact">Liên hệ</a>
                </nav>
                <div className="header-buttons">
                    <button className="btn-login" onClick={handleLogin}>
                        Đăng nhập
                    </button>
                    <button className="btn-register" onClick={handleRegister}>
                        Đăng kí
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <h1>Tạo khảo sát thông minh. Thấu hiểu dữ liệu dễ dàng.</h1>
                    <p>
                        Sử dụng AI để tạo câu hỏi, phân tích cảm xúc và trích xuất insight từ cuộc trò chuyện.
                        Không cần kinh nghiệm chuyên môn, chỉ cần mô tả mục tiêu của bạn.
                    </p>
                    <button className="btn-primary" onClick={handleRegister}>
                        Bắt đầu miễn phí ngay
                    </button>

                    <div className="hero-features">
                        <div className="hero-feature">
                            <span className="feature-icon">✓</span>
                            <span>Miễn phí vĩnh viễn</span>
                        </div>
                        <div className="hero-feature">
                            <span className="feature-icon">✓</span>
                            <span>Không cần thẻ tín dụng</span>
                        </div>
                        <div className="hero-feature">
                            <span className="feature-icon">✓</span>
                            <span>Hỗ trợ 24/7</span>
                        </div>
                    </div>
                </div>
                <div className="hero-image">
                    <div className="mockup">
                        <div className="mockup-header">
                            <h3>Tạo khảo sát thông minh AI</h3>
                        </div>
                        <div className="mockup-content">
                            <div className="question-list">
                                <div className="question-item">Bạn có hài lòng với dịch vụ?</div>
                                <div className="question-item">Bạn có muốn giới thiệu cho người khác?</div>
                                <div className="question-item">Điểm đánh giá từ 1-10?</div>
                            </div>
                            <div className="results">
                                <div className="result-item">
                                    <span className="result-number">247</span>
                                    <span className="result-label">Phản hồi</span>
                                </div>
                                <div className="result-item">
                                    <span className="result-number">94%</span>
                                    <span className="result-label">Hài lòng</span>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: '94%' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose SmartSurvey */}
            <section id="features" className="why-choose">
                <h2>Tại sao chọn SmartSurvey?</h2>
                <div className="feature-cards">
                    <div className="feature-card">
                        <div className="feature-icon"><i className="fa-solid fa-bolt" title="Tiết kiệm thời gian tạo khảo sát với AI"></i></div>
                        <h3>Tiết kiệm thời gian tạo khảo sát với AI</h3>
                        <ul>
                            <li>Tạo câu hỏi tự động với AI</li>
                            <li>Phân tích dữ liệu thông minh</li>
                            <li>Gợi ý cải thiện liên tục</li>
                            <li>Tiết kiệm đến 80% thời gian</li>
                        </ul>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"><i className="fa-regular fa-chart-bar" title="Phân tích sâu, không cần chuyên gia"></i></div>
                        <h3>Phân tích sâu, không cần chuyên gia</h3>
                        <ul>
                            <li>Phân tích tự động các loại dữ liệu</li>
                            <li>Nhận diện xu hướng và pattern</li>
                            <li>Phân tích cảm xúc và chủ đề</li>
                            <li>Không cần chuyên gia dữ liệu</li>
                        </ul>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"><i className="fa-regular fa-lightbulb" title="Tìm kiếm insight bằng cách trò chuyện"></i></div>
                        <h3>Tìm kiếm insight bằng cách trò chuyện</h3>
                        <ul>
                            <li>AI trò chuyện tự nhiên</li>
                            <li>Hỏi đáp bằng ngôn ngữ tự nhiên</li>
                            <li>Insight thời gian thực</li>
                            <li>Khuyến nghị có thể thực hiện</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="how-it-works">
                <h2>Hoạt động như thế nào?</h2>
                <div className="steps">
                    <div className="step">
                        <div className="step-number">1</div>
                        <h3>Tạo Khảo sát</h3>
                        <p>Tạo khảo sát với AI, template có sẵn và tùy chỉnh theo ý muốn</p>
                        <div className="step-mockup">
                            <div className="mini-survey">Bạn có hài lòng với dịch vụ?</div>
                        </div>
                    </div>
                    <div className="step">
                        <div className="step-number">2</div>
                        <h3>Thu thập Phản hồi</h3>
                        <p>Thu thập phản hồi qua email, mạng xã hội hoặc nhúng vào website</p>
                        <div className="step-mockup">
                            <div className="channels">
                                <span><i className="fa-brands fa-google" title="Email"></i> Email</span>
                                <span><i className="fa-solid fa-comment" title="SMS"></i> SMS</span>
                                <span><i className="fa-solid fa-square-phone-flip" title="Zalo"></i> Zalo</span>
                                <span><i className="fa-brands fa-facebook" title="Facebook"></i> Facebook</span>
                                <span><i className="fa-solid fa-qrcode" title="QR code"></i> QR code</span>
                            </div>
                        </div>
                    </div>
                    <div className="step">
                        <div className="step-number">3</div>
                        <h3>Thấu hiểu Dữ liệu</h3>
                        <p>Phân tích dữ liệu bằng AI, tạo báo cáo và insight chuyên nghiệp</p>
                        <div className="step-mockup">
                            <div className="mini-chart">
                                <div className="chart-bar" style={{ height: '60px' }}></div>
                                <div className="chart-bar" style={{ height: '80px' }}></div>
                                <div className="chart-bar" style={{ height: '40px' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="cta-content">
                    <h2>Sẵn sàng để đưa việc khảo sát lên một tầm cao mới?</h2>
                    <p>Tham gia cùng hàng nghìn người đã tin tưởng SmartSurvey để thu thập và phân tích dữ liệu thông minh.</p>
                    <div className="cta-buttons">
                        <button className="btn-trial" onClick={handleRegister}>
                            <span className="btn-icon"><i className="fa-solid fa-bolt" title="Đăng ký trải nghiệm miễn phí ngay"></i></span>
                            Đăng ký trải nghiệm miễn phí ngay
                        </button>
                        <button className="btn-consult">
                            Liên hệ tư vấn
                        </button>
                    </div>
                    <div className="cta-features">
                        <span>Dùng thử 30 ngày miễn phí</span>
                        <span>Bảo mật tuyệt đối</span>
                        <span>Hỗ trợ 24/7</span>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-left">
                        <div className="footer-logo">
                            <div className="logo-icon">S</div>
                            <span>SmartSurvey</span>
                        </div>
                        <p>Nền tảng khảo sát thông minh giúp doanh nghiệp thu thập và phân tích dữ liệu một cách hiệu quả.</p>
                        <div className="social-icons">
                            <span><i className="fa-brands fa-facebook" title="Facebook"></i></span>
                            <span><i className="fa-brands fa-google" title="Google"></i></span>
                            <span><i className="fa-brands fa-apple" title="Apple"></i></span>
                        </div>
                    </div>
                    <div className="footer-right">
                        <div className="footer-links">
                            <h4>Liên kết</h4>
                            <a href="#features">Tính năng</a>
                            <a href="#community">Cộng đồng</a>
                            <a href="#solutions">Giải pháp</a>
                            <a href="#blog">Blog</a>
                        </div>
                        <div className="footer-links">
                            <h4>Pháp lý</h4>
                            <a href="#terms">Điều khoản sử dụng</a>
                            <a href="#privacy">Chính sách bảo mật</a>
                            <a href="#contact">Liên hệ</a>
                            <a href="#support">Hỗ trợ</a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>© 2025 SmartSurvey. Tất cả quyền được bảo lưu.</p>
                </div>
            </footer>
        </div>
    );
};

export default HomePage;
