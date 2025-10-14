import React, { useEffect, useState } from "react";
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
                } catch (_) {}

                const token = generateUniqueToken();

                // ✅ Đổi từ "k" sang "respondentToken"
                const shareLink =
                    detail.shareLink ||
                    survey.link ||
                    `${window.location.origin}/response/${id}?respondentToken=${token}`;

                try {
                    if (!detail.shareLink) {
                        await surveyService.updateSurvey(id, { shareLink });
                    }
                } catch (_) {}

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
            const newShareLink = `${window.location.origin}/response/${id}?respondentToken=${newToken}`;

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

    return (
        <MainLayout>
            <div className="share-survey-container">
                <div className="share-survey-header">
                    <div className="share-survey-information">
                        <div className="share-survey-title-row">
                            <h1>{survey.title || (loading ? "Đang tải..." : "")}</h1>
                            <div className="share-survey-status">
                                <span className="share-status-dot"></span>
                                <span>{survey.status}</span>
                            </div>
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
                        <button className="btn-outline">⚙ Cài đặt</button>
                        <button
                            className="btn-outline"
                            onClick={() =>
                                navigate("/create-survey", {
                                    state: {
                                        editSurvey: {
                                            id: survey.id,
                                            title: survey.title,
                                            description: survey.description,
                                            status: survey.status,
                                        },
                                    },
                                })
                            }
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
                                    📋
                                </button>
                            </div>

                            <p>Chia sẻ nhanh</p>
                            <div className="share-buttons">
                                <button className="btn-email">📧 Email</button>
                                <button className="btn-social">🌐 Mạng xã hội</button>
                                <button className="btn-embed">💻 Nhúng</button>
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
        </MainLayout>
    );
};

export default ShareSurveyPage;
