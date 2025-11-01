import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import "./ResponseFormPage.css";
import { responseService } from "../../services/responseService";
import { surveyService } from "../../services/surveyService";
import { questionService, optionService } from "../../services/questionSurvey";
import { isValidTokenFormat } from "../../utils/tokenGenerator";
import logoSmartSurvey from "../../assets/logoSmartSurvey.png";
import { apiClient } from "../../services/authService";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// 🎯 Sortable Ranking Item for Public Response
function PublicSortableRankingItem({ id, index, text }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div ref={setNodeRef} style={style} className="ranking-response-item">
            <div className="ranking-handle-response" {...attributes} {...listeners}>
                <i className="fa-solid fa-grip-vertical" aria-hidden="true"></i>
            </div>
            <span className="ranking-position">{index + 1}</span>
            <span className="ranking-text">{text}</span>
        </div>
    );
}

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
    
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    useEffect(() => {
        const respondentTokenFromLink = new URLSearchParams(location.search).get("respondentToken");
        console.log('🔍 URL search params:', location.search);
        console.log('🎫 Token from URL:', respondentTokenFromLink);

        if (respondentTokenFromLink) {
            if (isValidTokenFormat(respondentTokenFromLink)) {
                try {
                    localStorage.setItem("respondent_request_token", respondentTokenFromLink);
                    console.log("✅ Valid token received and saved:", respondentTokenFromLink);
                } catch (_) { }
            } else {
                console.warn("❌ Invalid token format received:", respondentTokenFromLink);
            }
        } else {
            console.log("ℹ️ No token found in URL");
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
                    let type = "open-ended";
                    const backendType = q.questionType || q.question_type;

                    if (backendType === "multiple_choice") {
                        type = "multiple-choice-multiple";
                    } else if (backendType === "single_choice") {
                        type = "multiple-choice-single";
                    } else if (backendType === "boolean" || backendType === "boolean_" || backendType === "yes_no") {
                        type = "boolean";
                    } else if (backendType === "rating") {
                        type = "rating-scale";
                    } else if (backendType === "ranking") {
                        type = "ranking";
                    } else if (backendType === "date_time") {
                        type = "date_time";
                    } else if (backendType === "file_upload") {
                        type = "file_upload";
                    } else if (backendType === "open_ended") {
                        type = "open-ended";
                    }

                    let options = [];
                    if (type === "multiple-choice-multiple" || type === "multiple-choice-single" || type === "boolean" || type === "ranking") {
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
                        if (options.length === 0 && type === "boolean") {
                            options = [
                                { id: 1, text: "Có" },
                                { id: 2, text: "Không" },
                            ];
                        }
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

    // Initialize ranking questions with their options
    useEffect(() => {
        if (!activeSurvey || !activeSurvey.questions) return;
        
        setResponses(prev => {
            const newResponses = { ...prev };
            activeSurvey.questions.forEach(q => {
                if (q.type === 'ranking' && !newResponses[q.id] && q.options && q.options.length > 0) {
                    // Initialize with option IDs in order
                    newResponses[q.id] = q.options.map(opt => opt.id);
                }
            });
            return newResponses;
        });
    }, [activeSurvey]);

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
                const value = responses[q.id];
                
                // Kiểm tra theo từng loại câu hỏi
                let isValid = false;
                
                if (q.type === "file_upload") {
                    // File upload: kiểm tra xem có File object không
                    isValid = value instanceof File;
                } else if (q.type === "date_time") {
                    // Date/Time: kiểm tra object có date hoặc time
                    if (typeof value === "object" && value !== null) {
                        isValid = !!(value.date || value.time);
                    } else if (typeof value === "string") {
                        isValid = value.trim() !== "";
                    }
                } else if (Array.isArray(value)) {
                    // Array: kiểm tra length > 0
                    isValid = value.length > 0;
                } else if (typeof value === "string") {
                    // String: kiểm tra không rỗng sau khi trim
                    isValid = value.trim() !== "";
                } else if (value !== null && value !== undefined) {
                    // Các giá trị khác (number, boolean, etc.)
                    isValid = true;
                }
                
                if (!isValid) {
                    newErrors[q.id] = "Câu hỏi này là bắt buộc";
                }
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!activeSurvey) {
            console.error("❌ No survey loaded");
            alert("Không tìm thấy khảo sát. Vui lòng làm mới trang và thử lại.");
            return;
        }
        
        if (!validateForm()) {
            console.warn("⚠️ Validation failed");
            return;
        }
        
        setLoading(true);

        // Debug: Kiểm tra token trước khi submit
        const currentToken = localStorage.getItem("respondent_request_token");
        console.log('🔍 Current token in localStorage:', currentToken);
        console.log('📝 Responses to submit:', responses);
        console.log('📊 Survey data:', activeSurvey);

        try {
            const apiResult = await responseService.submitResponses(
                activeSurvey.id,
                responses,
                activeSurvey
            );
            console.log("✅ Submit response result:", apiResult);
            setSuccess(true);
            // Reset form sau khi submit thành công
            setResponses({});
        } catch (err) {
            console.error("❌ Submit failed:", err);
            console.error("❌ Error details:", err.response?.data);
            const errorMessage = err.response?.data?.message || err.message || "Có lỗi xảy ra khi gửi phản hồi. Vui lòng thử lại.";
            alert(errorMessage);
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
                            value={String(opt.id)}
                            checked={String(responses[q.id]) === String(opt.id)}
                            onChange={() => handleChange(q.id, String(opt.id))}
                        />
                        <span>{opt.text}</span>
                    </label>
                ));
            case "ranking":
                const rankingOptionIds = responses[q.id] || [];
                const rankingOptionsList = rankingOptionIds.map(id => 
                    q.options?.find(opt => String(opt.id) === String(id))
                ).filter(Boolean);
                
                if (!rankingOptionsList || rankingOptionsList.length === 0) {
                    return <div className="ranking-hint">Chưa có lựa chọn để xếp hạng</div>;
                }
                return (
                    <div className="ranking-list">
                        <p className="ranking-hint">Kéo thả để sắp xếp các lựa chọn theo thứ tự ưu tiên</p>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => {
                                const { active, over } = event;
                                if (!over || active.id === over.id) return;

                                const oldIndex = rankingOptionsList.findIndex(opt => String(opt.id) === String(active.id));
                                const newIndex = rankingOptionsList.findIndex(opt => String(opt.id) === String(over.id));
                                
                                const newOrder = arrayMove(rankingOptionsList, oldIndex, newIndex);
                                handleChange(q.id, newOrder.map(opt => opt.id));
                            }}
                        >
                            <SortableContext
                                items={rankingOptionsList.map(opt => String(opt.id))}
                                strategy={verticalListSortingStrategy}
                            >
                                {rankingOptionsList.map((opt, i) => (
                                    <PublicSortableRankingItem
                                        key={opt.id || i}
                                        id={String(opt.id)}
                                        index={i}
                                        text={opt.text}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                );
            case "open-ended":
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
            case "date_time":
                // Parse combined value or separate date/time
                const dateTimeValue = responses[q.id] || { date: '', time: '' };
                const dateValue = typeof dateTimeValue === 'string' 
                    ? (dateTimeValue.match(/(\d{4}-\d{2}-\d{2})/) || ['', ''])[1] 
                    : dateTimeValue.date || '';
                const timeValue = typeof dateTimeValue === 'string'
                    ? (dateTimeValue.match(/(\d{2}:\d{2})/) || ['', ''])[1]
                    : dateTimeValue.time || '';
                
                return (
                    <div className="date-time-inputs">
                        <input
                            type="date"
                            value={dateValue}
                            onChange={(e) => {
                                const newTime = typeof dateTimeValue === 'string'
                                    ? (dateTimeValue.match(/(\d{2}:\d{2})/) || ['', ''])[1]
                                    : dateTimeValue.time || '';
                                handleChange(q.id, { date: e.target.value, time: newTime });
                            }}
                        />
                        <input
                            type="time"
                            value={timeValue}
                            onChange={(e) => {
                                const newDate = typeof dateTimeValue === 'string'
                                    ? (dateTimeValue.match(/(\d{4}-\d{2}-\d{2})/) || ['', ''])[1]
                                    : dateTimeValue.date || '';
                                handleChange(q.id, { date: newDate, time: e.target.value });
                            }}
                        />
                    </div>
                );
            case "file_upload":
                const selectedFile = responses[q.id] instanceof File ? responses[q.id] : null;
                return (
                    <div className="file-upload">
                        <div className="upload-zone">
                            <label htmlFor={`file-upload-public-${q.id}`}>
                                <i className="fa-solid fa-cloud-arrow-up upload-icon"></i>
                                <p className="upload-text">
                                    <span>Nhấp hoặc kéo thả file vào đây</span>
                                </p>
                                <p className="upload-hint">
                                    Định dạng: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, ZIP, RAR (Tối đa 10MB)
                                </p>
                            </label>
                            <input
                                id={`file-upload-public-${q.id}`}
                                type="file"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        handleChange(q.id, file);
                                    }
                                }}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                            />
                        </div>
                        {selectedFile && (
                            <div className="file-preview">
                                <i className="fa-solid fa-file"></i>
                                <span className="file-name">{selectedFile.name}</span>
                                <span className="file-size">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                <button
                                    type="button"
                                    className="file-remove"
                                    onClick={() => handleChange(q.id, null)}
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            </div>
                        )}
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
                            <button 
                                type="submit" 
                                disabled={loading || !activeSurvey}
                                style={{ 
                                    pointerEvents: (loading || !activeSurvey) ? "none" : "auto",
                                    cursor: (loading || !activeSurvey) ? "not-allowed" : "pointer",
                                    opacity: (loading || !activeSurvey) ? 0.6 : 1
                                }}
                            >
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
