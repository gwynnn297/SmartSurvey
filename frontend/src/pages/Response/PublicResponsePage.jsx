import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import NotificationModal from "../../components/NotificationModal";
import "./ResponseFormPage.css";
import { responseService } from "../../services/responseService";
import { getSurveyPublicInfo } from "../../services/dashboardReportService";
import { isValidTokenFormat, generateUniqueToken } from "../../utils/tokenGenerator";
import logoSmartSurvey from "../../assets/logoSmartSurvey.png";
import { apiClient } from "../../services/authService";
import { publicApiClient } from "../../services/publicApiClient";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Hàm trích xuất respondent token từ URL chia sẻ khảo sát.
 * Link mới có dạng `...?{token}` nên ngoài tham số `respondentToken` truyền thống,
 * hàm còn xử lý các trường hợp:
 *  - Token nằm trong tham số khác (ví dụ legacy `k`).
 *  - Token được truyền dưới dạng key không có value hoặc toàn bộ query chỉ chứa token.
 * Hàm trả về token hợp lệ đầu tiên tìm được hoặc `null` nếu không có.
 */
const extractRespondentToken = (search) => {
    if (!search) return null;

    const normalizedSearch = search.startsWith("?") ? search : `?${search}`;
    const params = new URLSearchParams(normalizedSearch);

    const directToken = params.get("respondentToken");
    if (directToken) return directToken;

    const legacyToken = params.get("k");
    if (legacyToken) return legacyToken;

    for (const [key, value] of params.entries()) {
        if (value && isValidTokenFormat(value)) {
            return value;
        }
        if (!value && isValidTokenFormat(key)) {
            return key;
        }
    }

    const raw = normalizedSearch.slice(1);
    if (raw && raw.indexOf("=") === -1 && isValidTokenFormat(raw)) {
        return raw;
    }

    return null;
};

const SUBMISSION_STATUS_STORAGE_KEY = "respondent_submitted_surveys";

// 📦 Chuẩn hóa dữ liệu lưu trữ token đã gửi theo khảo sát
const normalizeSubmissionRecords = (records) => {
    if (!records) return [];
    if (Array.isArray(records)) {
        return records.map((item) => String(item));
    }
    if (typeof records === "object") {
        return Object.keys(records);
    }
    return [String(records)];
};

// 📖 Đọc trạng thái khảo sát đã submit từ localStorage
const readSubmissionStatus = () => {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(SUBMISSION_STATUS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
        return {};
    }
};

// ✍️ Ghi trạng thái khảo sát đã submit vào localStorage
const writeSubmissionStatus = (data) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(SUBMISSION_STATUS_STORAGE_KEY, JSON.stringify(data));
    } catch (_) { }
};

// ✅ Kiểm tra người dùng với token tương ứng đã hoàn thành khảo sát chưa
const hasSubmittedSurvey = (surveyId, token) => {
    if (!surveyId || !token) return false;
    const status = readSubmissionStatus();
    const surveyKey = String(surveyId);
    const tokenStr = String(token);
    const records = normalizeSubmissionRecords(status[surveyKey]);
    return records.includes(tokenStr);
};

// 🗂️ Đánh dấu khảo sát đã được submit với token hiện tại
const markSurveyAsSubmitted = (surveyId, token) => {
    if (!surveyId || !token) return;
    const status = readSubmissionStatus();
    const surveyKey = String(surveyId);
    const tokenStr = String(token);
    const updatedRecords = new Set(normalizeSubmissionRecords(status[surveyKey]));
    if (!updatedRecords.has(tokenStr)) {
        updatedRecords.add(tokenStr);
        status[surveyKey] = Array.from(updatedRecords);
        writeSubmissionStatus(status);
    }
};

