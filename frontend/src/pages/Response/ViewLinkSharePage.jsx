import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ViewLinkSharePage.css";
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
    const [responses, setResponses] = useState({});
    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(false);

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

    // Handle input change
    const handleChange = (questionId, value, multiple = false) => {
        setResponses((prev) => {
            if (multiple) {
                const current = prev[questionId] || [];
                return {
                    ...prev,
                    [questionId]: current.includes(value)
                        ? current.filter((v) => v !== value)
                        : [...current, value],
                };
            }
            return { ...prev, [questionId]: value };
        });
    };

    // Validate required questions
    const validateForm = () => {
        const newErrors = {};
        if (!loadedSurvey) return false;
        questions.forEach((q) => {
            if (q.is_required) {
                if (
                    !responses[q.id] ||
                    (Array.isArray(responses[q.id]) && responses[q.id].length === 0) ||
                    (typeof responses[q.id] === "string" && responses[q.id].trim() === "")
                ) {
                    newErrors[q.id] = "Câu hỏi này là bắt buộc";
                }
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle submit (không gửi lên server)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        try {
            // Giả lập loading
            await new Promise((res) => setTimeout(res, 1000));
            setSuccess(true);
        } catch (err) {
            console.error("Submit failed:", err);
        } finally {
            setLoading(false);
        }
    };

    // Render question preview giống ResponseFormPage
    const renderQuestionPreview = (q) => {
        switch (q.type) {
            case "multiple-choice-single":
                // Radio: chọn một
                return (q.options || []).map((opt, i) => (
                    <label key={i} className="option-label">
                        <input
                            type="radio"
                            name={`question_${q.id}`}
                            value={opt.text}
                            checked={responses[q.id] === opt.text}
                            onChange={() => handleChange(q.id, opt.text)}
                        />
                        <span>{opt.text}</span>
                    </label>
                ));

            case "multiple-choice-multiple":
                // Checkbox: chọn nhiều
                return (q.options || []).map((opt, i) => (
                    <label key={i} className="option-label">
                        <input
                            type="checkbox"
                            name={`question_${q.id}`}
                            value={opt.text}
                            checked={responses[q.id]?.includes(opt.text) || false}
                            onChange={() => handleChange(q.id, opt.text, true)}
                        />
                        <span>{opt.text}</span>
                    </label>
                ));

            case "open-text":
                return (
                    <textarea
                        rows="4"
                        placeholder="Nhập câu trả lời..."
                        value={responses[q.id] || ""}
                        onChange={(e) => handleChange(q.id, e.target.value)}
                    />
                );

            case "rating-scale":
                return (
                    <div className="rating-scale">
                        {(q.scale || []).map((num) => (
                            <label key={num} className="rating-circle">
                                <input
                                    type="radio"
                                    name={`question_${q.id}`}
                                    value={num}
                                    checked={responses[q.id] === num.toString()}
                                    onChange={() => handleChange(q.id, num.toString())}
                                />
                                <div>{num}</div>
                            </label>
                        ))}
                    </div>
                );

            default:
                console.log('Unknown question type:', q.type);
                return <div>Unknown question type: {q.type}</div>;
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

                        {/* Hiển thị danh sách câu hỏi giống ResponseFormPage */}
                        {questions.length > 0 && !success && (
                            <form onSubmit={handleSubmit}>
                                <div className="questions-preview">
                                    <h3>Danh sách câu hỏi ({questions.length} câu)</h3>
                                    <div className="questions-list">
                                        {questions.map((q, index) => (
                                            <div key={q.id} className={`question-card ${errors[q.id] ? "error" : ""}`}>
                                                <h3>
                                                    {q.text}{" "}
                                                    {q.is_required && <span className="required">*</span>}
                                                </h3>
                                                {renderQuestionPreview(q)}
                                                {errors[q.id] && (
                                                    <p className="error-message">{errors[q.id]}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-footer">
                                    <button type="submit" disabled={loading}>
                                        {loading ? "Đang gửi..." : "Gửi khảo sát"}
                                    </button>
                                    <p className="note">
                                        Phản hồi của bạn sẽ được bảo mật và chỉ dùng để cải thiện dịch vụ
                                    </p>
                                </div>
                            </form>
                        )}

                        {success && (
                            <div className="success-modal">
                                <div className="checkmark">✔</div>
                                <h2>Cảm ơn bạn đã hoàn thành khảo sát!</h2>
                                <p>Phản hồi của bạn đã được ghi lại thành công.</p>
                                <button onClick={() => setSuccess(false)}>Đóng</button>
                            </div>
                        )}


                    </>
                )}
            </div>
        </div>
    );
};

export default ViewLinkSharePage;
