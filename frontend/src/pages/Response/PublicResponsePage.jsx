import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import "./ResponseFormPage.css";
import { responseService } from "../../services/responseService";
import { surveyService } from "../../services/surveyService";
import { questionService, optionService } from "../../services/questionSurvey";
import { isValidTokenFormat } from "../../utils/tokenGenerator";
import logoSmartSurvey from "../../assets/logoSmartSurvey.png";
import { apiClient } from "../../services/authService";

const PublicResponsePage = () => {
    const params = useParams();
    const location = useLocation();
    const [responses, setResponses] = useState({});
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loadingSurvey, setLoadingSurvey] = useState(false);
    const [loadedSurvey, setLoadedSurvey] = useState(null);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);

    const activeSurvey = useMemo(() => loadedSurvey, [loadedSurvey]);

    useEffect(() => {
        const respondentTokenFromLink = new URLSearchParams(location.search).get("respondentToken");
        if (respondentTokenFromLink) {
            if (isValidTokenFormat(respondentTokenFromLink)) {
                try {
                    localStorage.setItem("respondent_request_token", respondentTokenFromLink);
                    console.log("Valid token received:", respondentTokenFromLink);
                } catch (_) {}
            } else {
                console.warn("Invalid token format received:", respondentTokenFromLink);
            }
        }

        const idFromParams = params?.id || params?.surveyId;
        const idFromPath = !idFromParams
            ? location.pathname.split("/").filter(Boolean).pop()
            : null;
        const surveyId = idFromParams || idFromPath;
        if (!surveyId) return;

        const loadSurvey = async () => {
            try {
                setLoadingSurvey(true);
                const detail = await surveyService.getSurveyById(surveyId);
                const questions = await questionService.getQuestionsBySurvey(surveyId);
                const mappedQuestions = [];

                for (const q of questions) {
                    let type = "open-text";
                    const backendType = q.questionType || q.question_type;

                    if (backendType === "multiple_choice") {
                        type =
                            q.choiceType === "multiple"
                                ? "multiple-choice-multiple"
                                : "multiple-choice-single";
                    } else if (
                        backendType === "boolean" ||
                        backendType === "boolean_" ||
                        backendType === "yes_no"
                    ) {
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

                setLoadedSurvey({
                    id: detail.id,
                    title: detail.title || "Khảo sát",
                    description: detail.description || "",
                    questions: mappedQuestions,
                });

                // ✅ Kiểm tra token đã được dùng chưa
                const currentToken =
                    localStorage.getItem("respondent_request_token") || respondentTokenFromLink;
                if (currentToken) {
                    try {
                        const res = await apiClient.get(`/responses/${surveyId}`);
                        const responsesData = res.data || [];
                        const found = responsesData.some(
                            (r) => r.requestToken === currentToken
                        );
                        if (found) {
                            console.log("Token already used for this survey.");
                            setAlreadySubmitted(true);
                        }
                    } catch (checkErr) {
                        console.warn("Cannot verify token usage:", checkErr);
                    }
                }
            } catch (err) {
                console.error("Error loading public survey:", err);
            } finally {
                setLoadingSurvey(false);
            }
        };
        loadSurvey();
    }, [params, location.pathname]);

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

    const validateForm = () => {
        const newErrors = {};
        if (!activeSurvey) return false;
        activeSurvey.questions.forEach((q) => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setLoading(true);
        try {
            const apiResult = await responseService.submitResponses(
                activeSurvey.id,
                responses,
                activeSurvey
            );
            console.log("Submitting response result:", apiResult);
            setSuccess(true);
        } catch (err) {
            console.error("Submit failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const renderQuestion = (q) => {
        switch (q.type) {
            case "multiple-choice-single":
                return (q.options || []).map((opt, i) => (
                    <label key={i} className="option-label">
                        <input
                            type="radio"
                            name={`question_${q.id}`}
                            value={String(opt.id)}
                            checked={String(responses[q.id]) === String(opt.id)}
                            onChange={() => handleChange(q.id, String(opt.id))}
                        />
                        <span>{opt.text}</span>
                    </label>
                ));
            case "multiple-choice-multiple":
                return (q.options || []).map((opt, i) => (
                    <label key={i} className="option-label">
                        <input
                            type="checkbox"
                            name={`question_${q.id}`}
                            value={String(opt.id)}
                            checked={(responses[q.id] || [])
                                .map(String)
                                .includes(String(opt.id))}
                            onChange={() => handleChange(q.id, String(opt.id), true)}
                        />
                        <span>{opt.text}</span>
                    </label>
                ));
            case "boolean":
                return (q.options || []).map((opt, i) => (
                    <label key={i} className="option-label">
                        <input
                            type="radio"
                            name={`question_${q.id}`}
                            value={opt.id}
                            checked={String(responses[q.id]) === String(opt.id)}
                            onChange={() => handleChange(q.id, opt.id)}
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
                ) : !activeSurvey ? (
                    <div style={{ padding: 24, textAlign: "center" }}>
                        Không tìm thấy khảo sát.
                    </div>
                ) : alreadySubmitted ? (
                    <div style={{ padding: 40, textAlign: "center" }}>
                        <h2>Bạn đã hoàn thành khảo sát này 🎉</h2>
                        <p>Cảm ơn bạn đã dành thời gian phản hồi!</p>
                    </div>
                ) : !success ? (
                    <form onSubmit={handleSubmit}>
                        <div className="survey-header">
                            <img
                                className="logo-smart-survey"
                                src={logoSmartSurvey}
                                alt="logoSmartSurvey"
                            />
                            <h1>{activeSurvey.title}</h1>
                            <p>{activeSurvey.description}</p>
                        </div>

                        {activeSurvey.questions.map((q) => (
                            <div
                                key={q.id}
                                className={`question-card ${errors[q.id] ? "error" : ""}`}
                            >
                                <h3>
                                    {q.text}{" "}
                                    {q.is_required && (
                                        <span className="required">*</span>
                                    )}
                                </h3>
                                {renderQuestion(q)}
                                {errors[q.id] && (
                                    <p className="error-message">{errors[q.id]}</p>
                                )}
                            </div>
                        ))}

                        <div className="form-footer">
                            <button type="submit" disabled={loading}>
                                {loading ? "Đang gửi..." : "Gửi phản hồi"}
                            </button>
                            <p className="note">
                                Phản hồi của bạn sẽ được bảo mật và chỉ dùng để cải thiện dịch vụ
                            </p>
                        </div>
                    </form>
                ) : (
                    <div className="success-modal">
                        <div className="checkmark">✔</div>
                        <h2>Cảm ơn bạn đã hoàn thành khảo sát!</h2>
                        <p>Phản hồi của bạn đã được ghi lại thành công.</p>
                        <button
                            onClick={() => {
                                setSuccess(false);
                                setAlreadySubmitted(true);
                            }}
                        >
                            Đóng
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicResponsePage;