// 🎟️ Lấy hoặc tạo mới respondent token để nhận diện người trả lời
const getOrCreateRequestToken = () => {
    if (typeof window === "undefined") return null;
    let token = null;
    try {
        token = window.localStorage.getItem("respondent_request_token");
    } catch (_) { }

    if (token && isValidTokenFormat(token)) {
        return token;
    }

    const newToken = generateUniqueToken();
    try {
        window.localStorage.setItem("respondent_request_token", newToken);
    } catch (_) { }
    return newToken;
};

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
    const [notification, setNotification] = useState(null);
    const loadedSurveyIdRef = useRef(null);
    const surveyStartTimeRef = useRef(null);

    // Hàm helper để hiển thị notification
    const showNotification = (type, message) => {
        setNotification({ type, message });
    };

    const activeSurvey = useMemo(() => loadedSurvey, [loadedSurvey]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    useEffect(() => {
        const respondentTokenFromLink = extractRespondentToken(location.search);
        console.log('🔍 URL search params:', location.search);
        console.log('🎫 Token extracted from URL:', respondentTokenFromLink);

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

        // Tránh load survey nhiều lần với cùng surveyId (React StrictMode trong development có thể chạy useEffect 2 lần)
        if (loadedSurveyIdRef.current === surveyId) return;
        loadedSurveyIdRef.current = surveyId;

        const loadSurvey = async () => {
            try {
                setLoadingSurvey(true);

                // Lấy thông tin survey từ public endpoint (tự động track view ở backend)
                // Endpoint /surveys/{id}/public đã tự động track view khi được gọi
                const publicSurveyData = await getSurveyPublicInfo(surveyId);

                // Map dữ liệu từ SurveyPublicResponseDTO
                const detail = {
                    id: publicSurveyData.id,
                    title: publicSurveyData.title,
                    description: publicSurveyData.description
                };

                // Map questions từ public API response
                const mappedQuestions = (publicSurveyData.questions || []).map((q) => {
                    let type = "open-ended";
                    const backendType = q.type;

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

                    // Map options từ public API response
                    let options = [];
                    if (q.options && q.options.length > 0) {
                        options = q.options.map((o) => ({
                            id: o.id,
                            text: o.text,
                        }));
                    }

                    // Nếu là boolean mà không có options, tạo mặc định
                    if (type === "boolean" && options.length === 0) {
                        options = [
                            { id: 1, text: "Có" },
                            { id: 2, text: "Không" },
                        ];
                    }

                    const scale = type === "rating-scale" ? [1, 2, 3, 4, 5] : undefined;

                    return {
                        id: q.id,
                        text: q.text,
                        type,
                        options,
                        scale,
                        is_required: q.required ?? false,
                    };
                });

                setLoadedSurvey({
                    id: detail.id,
                    title: detail.title || "Khảo sát",
                    description: detail.description || "",
                    questions: mappedQuestions,
                });

                // Lưu thời gian bắt đầu làm khảo sát
                surveyStartTimeRef.current = Date.now();

                // ✅ Kiểm tra token đã được dùng chưa (tạm thời disable để tránh lỗi auth)
                const currentToken =
                    localStorage.getItem("respondent_request_token") || respondentTokenFromLink;
                if (currentToken) {
                    try {
                        // TODO: Tạo API public để check token đã dùng chưa
                        // const res = await apiClient.get(`/responses/${surveyId}`);
                        // const responsesData = res.data || [];
                        // const found = responsesData.some(
                        //     (r) => r.requestToken === currentToken
                        // );
                        // if (found) {
                        //     console.log("Token already used for this survey.");
                        //     setAlreadySubmitted(true);
                        // }
                        console.log("Token check disabled temporarily");
                    } catch (checkErr) {
                        console.warn("Cannot verify token usage:", checkErr);
                    }
                }

                const tokensToCheck = [currentToken, respondentTokenFromLink].filter(Boolean);
                if (tokensToCheck.some((token) => hasSubmittedSurvey(surveyId, token))) {
                    console.log("🔁 Respondent already submitted this survey locally. Showing summary state.");
                    setAlreadySubmitted(true);
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

    // Public submit function (không cần authentication)
    const submitPublicResponse = async (
        surveyId,
        responses,
        survey,
        durationSeconds = 0,
        providedRequestToken = null
    ) => {
        // Kiểm tra có file upload không
        const hasFiles = survey && Array.isArray(survey.questions) &&
            survey.questions.some(q => q.type === 'file_upload' && responses[q.id] instanceof File);

        const requestToken = providedRequestToken || getOrCreateRequestToken();
        console.log('🎫 Request token prepared for submission:', requestToken);

        if (hasFiles) {
            // Submit với files sử dụng FormData qua public endpoint
            const formData = new FormData();
            formData.append('surveyId', String(surveyId));

            const answers = [];
            survey.questions.forEach(q => {
                const value = responses[q.id];
                if (value === undefined || value === null) return;

                if (q.type === 'file_upload' && value instanceof File) {
                    formData.append(`file_${q.id}`, value);
                    answers.push({
                        questionId: q.id,
                        answerText: value.name
                    });
                    return;
                }

                // Xử lý các loại câu hỏi khác
                const answer = { questionId: q.id };
                if (q.type === 'multiple-choice-single' || q.type === 'boolean') {
                    const val = Number(value);
                    if (!isNaN(val)) {
                        answer.optionId = val;
                        answers.push(answer);
                    }
                } else if (q.type === 'multiple-choice-multiple') {
                    if (Array.isArray(value)) {
                        const optionIds = value.map(v => Number(v)).filter(id => !isNaN(id));
                        if (optionIds.length > 0) {
                            answer.selectedOptionIds = optionIds;
                            answers.push(answer);
                        }
                    }
                } else if (q.type === 'ranking') {
                    if (Array.isArray(value)) {
                        const rankingIds = value.map(v => Number(v)).filter(id => !isNaN(id));
                        if (rankingIds.length > 0) {
                            answer.rankingOptionIds = rankingIds;
                            answers.push(answer);
                        }
                    }
                } else if (q.type === 'date_time') {
                    // Xử lý datetime question
                    if (typeof value === 'object' && value !== null) {
                        // Object with date and time properties
                        if (value.date) answer.dateValue = value.date;
                        if (value.time) answer.timeValue = value.time;
                        if (answer.dateValue || answer.timeValue) {
                            answers.push(answer);
                        }
                    } else if (typeof value === 'string') {
                        // Parse ISO datetime string or separate date/time
                        const dateMatch = value.match(/(\d{4}-\d{2}-\d{2})/);
                        const timeMatch = value.match(/(\d{2}:\d{2})/);
                        if (dateMatch) answer.dateValue = dateMatch[1];
                        if (timeMatch) answer.timeValue = timeMatch[1];
                        if (answer.dateValue || answer.timeValue) {
                            answers.push(answer);
                        }
                    }
                } else if (q.type === 'open-ended' || q.type === 'rating-scale') {
                    answer.answerText = String(value);
                    if (answer.answerText.trim()) {
                        answers.push(answer);
                    }
                }
            });

            formData.append('answers', JSON.stringify(answers));

            if (requestToken) {
                formData.append('requestToken', requestToken);
            }

            if (durationSeconds > 0) {
                formData.append('durationSeconds', String(durationSeconds));
            }

            const response = await publicApiClient.post('/api/public/responses/with-files', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 60000, // 60s for file uploads
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    console.log('📤 Upload progress:', percentCompleted + '%');
                }
            });
            return response.data;
        } else {
            // Submit thông thường không có files qua public endpoint
            const payload = {
                surveyId,
                answers: [],
                durationSeconds,
                requestToken
            };

            // Xử lý answers tương tự như trên nhưng không có file
            survey.questions.forEach(q => {
                const value = responses[q.id];
                if (value === undefined || value === null) return;

                const answer = { questionId: q.id };
                if (q.type === 'multiple-choice-single' || q.type === 'boolean') {
                    const val = Number(value);
                    if (!isNaN(val)) {
                        answer.optionId = val;
                        payload.answers.push(answer);
                    }
                } else if (q.type === 'multiple-choice-multiple') {
                    if (Array.isArray(value)) {
                        const optionIds = value.map(v => Number(v)).filter(id => !isNaN(id));
                        if (optionIds.length > 0) {
                            answer.selectedOptionIds = optionIds;
                            payload.answers.push(answer);
                        }
                    }
                } else if (q.type === 'ranking') {
                    if (Array.isArray(value)) {
                        const rankingIds = value.map(v => Number(v)).filter(id => !isNaN(id));
                        if (rankingIds.length > 0) {
                            answer.rankingOptionIds = rankingIds;
                            payload.answers.push(answer);
                        }
                    }
                } else if (q.type === 'date_time') {
                    // Xử lý datetime question
                    if (typeof value === 'object' && value !== null) {
                        // Object with date and time properties
                        if (value.date) answer.dateValue = value.date;
                        if (value.time) answer.timeValue = value.time;
                        if (answer.dateValue || answer.timeValue) {
                            payload.answers.push(answer);
                        }
                    } else if (typeof value === 'string') {
                        // Parse ISO datetime string or separate date/time
                        const dateMatch = value.match(/(\d{4}-\d{2}-\d{2})/);
                        const timeMatch = value.match(/(\d{2}:\d{2})/);
                        if (dateMatch) answer.dateValue = dateMatch[1];
                        if (timeMatch) answer.timeValue = timeMatch[1];
                        if (answer.dateValue || answer.timeValue) {
                            payload.answers.push(answer);
                        }
                    }
                } else if (q.type === 'open-ended' || q.type === 'rating-scale') {
                    answer.answerText = String(value);
                    if (answer.answerText.trim()) {
                        payload.answers.push(answer);
                    }
                }
            });

            const response = await publicApiClient.post('/api/public/responses', payload);
            return response.data;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!activeSurvey) {
            console.error("❌ No survey loaded");
            showNotification('error', "Không tìm thấy khảo sát. Vui lòng làm mới trang và thử lại.");
            return;
        }

        if (!validateForm()) {
            console.warn("⚠️ Validation failed");
            return;
        }

        setLoading(true);

        // Tính toán durationSeconds từ khi bắt đầu làm khảo sát đến khi submit
        const durationSeconds = surveyStartTimeRef.current
            ? Math.floor((Date.now() - surveyStartTimeRef.current) / 1000)
            : 0;

        const requestToken = getOrCreateRequestToken();

        // Debug: Kiểm tra token trước khi submit
        const currentToken = localStorage.getItem("respondent_request_token");
        console.log('🔍 Current token in localStorage:', currentToken);
        console.log('📝 Responses to submit:', responses);
        console.log('📊 Survey data:', activeSurvey);
        console.log('🆔 Survey ID:', activeSurvey?.id);
        console.log('⏱️ Duration seconds:', durationSeconds);

        // Validation: Check if survey ID exists
        if (!activeSurvey?.id) {
            console.error('❌ Survey ID is missing!');
            setErrors({ submit: "Không tìm thấy thông tin khảo sát. Vui lòng tải lại trang." });
            return;
        }

        try {
            // Sử dụng public API thay vì responseService
            const apiResult = await submitPublicResponse(
                activeSurvey.id,
                responses,
                activeSurvey,
                durationSeconds,
                requestToken
            );
            console.log("✅ Submit public response result:", apiResult);
            if (requestToken) {
                markSurveyAsSubmitted(activeSurvey.id, requestToken);
            }
            setSuccess(true);
            // Reset form sau khi submit thành công
            setResponses({});
        } catch (err) {
            console.error("❌ Submit failed:", err);
            console.error("❌ Error details:", err.response?.data);
            console.error("❌ Error status:", err.response?.status);
            console.error("❌ Error config:", err.config?.url);
            
            let errorMessage = "Có lỗi xảy ra khi gửi phản hồi. Vui lòng thử lại.";
            
            if (err.code === 'ECONNABORTED') {
                errorMessage = "Upload quá lâu, vui lòng kiểm tra kết nối mạng và thử lại.";
            } else if (err.response?.status === 413) {
                errorMessage = "File quá lớn để upload. Vui lòng chọn file nhỏ hơn.";
            } else if (err.response?.status === 400) {
                errorMessage = err.response?.data?.message || "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.";
            } else if (err.response?.status === 403) {
                errorMessage = "Không có quyền truy cập. Vui lòng thử lại.";
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            }
            
            showNotification('error', errorMessage);
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
                                        // Validate file size (50MB limit)
                                        const maxSize = 50 * 1024 * 1024; // 50MB
                                        if (file.size > maxSize) {
                                            showNotification('error', `File "${file.name}" quá lớn. Kích thước tối đa là 50MB.`);
                                            e.target.value = ''; // Clear input
                                            return;
                                        }
                                        
                                        // Validate file type
                                        const allowedTypes = [
                                            'application/pdf',
                                            'application/msword',
                                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                            'application/vnd.ms-excel',
                                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                            'application/vnd.ms-powerpoint',
                                            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                                            'text/plain',
                                            'application/zip',
                                            'application/x-rar-compressed',
                                            'image/jpeg',
                                            'image/jpg',
                                            'image/png',
                                            'image/gif',
                                            'image/webp',
                                            'image/bmp',
                                            'image/svg+xml'
                                        ];
                                        
                                        if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.rar')) {
                                            showNotification('error', `File "${file.name}" có định dạng không được hỗ trợ.`);
                                            e.target.value = ''; // Clear input
                                            return;
                                        }
                                        
                                        console.log('📁 File selected:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB', 'Type:', file.type);
                                        handleChange(q.id, file);
                                    }
                                }}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg"
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
        </>
    );
};

export default PublicResponsePage;
