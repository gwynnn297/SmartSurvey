import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ResponseFormPage.css";
import { surveyService } from "../../services/surveyService";
import { questionService, optionService } from "../../services/questionSurvey";
import { generateUniqueToken, isValidTokenFormat } from "../../utils/tokenGenerator";
import logoSmartSurvey from "../../assets/logoSmartSurvey.png";

const ViewLinkSharePage = () => {
    const params = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loadingSurvey, setLoadingSurvey] = useState(false);
    const [loadedSurvey, setLoadedSurvey] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);

    const surveyId = params.surveyId;

    useEffect(() => {
        if (!surveyId) return;

        const loadSurvey = async () => {
            try {
                setLoadingSurvey(true);
                const detail = await surveyService.getSurveyById(surveyId);

                setLoadedSurvey({
                    id: detail.id,
                    title: detail.title || "Khảo sát",
                    description: detail.description || "",
                });

                // Load questions
                const questionsData = await questionService.getQuestionsBySurvey(surveyId);
                const mappedQuestions = [];

                for (const q of questionsData) {
                    let type = "open-text";
                    const backendType = q.questionType || q.question_type;

                    if (backendType === "multiple_choice") {
                        type = q.choiceType === "multiple" ? "multiple-choice-multiple" : "multiple-choice-single";
                    } else if (backendType === "boolean" || backendType === "boolean_" || backendType === "yes_no") {
                        type = "boolean";
                    } else if (backendType === "rating") {
                        type = "rating-scale";
                    }

                    let options = [];
                    if (type.startsWith("multiple-choice")) {
                        try {
                            const opts = await optionService.getOptionsByQuestion(q.id);
                            options = (opts || []).map((o) => ({
                                id: o.id || o.optionId || o.option_id,
                                text: o.optionText || o.option_text,
                            }));
                        } catch (_) {
                            options = (q.options || []).map((o) => ({
                                id: o.id || o.optionId || o.option_id,
                                text: o.optionText || o.option_text,
                            }));
                        }
                    }

                    if (type === "boolean") {
                        options = [
                            { id: "true", text: "Có" },
                            { id: "false", text: "Không" },
                        ];
                    }

                    const scale = type === "rating-scale" ? [1, 2, 3, 4, 5] : undefined;

                    mappedQuestions.push({
                        id: q.id,
                        text: q.questionText || q.question_text,
                        type,
                        options,
                        scale,
                        is_required: q.isRequired ?? q.is_required ?? false,
                    });
                }

                setQuestions(mappedQuestions);

                // Tạo link chia sẻ với token như ShareSurveyPage
                const token = generateUniqueToken();
                const responseUrl = `${window.location.origin}/response/${surveyId}?respondentToken=${token}`;
                console.log('🔗 Generated share URL:', responseUrl);
                console.log('🎫 Generated token:', token);
                console.log('🔍 Token format valid:', isValidTokenFormat(token));
                setShareUrl(responseUrl);

                // Cập nhật shareLink trong database nếu chưa có
                try {
                    if (!detail.shareLink) {
                        await surveyService.updateSurvey(surveyId, { shareLink: responseUrl });
                        console.log('✅ Updated shareLink in database:', responseUrl);
                    } else {
                        console.log('ℹ️ ShareLink already exists:', detail.shareLink);
                    }
                } catch (error) {
                    console.warn("Could not update shareLink on backend:", error);
                }
            } catch (err) {
                console.error("Error loading survey:", err);
            } finally {
                setLoadingSurvey(false);
            }
        };
        loadSurvey();
    }, [surveyId]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleShareEmail = () => {
        const subject = encodeURIComponent(`Khảo sát: ${loadedSurvey?.title || 'Khảo sát'}`);
        const body = encodeURIComponent(`Xin chào,\n\nTôi mời bạn tham gia khảo sát: ${loadedSurvey?.title || 'Khảo sát'}\n\n${loadedSurvey?.description || ''}\n\nLink tham gia: ${shareUrl}\n\nCảm ơn bạn!`);
        window.open(`mailto:?subject=${subject}&body=${body}`);
    };

    const handleShareSocial = () => {
        const text = encodeURIComponent(`Tham gia khảo sát: ${loadedSurvey?.title || 'Khảo sát'} - ${shareUrl}`);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${text}`, '_blank');
    };

    const handleGenerateNewLink = async () => {
        try {
            setLoading(true);
            const newToken = generateUniqueToken();
            const newShareUrl = `${window.location.origin}/response/${surveyId}?respondentToken=${newToken}`;

            setShareUrl(newShareUrl);

            // Cập nhật shareLink trong database
            try {
                await surveyService.updateSurvey(surveyId, { shareLink: newShareUrl });
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
        <div
            className="response-container"
            style={{
                background:
                    "radial-gradient(130% 140% at 10% 10%, rgba(59, 130, 246, 0.32), transparent 55%), radial-gradient(120% 120% at 90% 20%, rgba(139, 92, 246, 0.35), transparent 45%), linear-gradient(135deg, #eef2ff 0%, #f8fafc 40%, #eef2ff 100%)",
            }}
        >
            <div className="survey-card">
                {loadingSurvey ? (
                    <div style={{ padding: 24, textAlign: "center" }}>
                        Đang tải khảo sát...
                    </div>
                ) : !loadedSurvey ? (
                    <div style={{ padding: 24, textAlign: "center" }}>
                        Không tìm thấy khảo sát.
                    </div>
                ) : (
                    <>
                        <div className="survey-header">
                            <img
                                className="logo-smart-survey"
                                src={logoSmartSurvey}
                                alt="logoSmartSurvey"
                            />

                            <h2>{loadedSurvey.title}</h2>
                            <p>{loadedSurvey.description}</p>
                        </div>

                        <div className="share-link">
                            <label>Liên kết khảo sát</label>
                            <div className="link-box">
                                <input
                                    type="text"
                                    value={shareUrl}
                                    readOnly
                                    className="survey-link"
                                />
                                <button className="btn-copy" onClick={handleCopy}>
                                    <i className="fa-regular fa-copy" title="Sao chép liên kết"></i>
                                    {copied ? 'Đã sao chép!' : 'Sao chép'}
                                </button>
                            </div>

                            <p>Chia sẻ nhanh</p>
                            <div className="share-buttons">
                                <button className="btn-email" onClick={handleShareEmail}>
                                    <i className="fa-solid fa-envelope" title="Email"></i> Email
                                </button>
                                <button className="btn-social" onClick={handleShareSocial}>
                                    <i className="fa-solid fa-globe" title="Mạng xã hội"></i> Mạng xã hội
                                </button>
                                <button className="btn-embed" onClick={() => window.open(shareUrl, '_blank')}>
                                    <i className="fa-solid fa-external-link-alt" title="Mở link"></i> Mở link
                                </button>
                            </div>

                        </div>

                        {/* Hiển thị danh sách câu hỏi */}
                        {questions.length > 0 && (
                            <div className="questions-preview">
                                <h3>Danh sách câu hỏi ({questions.length} câu)</h3>
                                <div className="questions-list">
                                    {questions.map((q, index) => (
                                        <div key={q.id} className="question-preview-item">
                                            <div className="question-preview-header">
                                                <span className="question-number">Câu {index + 1}</span>
                                                <span className="question-type-badge">
                                                    {q.type === 'open-text' && 'Trả lời ngắn'}
                                                    {q.type === 'multiple-choice-single' && 'Trắc nghiệm (chọn 1)'}
                                                    {q.type === 'multiple-choice-multiple' && 'Trắc nghiệm (chọn nhiều)'}
                                                    {q.type === 'boolean' && 'Yes/No'}
                                                    {q.type === 'rating-scale' && 'Xếp hạng'}
                                                </span>
                                                {q.is_required && <span className="required-badge">Bắt buộc</span>}
                                            </div>
                                            <p className="question-preview-text">{q.text}</p>

                                            {/* Hiển thị options cho multiple choice */}
                                            {q.options && q.options.length > 0 && (
                                                <div className="question-preview-options">
                                                    {q.options.map((opt, optIndex) => (
                                                        <div key={opt.id || optIndex} className="option-preview">
                                                            <span className="option-bullet">•</span>
                                                            <span>{opt.text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Hiển thị scale cho rating */}
                                            {q.scale && (
                                                <div className="rating-preview">
                                                    <span className="rating-label">Thang điểm:</span>
                                                    <div className="rating-stars">
                                                        {q.scale.map((num) => (
                                                            <span key={num} className="rating-star">★</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="form-footer">
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="btn-back"
                            >
                                <i className="fa-solid fa-arrow-left"></i> Quay lại Dashboard
                            </button>
                            <p className="note">
                                Chia sẻ link này để mời mọi người tham gia khảo sát của bạn
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ViewLinkSharePage;
