import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import NotificationModal from "../../components/NotificationModal";
import "./ViewLinkSharePage.css";
import { surveyService } from "../../services/surveyService";
import { questionService, optionService } from "../../services/questionSurvey";
import logoSmartSurvey from "../../assets/logoSmartSurvey.png";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateUniqueToken } from "../../utils/tokenGenerator";

// 🎯 Sortable Ranking Item for Preview
function SortableRankingItem({ id, index, text }) {
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

const ViewLinkSharePage = () => {
    const params = useParams();
    const [loading, setLoading] = useState(false);
    const [loadingSurvey, setLoadingSurvey] = useState(false);
    const [loadedSurvey, setLoadedSurvey] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [responses, setResponses] = useState({});
    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(false);
    const [notification, setNotification] = useState(null);

    // Hàm helper để hiển thị notification
    const showNotification = (type, message) => {
        setNotification({ type, message });
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const surveyId = params.surveyId;

    useEffect(() => {
        if (!surveyId) return;

        const buildShareLink = (token) => {
            const origin = typeof window !== 'undefined' && window.location?.origin
                ? window.location.origin
                : '';
            return `${origin}/response/${surveyId}?${token}`;
        };

        const normalizeShareLink = (rawLink) => {
            let needsUpdate = false;
            let token = null;

            if (rawLink) {
                try {
                    const parsed = new URL(rawLink, window.location.origin);
                    token = parsed.searchParams.get('respondentToken');

                    if (!token) {
                        const legacyToken = parsed.searchParams.get('k');
                        if (legacyToken) {
                            token = legacyToken;
                            needsUpdate = true;
                        }
                    }

                    if (!token) {
                        needsUpdate = true;
                    }
                } catch (error) {
                    console.warn('⚠️ Invalid shareLink detected, regenerating token.', error);
                    needsUpdate = true;
                }
            } else {
                needsUpdate = true;
            }

            if (!token) {
                token = generateUniqueToken();
            }

            const normalized = buildShareLink(token);
            if (rawLink !== normalized) {
                needsUpdate = true;
            }

            return { link: normalized, token, needsUpdate };
        };

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
                        const choiceType = q.choiceType || q.choice_type || "multiple";
                        type = choiceType === "multiple" ? "multiple-choice-multiple" : "multiple-choice-single";
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
                    if (type.startsWith("multiple-choice") || type === "boolean" || type === "ranking") {
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

                    if (type === "boolean" && options.length === 0) {
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

                const existingLink = (detail.shareLink || '').trim();
                const { link: normalizedLink, needsUpdate } = normalizeShareLink(existingLink);
                setShareUrl(normalizedLink);

                if (!existingLink || needsUpdate) {
                    try {
                        await surveyService.updateSurvey(surveyId, { shareLink: normalizedLink });
                        console.log('✅ Share link normalized and saved:', normalizedLink);
                    } catch (error) {
                        console.warn("Could not update shareLink on backend:", error);
                    }
                } else {
                    console.log('ℹ️ Using existing shareLink:', normalizedLink);
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
            const origin = typeof window !== 'undefined' && window.location?.origin
                ? window.location.origin
                : '';
            const newShareUrl = `${origin}/response/${surveyId}?${newToken}`;
            setShareUrl(newShareUrl);
            await surveyService.updateSurvey(surveyId, { shareLink: newShareUrl });
            showNotification('success', "Đã tạo liên kết mới với token khác!");
        } catch (error) {
            console.error("Error resetting share link:", error);
            showNotification('error', "Có lỗi khi tạo liên kết mới!");
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

    // Initialize ranking questions with their options
    useEffect(() => {
        if (!questions || questions.length === 0) return;

        setResponses(prev => {
            const newResponses = { ...prev };
            questions.forEach(q => {
                if (q.type === 'ranking' && !newResponses[q.id] && q.options && q.options.length > 0) {
                    // Initialize with option IDs in order
                    newResponses[q.id] = q.options.map(opt => opt.id);
                }
            });
            return newResponses;
        });
    }, [questions]);

    // Render question preview giống ResponseFormPage
    const renderQuestionPreview = (q) => {
        switch (q.type) {
            case "multiple-choice-single":
                // Radio: chọn một option ID
                return (q.options || []).map((opt, i) => (
                    <label key={i} className="option-label">
                        <input
                            type="radio"
                            name={`question_${q.id}`}
                            value={String(opt.id || opt)}
                            checked={String(responses[q.id]) === String(opt.id || opt)}
                            onChange={() => handleChange(q.id, String(opt.id || opt))}
                        />
                        <span>{opt.text || opt}</span>
                    </label>
                ));

            case "multiple-choice-multiple":
                // Checkbox: chọn nhiều option IDs
                return (q.options || []).map((opt, i) => (
                    <label key={i} className="option-label">
                        <input
                            type="checkbox"
                            name={`question_${q.id}`}
                            value={String(opt.id || opt)}
                            checked={(responses[q.id] || []).map(String).includes(String(opt.id || opt))}
                            onChange={() => handleChange(q.id, String(opt.id || opt), true)}
                        />
                        <span>{opt.text || opt}</span>
                    </label>
                ));

            case "boolean":
                // Boolean: chọn một option ID
                return (q.options || []).map((opt, i) => (
                    <label key={i} className="option-label">
                        <input
                            type="radio"
                            name={`question_${q.id}`}
                            value={String(opt.id || opt)}
                            checked={String(responses[q.id]) === String(opt.id || opt)}
                            onChange={() => handleChange(q.id, String(opt.id || opt))}
                        />
                        <span>{opt.text || opt}</span>
                    </label>
                ));

            case "ranking":
                // Ranking: drag-drop sắp xếp options
                const rankingOptionIds = responses[q.id] || [];
                // Map IDs back to options for display
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
                                    <SortableRankingItem
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
                            <label htmlFor={`file-upload-${q.id}`}>
                                <i className="fa-solid fa-cloud-arrow-up upload-icon"></i>
                                <p className="upload-text">
                                    <span>Nhấp hoặc kéo thả file vào đây</span>
                                </p>
                                <p className="upload-hint">
                                    Định dạng: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, ZIP, RAR (Tối đa 10MB)
                                </p>
                            </label>
                            <input
                                id={`file-upload-${q.id}`}
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
                console.log('Unknown question type:', q.type);
                return <div>Unknown question type: {q.type}</div>;
        }
    };


    return (
        <>
            {/* Notification Modal */}
            {notification && (
                <NotificationModal
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

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
        </>
    );
};

export default ViewLinkSharePage;
