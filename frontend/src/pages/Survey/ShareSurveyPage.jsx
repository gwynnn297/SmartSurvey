import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import "./ShareSurveyPage.css";
import { QRCodeCanvas } from "qrcode.react";
import { surveyService } from "../../services/surveyService";
import { questionService } from "../../services/questionSurvey";
import { generateUniqueToken } from "../../utils/tokenGenerator";

const ShareSurveyPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const passedSurvey = location.state?.survey;
    const passedSurveyId = location.state?.surveyId || passedSurvey?.id;

    const [survey, setSurvey] = useState({
        id: passedSurveyId || passedSurvey?.id || null,
        title: passedSurvey?.title || "",
        description: passedSurvey?.description || "",
        startDate: passedSurvey?.createdAt
            ? new Date(passedSurvey.createdAt).toLocaleDateString("vi-VN")
            : "",
        startTime: passedSurvey?.createdAt
            ? new Date(passedSurvey.createdAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
            })
            : "",
        totalQuestions: Array.isArray(passedSurvey?.questions)
            ? passedSurvey.questions.length
            : 0,
        status: passedSurvey?.status || "",
        link: passedSurvey?.shareLink || "",
    });

    const [loading, setLoading] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
    const [isClosingSurvey, setIsClosingSurvey] = useState(false);
    const settingsMenuRef = useRef(null);

    useEffect(() => {
        const load = async () => {
            const id = passedSurveyId;
            if (!id) {
                navigate("/dashboard");
                return;
            }
            try {
                setLoading(true);
                const detail = await surveyService.getSurveyById(id);
                const createdAt = new Date(detail.createdAt || detail.created_at || Date.now());
                const startDate = createdAt.toLocaleDateString("vi-VN");
                const startTime = createdAt.toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                });

                let totalQuestions = survey.totalQuestions;
                try {
                    const questions = await questionService.getQuestionsBySurvey(id);
                    totalQuestions = Array.isArray(questions)
                        ? questions.length
                        : questions?.length ?? 0;
                } catch (_) { }

                const token = generateUniqueToken();

                // ✅ Đổi từ "k" sang "respondentToken"
                const shareLink =
                    detail.shareLink ||
                    survey.link ||
                    `${window.location.origin}/response/${id}?${token}`;

                try {
                    if (!detail.shareLink) {
                        await surveyService.updateSurvey(id, { shareLink });
                    }
                } catch (_) { }

                setSurvey({
                    id,
                    title: detail.title || "",
                    description: detail.description || "",
                    startDate,
                    startTime,
                    totalQuestions,
                    status: detail.status || "",
                    link: shareLink,
                });
            } catch (err) {
                console.error("ShareSurveyPage: load error", err);
                alert("Không tải được thông tin khảo sát.");
                navigate("/dashboard");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(survey.link);
        alert("Đã sao chép liên kết khảo sát!");
    };

    const handleGenerateNewLink = async () => {
        try {
            setLoading(true);
            const id = survey.id;
            const newToken = generateUniqueToken();

            // ✅ Đổi URL chứa respondentToken
            const newShareLink = `${window.location.origin}/response/${id}?${newToken}`;

            setSurvey((prev) => ({
                ...prev,
                link: newShareLink,
            }));

            try {
                await surveyService.updateSurvey(id, { shareLink: newShareLink });
            } catch (error) {
                console.warn("Could not update shareLink on backend:", error);
            }

            alert("Đã tạo liên kết mới với token khác!");
        } catch (error) {
            console.error("Error generating new link:", error);
            alert("Có lỗi khi tạo liên kết mới!");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
                setIsSettingsMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const statusMeta = useMemo(() => {
        const map = {
            published: {
                label: "Đang mở",
                className: "status-active",
                dotColor: "#22c55e"
            },
            draft: {
                label: "Bản nháp",
                className: "status-draft",
                dotColor: "#d97706"
            },
            archived: {
                label: "Đã đóng",
                className: "status-archived",
                dotColor: "#6b7280"
            }
        };
        return map[survey.status] || {
            label: survey.status || "Không xác định",
            className: "status-unknown",
            dotColor: "#6b7280"
        };
    }, [survey.status]);

    const toggleSettingsMenu = () => {
        setIsSettingsMenuOpen((prev) => !prev);
    };

    const openCloseSurveyModal = () => {
        setIsSettingsMenuOpen(false);
        setIsSettingsOpen(true);
    };

    const handleCloseSurvey = async () => {
        if (!survey.id) return;
        try {
            setIsClosingSurvey(true);
            const updated = await surveyService.updateSurvey(survey.id, { status: "archived" });
            setSurvey((prev) => ({
                ...prev,
                status: updated?.status || "archived"
            }));
            alert("Khảo sát đã được đóng. Người tham gia sẽ không thể gửi phản hồi mới.");
            setIsSettingsOpen(false);
        } catch (error) {
            console.error("Error closing survey:", error);
            alert("Không thể đóng khảo sát. Vui lòng thử lại sau.");
        } finally {
            setIsClosingSurvey(false);
        }
    };

    const closeCloseSurveyModal = () => setIsSettingsOpen(false);

    return (
        <MainLayout>
            <div className="share-survey-container">
                <div className="share-survey-header">
                    <div className="share-survey-information">
                        <div className="share-survey-title-row">
                            <h1>{survey.title || (loading ? "Đang tải..." : "")}</h1>
                            {survey.status && (
                                <div className={`share-survey-status ${statusMeta.className}`}>
                                    <span
                                        className="share-status-dot"
                                        style={{ backgroundColor: statusMeta.dotColor }}
                                    />
                                    <span>{statusMeta.label}</span>
                                </div>
                            )}
                        </div>
                        <p>{survey.description}</p>
                        <div className="share-survey-info">
                            <p>
                                <b>Tạo ngày:</b> {survey.startDate} &nbsp; | &nbsp;
                                <b>Kích hoạt:</b> {survey.startDate} lúc {survey.startTime} &nbsp; | &nbsp;
                                <b>{survey.totalQuestions}</b> câu hỏi
                            </p>
                        </div>
                    </div>

                    <div className="share-survey-actions">
                        <div className="settings-menu" ref={settingsMenuRef}>
                            <button
                                className={`dropdown-toggle settings-toggle ${isSettingsMenuOpen ? "open" : ""}`}
                                onClick={toggleSettingsMenu}
                                type="button"
                                aria-haspopup="true"
                                aria-expanded={isSettingsMenuOpen}
                            >
                                <span className="settings-toggle__icon" aria-hidden="true">⚙</span>
                                <span>Cài đặt</span>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            {isSettingsMenuOpen && (
                                <div className="settings-dropdown" role="menu">
                                    <div
                                        className="dropdown-item"
                                        role="menuitem"
                                        onClick={openCloseSurveyModal}
                                    >
                                        <i className="fa-solid fa-xmark" title="Đóng khảo sát"></i>
                                        Đóng khảo sát
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            className="btn-outline"
                            onClick={() => {
                                setIsSettingsMenuOpen(false);
                                navigate("/create-survey", {
                                    state: {
                                        editSurvey: {
                                            id: survey.id,
                                            title: survey.title,
                                            description: survey.description,
                                            status: survey.status,
                                        },
                                    },
                                });
                            }}
                        >
                            ✏ Chỉnh sửa
                        </button>
                    </div>
                </div>

                <div className="share-section">
                    <h2>🔗 Chia sẻ khảo sát của bạn</h2>
                    <p>Sao chép liên kết hoặc quét mã QR để bắt đầu thu thập phản hồi</p>

                    <div className="share-content">
                        <div className="share-left">
                            <label>Liên kết khảo sát</label>
                            <div className="link-box">
                                <input
                                    type="text"
                                    value={survey.link}
                                    readOnly
                                    className="survey-link"
                                />
                                <button className="btn-copy" onClick={handleCopy}>
                                    <i className="fa-regular fa-copy" title="Sao chép liên kết"></i>
                                </button>
                            </div>

                            <p>Chia sẻ nhanh</p>
                            <div className="share-buttons">
                                <button className="btn-email"><i className="fa-solid fa-envelope" title="Email"></i> Email</button>
                                <button className="btn-social"><i className="fa-solid fa-globe" title="Mạng xã hội"></i> Mạng xã hội</button>
                                <button className="btn-embed"><i className="fa-solid fa-desktop" title="Nhúng"></i> Nhúng</button>
                            </div>
                        </div>

                        <div className="share-right">
                            <label>Mã QR</label>
                            <div className="qr-box">
                                <QRCodeCanvas value={survey.link} size={120} />
                                <p>Quét để mở khảo sát trên điện thoại</p>
                            </div>
                        </div>
                    </div>

                    <div className="ai-note">
                        <a href="#">🔍 Sẵn sàng thu thập dữ liệu ➜</a>
                    </div>
                </div>
            </div>

            {isSettingsOpen && (
                <div className="settings-modal-overlay" onClick={closeCloseSurveyModal}>
                    <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="settings-modal__header">
                            <div className="settings-modal__icon" aria-hidden="true">
                                🔒
                            </div>
                            <div>
                                <h3>Đóng khảo sát</h3>
                                <p>Ngừng nhận phản hồi mới và ẩn biểu mẫu khỏi người tham gia.</p>
                            </div>
                        </div>

                        <div className="settings-modal__body">
                            <div className="settings-notice">
                                <strong>Lưu ý:</strong> Khi khảo sát được đóng, liên kết chia sẻ sẽ hiển thị thông báo “Khảo sát đã kết thúc”. Bạn có thể mở lại khảo sát bất cứ lúc nào trong trang chỉnh sửa.
                            </div>
                            <div className="settings-summary">
                                <div>
                                    <span className="summary-label">Trạng thái hiện tại</span>
                                    <span className={`summary-status ${statusMeta.className}`}>
                                        {statusMeta.label}
                                    </span>
                                </div>
                                <div>
                                    <span className="summary-label">Số câu hỏi</span>
                                    <span className="summary-value">{survey.totalQuestions}</span>
                                </div>
                            </div>
                        </div>

                        <div className="settings-modal__actions">
                            <button
                                className="btn-secondary"
                                type="button"
                                onClick={closeCloseSurveyModal}
                                disabled={isClosingSurvey}
                            >
                                Hủy
                            </button>
                            <button
                                className="btn-danger"
                                type="button"
                                onClick={handleCloseSurvey}
                                disabled={isClosingSurvey}
                            >
                                {isClosingSurvey ? "Đang đóng..." : "Đóng khảo sát"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default ShareSurveyPage;
