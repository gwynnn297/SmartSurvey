import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { surveyService } from '../../services/surveyService';
import { questionService, optionService } from '../../services/questionSurvey';
import { aiSurveyService } from '../../services/aiSurveyService';
import { categoryService } from '../../services/categoryService';
import NotificationModal from '../../components/NotificationModal';
import './CreateAI.css';
import '../Survey/CreateSurvey.css';

// 🧩 DND Kit
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


// ✅ 8 loại câu hỏi chính thức theo backend - đồng bộ với CreateSurvey
const QUESTION_TYPE_OPTIONS = [
    { value: 'open_ended', label: 'Câu hỏi mở' },
    { value: 'multiple_choice', label: 'Trắc nghiệm nhiều lựa chọn' },
    { value: 'single_choice', label: 'Trắc nghiệm một lựa chọn' },
    { value: 'boolean_', label: 'Đúng / Sai' },
    { value: 'ranking', label: 'Xếp hạng' },
    { value: 'date_time', label: 'Ngày / Giờ' },
    { value: 'rating', label: 'Đánh giá' },
    { value: 'file_upload', label: 'Tải file lên' }
];

const mapTypeFromBackend = (type) => {
    switch (type) {
        case 'open_ended':
            return 'open_ended';
        case 'boolean':
        case 'boolean_':
            return 'boolean_';
        default:
            return type || 'open_ended';
    }
};

const mapTypeToBackend = (type) => {
    switch (type) {
        case 'short_text':
        case 'open_ended':
            return 'open_ended';
        case 'yes_no':
        case 'boolean_':
            return 'boolean_';
        default:
            return type;
    }
};
const needsOptions = (questionType) => {
    return ['multiple_choice', 'single_choice', 'boolean_', 'ranking'].includes(questionType);
};


const createEmptyOption = (text = '') => ({
    id: `temp_option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    option_text: text
});

const createDefaultOptions = () => [
    createEmptyOption('Lựa chọn 1'),
    createEmptyOption('Lựa chọn 2')
];

const createYesNoOptions = () => [
    createEmptyOption('Có'),
    createEmptyOption('Không')
];

const createEmptyQuestion = (type = 'open_ended') => {
    const base = {
        id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        question_text: '',
        question_type: type,
        options: [],
        is_required: false
    };

    if (type === 'multiple_choice' || type === 'single_choice') {
        return {
            ...base,
            options: createDefaultOptions(),
            choice_type: type === 'multiple_choice' ? 'multiple' : 'single'
        };
    }

    if (type === 'boolean_' || type === 'yes_no') {
        return {
            ...base,
            options: createYesNoOptions()
        };
    }

    if (type === 'ranking') {
        return {
            ...base,
            options: createDefaultOptions()
        };
    }

    if (type === 'rating') {
        return {
            ...base,
            rating_scale: 5
        };
    }

    if (type === 'date_time') {
        return {
            ...base,
            // No special config needed
        };
    }

    if (type === 'file_upload') {
        return {
            ...base,
            // No special config needed
        };
    }

    return base;
};

const normalizeQuestionData = (rawQuestion) => {
    if (!rawQuestion) {
        return createEmptyQuestion();
    }

    const questionId = rawQuestion.id || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const backendType = rawQuestion.question_type || rawQuestion.questionType || rawQuestion.type || 'open_ended';
    const normalizedType = mapTypeFromBackend(backendType);

    const base = {
        id: questionId,
        question_text: rawQuestion.question_text || rawQuestion.questionText || rawQuestion.text || '',
        question_type: normalizedType,
        is_required: rawQuestion.is_required ?? rawQuestion.isRequired ?? rawQuestion.required ?? false,
        options: []
    };

    if (normalizedType === 'multiple_choice' || normalizedType === 'single_choice') {
        const rawOptions = rawQuestion.options || rawQuestion.optionsList || [];
        const mappedOptions = rawOptions.length > 0
            ? rawOptions.map(opt => ({
                id: opt?.id || `temp_option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                option_text: opt?.option_text ?? opt?.optionText ?? opt?.text ?? ''
            }))
            : createDefaultOptions();
        return {
            ...base,
            options: mappedOptions,
            choice_type: rawQuestion.choice_type || rawQuestion.choiceType || (normalizedType === 'multiple_choice' ? 'multiple' : 'single')
        };
    }

    if (normalizedType === 'boolean_' || normalizedType === 'yes_no') {
        const rawOptions = rawQuestion.options || [];
        // Giữ nguyên options từ AI nếu có, không override thành Có/Không
        const mappedOptions = rawOptions.length > 0
            ? rawOptions.map(opt => ({
                id: opt?.id || `temp_option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                option_text: opt?.option_text ?? opt?.optionText ?? opt?.text ?? ''
            }))
            : createYesNoOptions(); // Chỉ fallback khi không có options
        return {
            ...base,
            options: mappedOptions
        };
    }

    if (normalizedType === 'ranking') {
        const rawOptions = rawQuestion.options || rawQuestion.optionsList || [];
        const mappedOptions = rawOptions.length > 0
            ? rawOptions.map(opt => ({
                id: opt?.id || `temp_option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                option_text: opt?.option_text ?? opt?.optionText ?? opt?.text ?? ''
            }))
            : createDefaultOptions();
        return {
            ...base,
            options: mappedOptions
        };
    }

    if (normalizedType === 'rating') {
        return {
            ...base,
            rating_scale: rawQuestion.rating_scale || rawQuestion.ratingScale || 5
        };
    }

    if (normalizedType === 'date_time' || normalizedType === 'file_upload') {
        return base;
    }

    return base;
};

// 🎯 Sortable Ranking Option Component
function SortableRankingOption({ id, index, option, error, onTextChange, onDelete, disabled, onMoveUp, onMoveDown, totalCount }) {
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
        <div
            ref={setNodeRef}
            style={style}
            className={`ranking-option-item ${isDragging ? 'is-dragging' : ''}`}
        >
            <div className="ranking-handle" {...attributes} {...listeners}>
                <i className="fa-solid fa-grip-vertical" aria-hidden="true"></i>
            </div>
            <span className="ranking-number">{index + 1}</span>
            <input
                className={`option-input ranking-input ${error ? 'error' : ''}`}
                value={option.option_text}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder={`Lựa chọn ${index + 1}`}
            />
            <div className="ranking-actions">
                <button
                    type="button"
                    className="ranking-move-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMoveUp?.();
                    }}
                    disabled={index === 0}
                    aria-label="Di chuyển lên"
                    title="Di chuyển lên"
                >
                    <i className="fa-solid fa-chevron-up" aria-hidden="true"></i>
                </button>
                <button
                    type="button"
                    className="ranking-move-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMoveDown?.();
                    }}
                    disabled={index === totalCount - 1}
                    aria-label="Di chuyển xuống"
                    title="Di chuyển xuống"
                >
                    <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
                </button>
            </div>
            <button
                type="button"
                className="remove-option"
                onClick={() => {
                    if (totalCount <= 2) return;
                    if (window.confirm('Bạn có chắc muốn xóa lựa chọn này không?')) {
                        onDelete?.();
                    }
                }}
                disabled={totalCount <= 2 || disabled}
                aria-label="Xóa lựa chọn"
            >
                <i className="fa-solid fa-delete-left" aria-hidden="true"></i>
            </button>
        </div>
    );
}

export default function CreateAI() {
    const navigate = useNavigate();
    const [savedSurveyId, setSavedSurveyId] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [form, setForm] = useState({
        title: '',
        category_id: '',
        category_name: '',
        description: '',
        ai_context: '',
        target_audience: '',
        question_count: '',
        question_type_priorities: [] // Danh sách loại câu hỏi ưu tiên
    });

    const [errors, setErrors] = useState({});
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [questions, setQuestions] = useState([]);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(null);
    const [refreshingQuestions, setRefreshingQuestions] = useState(new Set());
    const [showRefreshModal, setShowRefreshModal] = useState(false);
    const [refreshingQuestionIndex, setRefreshingQuestionIndex] = useState(null);
    const [selectedRefreshType, setSelectedRefreshType] = useState('');
    const [showProcessingModal, setShowProcessingModal] = useState(false);
    const [showAIPreviewModal, setShowAIPreviewModal] = useState(false);
    const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState([]);
    const [aiPreviewData, setAiPreviewData] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [showForm, setShowForm] = useState(true);
    const [showMobileView, setShowMobileView] = useState(false);
    const [notification, setNotification] = useState(null);

    // Ref để ngăn việc lưu nhiều lần
    const isSavingRef = useRef(false);

    // Hàm helper để hiển thị notification
    const showNotification = (type, message) => {
        setNotification({ type, message });
    };

    // DND Kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        })
    );

    useEffect(() => {
        loadCategories();

        // Kiểm tra xem có dữ liệu tạm thời từ preview không
        const tempData = localStorage.getItem('aiSurveyTempData');
        if (tempData) {
            try {
                const parsed = JSON.parse(tempData);
                // Kiểm tra dữ liệu không quá cũ (dưới 1 giờ)
                if (Date.now() - parsed.timestamp < 3600000) {
                    setForm(parsed.form);
                    setQuestions(parsed.questions);
                    setActiveQuestionIndex(parsed.activeQuestionIndex);
                    setShowForm(false);
                    // Xóa dữ liệu tạm thời sau khi sử dụng
                    localStorage.removeItem('aiSurveyTempData');
                }
            } catch (error) {
                console.error('Error parsing temp data:', error);
                localStorage.removeItem('aiSurveyTempData');
            }
        }
    }, []);

    useEffect(() => {
        if (questions.length === 0) {
            setActiveQuestionIndex(null);
            return;
        }

        if (activeQuestionIndex === null || activeQuestionIndex >= questions.length) {
            setActiveQuestionIndex(0);
        }
    }, [questions, activeQuestionIndex]);

    const loadCategories = async () => {
        try {
            console.log('🔄 Loading categories...');
            const categoriesData = await categoryService.getAllCategories();
            console.log('✅ Categories loaded:', categoriesData);
            console.log('📊 Number of categories:', categoriesData?.length); // Debug log
            console.log('🔍 Category structure sample:', categoriesData?.[0]); // Debug log

            setCategories(categoriesData);
        } catch (error) {
            console.error('❌ Error loading categories:', error);
            // Không cần thiết phải có categories từ DB vì user có thể nhập tự do
            setCategories([]);
        } finally {
            setCategoriesLoading(false);
        }
    };

    const syncSurveyFromServer = async (surveyId) => {
        if (!surveyId) {
            return false;
        }

        try {
            const detail = await surveyService.getSurveyDetail(surveyId);
            if (!detail) {
                return false;
            }

            setForm(prev => {
                const next = { ...prev };
                if (detail.title !== undefined && detail.title !== null) {
                    next.title = detail.title;
                }
                if (detail.description !== undefined && detail.description !== null) {
                    next.description = detail.description;
                }
                if (detail.categoryId) {
                    next.category_id = detail.categoryId.toString();
                }
                if (detail.categoryName) {
                    next.category_name = detail.categoryName;
                }
                if (detail.aiPrompt) {
                    next.ai_context = detail.aiPrompt;
                }
                if (Array.isArray(detail.questions)) {
                    next.question_count = detail.questions.length;
                }
                return next;
            });

            if (Array.isArray(detail.questions)) {
                const normalizedQuestions = detail.questions.map(question => normalizeQuestionData({
                    id: question.id,
                    question_text: question.question_text || question.questionText || question.text,
                    question_type: question.question_type || question.questionType || question.type,
                    is_required: question.is_required ?? question.isRequired ?? question.required,
                    options: question.options?.map(option => ({
                        id: option.id,
                        option_text: option.option_text ?? option.optionText ?? option.text
                    }))
                }));
                setQuestions(normalizedQuestions);
            }

            return true;
        } catch (error) {
            console.warn('⚠️ Không thể đồng bộ khảo sát AI từ server:', error);
            return false;
        }
    };

    // Handle category selection change
    const handleCategorySelectChange = (value) => {
        const selected = categories.find(
            (cat) => String(cat.categoryId ?? cat.id) === value
        );
        setForm(prev => ({
            ...prev,
            category_id: value,
            category_name: selected ? (selected.categoryName || selected.name || '') : ''
        }));
        clearError('category_id');
        clearError('category_name');
    };

    useEffect(() => {
        if (!form.category_id || !categories.length) return;
        const selected = categories.find(
            (cat) => String(cat.categoryId ?? cat.id) === form.category_id
        );
        if (selected) {
            setForm(prev => {
                if ((selected.categoryName || selected.name || '') === prev.category_name) return prev;
                return {
                    ...prev,
                    category_name: selected.categoryName || selected.name || ''
                };
            });
        }
    }, [categories, form.category_id]);

    const stats = useMemo(() => {
        const total = questions.length;
        const required = questions.filter(q => q.is_required).length;
        const multipleChoice = questions.filter(q => q.question_type === 'multiple_choice').length;
        const singleChoice = questions.filter(q => q.question_type === 'single_choice').length;
        const booleanQ = questions.filter(q => q.question_type === 'boolean_' || q.question_type === 'yes_no').length;
        const ranking = questions.filter(q => q.question_type === 'ranking').length;
        const rating = questions.filter(q => q.question_type === 'rating').length;
        const dateTime = questions.filter(q => q.question_type === 'date_time').length;
        const fileUpload = questions.filter(q => q.question_type === 'file_upload').length;
        const closed = multipleChoice + singleChoice + booleanQ + ranking + rating;
        return {
            total,
            required,
            multipleChoice,
            singleChoice,
            booleanQ,
            ranking,
            rating,
            dateTime,
            fileUpload,
            open: total - closed
        };
    }, [questions]);

    const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

    const clearError = (key) => {
        setErrors(prev => {
            if (!prev[key]) return prev;
            const updated = { ...prev };
            delete updated[key];
            return updated;
        });
    };

    const clearQuestionErrors = () => {
        setErrors(prev => {
            const hasQuestionError = Object.keys(prev).some(key => key.startsWith('question_'));
            if (!hasQuestionError) return prev;
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (key.startsWith('question_')) {
                    delete updated[key];
                }
            });
            return updated;
        });
    };

    const handleFormChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const validateForm = () => {
        const newErrors = {};
        if (!form.title.trim()) {
            newErrors.title = 'Tiêu đề khảo sát là bắt buộc';
        }
        if (!form.category_id) {
            newErrors.category_id = 'Vui lòng chọn danh mục khảo sát';
        }
        if (!form.ai_context.trim()) {
            newErrors.ai_context = 'Vui lòng nhập ngữ cảnh chi tiết';
        } else if (form.ai_context.trim().length < 20) {
            newErrors.ai_context = 'Ngữ cảnh quá ngắn. Vui lòng mô tả chi tiết hơn (ít nhất 20 ký tự)';
        }
        const questionCount = Number(form.question_count);
        if (!questionCount || questionCount < 1 || questionCount > 20) {
            newErrors.question_count = 'Vui lòng nhập số lượng câu hỏi từ 1 đến 20';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateQuestions = () => {
        const newErrors = {};
        if (questions.length === 0) {
            newErrors.questions = 'Khảo sát phải có ít nhất 1 câu hỏi';
        }
        questions.forEach((q, idx) => {
            if (!q.question_text.trim()) {
                newErrors[`question_${idx}`] = 'Nội dung câu hỏi là bắt buộc';
            }
            if (q.question_type === 'multiple_choice' || q.question_type === 'single_choice') {
                const validOpts = q.options?.filter(o => o.option_text.trim());
                if (!validOpts || validOpts.length < 2) {
                    newErrors[`question_${idx}_options`] = 'Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn';
                }
            }
            if (q.question_type === 'boolean_' || q.question_type === 'yes_no') {
                const yesNoOpts = q.options?.filter(o => o.option_text.trim());
                if (!yesNoOpts || yesNoOpts.length < 2) {
                    newErrors[`question_${idx}_options`] = 'Câu hỏi Đúng/Sai cần tối thiểu 2 lựa chọn';
                }
            }
            if (q.question_type === 'ranking') {
                const rankingOpts = q.options?.filter(o => o.option_text.trim());
                if (!rankingOpts || rankingOpts.length < 2) {
                    newErrors[`question_${idx}_options`] = 'Câu hỏi xếp hạng cần ít nhất 2 lựa chọn';
                }
            }
        });
        setErrors(prev => ({ ...prev, ...newErrors }));
        return Object.keys(newErrors).length === 0;
    };

    const handleGenerateQuestions = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setShowProcessingModal(true);
        setCurrentStep(0);
        setProgress(0);

        try {
            // Tối ưu progress animation - nhanh hơn
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    const newProgress = prev + 15;
                    if (newProgress >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return newProgress;
                });
                setCurrentStep(prev => Math.min(prev + 1, 3));
            }, 300); // Giảm từ 500ms xuống 300ms

            // Sử dụng đúng số lượng câu hỏi người dùng yêu cầu
            const requestedQuestions = parseInt(form.question_count);

            // Gọi API backend thật
            const requestData = {
                title: form.title,
                description: form.description,
                categoryId: form.category_id ? Number(form.category_id) : null,
                categoryName: form.category_name,
                aiPrompt: form.ai_context,
                targetAudience: form.target_audience || null,
                numberOfQuestions: requestedQuestions, // Sử dụng đúng số lượng người dùng yêu cầu
                questionTypePriorities: form.question_type_priorities.length > 0 ? form.question_type_priorities : null // Gửi priorities nếu có
            };

            console.log("🚀 Calling AI backend with:", requestData);
            console.log("📊 Question Type Priorities:", form.question_type_priorities);
            console.log("📊 Priorities length:", form.question_type_priorities.length);

            const aiResponse = await aiSurveyService.generateSurvey(requestData);

            // Clear progress interval và set 100%
            clearInterval(progressInterval);
            setProgress(100);
            setCurrentStep(4);

            if (aiResponse.success && (aiResponse.generated_survey || aiResponse.generatedSurvey)) {
                // Map response từ backend về format frontend
                const surveyData = aiResponse.generated_survey || aiResponse.generatedSurvey;
                const mappedQuestions = surveyData.questions.map((q, index) => {
                    const mappedType = mapTypeFromBackend(q.question_type || q.questionType);
                    const mappedOptions = q.options ? q.options.map((opt, optIndex) => ({
                        id: `temp_option_${Date.now()}_${optIndex}`,
                        option_text: opt.option_text || opt.optionText
                    })) : [];

                    console.log(`🔍 Q${index + 1} [${mappedType}]:`, {
                        rawType: q.question_type || q.questionType,
                        mappedType,
                        hasOptions: !!q.options,
                        optionsCount: mappedOptions.length,
                        options: mappedOptions
                    });

                    return {
                        id: `temp_${Date.now()}_${index}`,
                        question_text: q.question_text || q.questionText,
                        question_type: mappedType,
                        is_required: q.is_required ?? q.isRequired ?? true,
                        options: mappedOptions
                    };
                });

                setQuestions(mappedQuestions);
                console.log("✅ AI generated questions:", mappedQuestions);

                // ✅ NEW FLOW: Preview first, save only when user accepts
                // Survey ID will be available after user clicks "Accept" in preview modal
                console.log("📋 Preview mode: Survey not saved yet (waiting for user confirmation)")

                // Kiểm tra xem có cần tạo thêm câu hỏi không
                const currentQuestions = mappedQuestions.length;
                const requestedQuestions = parseInt(form.question_count);

                if (requestedQuestions > currentQuestions) {
                    console.log(`📝 Backend chỉ trả về ${currentQuestions} câu, yêu cầu ${requestedQuestions} câu.`);
                    console.log(`💡 Sẽ tạo thêm ${requestedQuestions - currentQuestions} câu hỏi...`);

                    // Tạo thêm câu hỏi nếu còn thiếu
                    const remainingQuestions = requestedQuestions - currentQuestions;
                    const additionalRequestData = {
                        title: form.title,
                        description: form.description,
                        categoryId: form.category_id ? Number(form.category_id) : null,
                        categoryName: form.category_name,
                        aiPrompt: form.ai_context + ` (Tạo thêm ${remainingQuestions} câu hỏi bổ sung cho khảo sát này)`,
                        targetAudience: form.target_audience || null,
                        numberOfQuestions: remainingQuestions
                    };

                    try {
                        const additionalResponse = await aiSurveyService.generateSurvey(additionalRequestData);
                        if (additionalResponse.success && additionalResponse.generated_survey?.questions) {
                            const additionalMappedQuestions = additionalResponse.generated_survey.questions.map((q, index) => ({
                                id: `temp_${Date.now()}_${currentQuestions + index}`,
                                question_text: q.question_text || q.questionText,
                                question_type: mapTypeFromBackend(q.question_type || q.questionType),
                                is_required: q.is_required ?? q.isRequired ?? true,
                                options: q.options ? q.options.map((opt, optIndex) => ({
                                    id: `temp_option_${Date.now()}_${currentQuestions + index}_${optIndex}`,
                                    option_text: opt.option_text || opt.optionText
                                })) : []
                            }));

                            // Thêm các câu hỏi bổ sung vào danh sách
                            setQuestions(prev => [...prev, ...additionalMappedQuestions]);
                            console.log(`✅ Đã tạo thêm ${additionalMappedQuestions.length} câu hỏi bổ sung`);
                        }
                    } catch (err) {

                        console.warn('⚠️ Không thể tạo thêm câu hỏi bổ sung:', err);
                        // Vẫn hiển thị thông báo nếu không tạo được thêm
                        setTimeout(() => {
                            showNotification('success', `✅ Đã tạo ${currentQuestions} câu hỏi. Bạn có thể sử dụng nút "Tạo lại" để tạo thêm câu hỏi hoặc chỉnh sửa từng câu theo ý muốn.`);
                        }, 1500);
                    }
                } else {
                    console.log(`✅ Đã tạo đủ ${currentQuestions} câu hỏi như yêu cầu`);
                }

                // Lưu questions đã generate và preview data
                console.log("📊 Setting AI preview data:", {
                    questionCount: mappedQuestions.length,
                    title: form.title,
                    hasDescription: !!form.description
                });

                setAiGeneratedQuestions(mappedQuestions);
                setAiPreviewData({
                    success: true,
                    message: "Tạo khảo sát thành công",
                    surveyId: null,
                    generatedSurvey: {
                        title: form.title,
                        description: form.description,
                        questions: mappedQuestions
                    },
                    originalPrompt: form.ai_context, // Lưu prompt gốc để gọi API save
                    surveyTitle: form.title // Dùng form.title thay vì form.survey_name
                });

                // Đợi một chút để user thấy 100% rồi show preview
                setTimeout(() => {
                    console.log("✨ Opening AI preview modal");
                    setShowProcessingModal(false);
                    setShowAIPreviewModal(true);
                }, 1000);
            } else {
                throw new Error(aiResponse.message || 'Không thể tạo khảo sát từ AI');
            }

        } catch (e) {
            console.error("❌ AI generation error:", e);

            // Xử lý các loại lỗi khác nhau
            let errorMessage = "Không thể tạo khảo sát. Vui lòng thử lại.";

            if (e.response?.status === 401) {
                errorMessage = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
            } else if (e.response?.status === 500) {
                errorMessage = "Lỗi server. Vui lòng thử lại sau.";
            } else if (e.response?.data?.message) {
                errorMessage = e.response.data.message;
            } else if (e.message) {
                errorMessage = e.message;
            }

            // Hiển thị gợi ý nếu prompt không rõ ràng
            if (errorMessage.includes('Không thể tạo khảo sát') ||
                errorMessage.includes('prompt khác') ||
                errorMessage.includes('Vui lòng thử lại với prompt khác')) {
                errorMessage += '\n\n💡 Gợi ý cải thiện prompt:\n' +
                    '• Mô tả rõ mục đích khảo sát\n' +
                    '• Xác định đối tượng khảo sát\n' +
                    '• Nêu chi tiết nội dung cần khảo sát\n\n' +
                    '📝 Ví dụ tốt: "Tạo khảo sát đánh giá mức độ hài lòng của nhân viên IT về môi trường làm việc, bao gồm không gian làm việc, chính sách phúc lợi và cơ hội phát triển nghề nghiệp"';
            }

            showNotification('error', errorMessage);
            setShowProcessingModal(false);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelProcessing = () => {
        setShowProcessingModal(false);
        setCurrentStep(0);
        setProgress(0);
    };

    const handleAcceptAIResult = async () => {
        console.log("✅ User accepted AI result, saving to database...");

        try {
            setLoading(true);

            // Gọi API lưu survey sau khi user accept
            const response = await fetch('http://localhost:8080/ai/save-accepted-survey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({

                    title: aiPreviewData?.surveyTitle || form.title || 'AI Generated Survey',

                    description: aiPreviewData?.description || form.ai_context || 'Khảo sát được tạo bởi AI',
                    aiPrompt: aiPreviewData?.originalPrompt || form.ai_context || '',


                    categoryId: form.category_id ? Number(form.category_id) : null,

                    numberOfQuestions: aiGeneratedQuestions.length,
                    questionTypePriorities: form.question_type_priorities,


                    aiGeneratedData: {
                        success: aiPreviewData.success,
                        message: aiPreviewData.message,
                        survey_id: aiPreviewData.surveyId,
                        generated_survey: aiPreviewData.generatedSurvey ? {
                            title: aiPreviewData.generatedSurvey.title,
                            description: aiPreviewData.generatedSurvey.description,
                            questions: aiPreviewData.generatedSurvey.questions?.map(q => ({
                                question_text: q.questionText || q.question_text,
                                question_type: q.questionType || q.question_type,
                                is_required: q.isRequired !== undefined
                                    ? q.isRequired
                                    : (q.is_required !== undefined ? q.is_required : true),
                                display_order: q.displayOrder !== undefined
                                    ? q.displayOrder
                                    : q.display_order,
                                options: q.options?.map(opt => ({
                                    option_text: opt.optionText || opt.option_text,
                                    display_order: opt.displayOrder !== undefined
                                        ? opt.displayOrder
                                        : opt.display_order
                                }))
                            }))
                        } : null
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save survey');
            }

            const result = await response.json();

            const surveyId = result.surveyId ?? result.survey_id;

            if (!surveyId) {
                throw new Error('Backend không trả về surveyId');
            }

            setSavedSurveyId(surveyId);
            setIsEditMode(true);


            console.log("💾 Survey saved successfully:", result);

            // Giữ nguyên luồng UI
            const normalizedQuestions = aiGeneratedQuestions.map(q => {
                console.log("🔍 Question before normalize:", q.question_type, "options:", q.options);
                const normalized = normalizeQuestionData(q);
                console.log("✅ Question after normalize:", normalized.question_type, "options:", normalized.options);
                return normalized;
            });
            setQuestions(normalizedQuestions);
            setShowAIPreviewModal(false);
            setShowForm(false);

            showNotification(
                'success',
                '✅ Đã lưu khảo sát thành công! Bạn có thể chỉnh sửa câu hỏi ngay bây giờ.'
            );

        } catch (error) {
            console.error("❌ Error saving accepted survey:", error);
            showNotification('error', '❌ Lỗi khi lưu khảo sát: ' + error.message);
        } finally {
            setLoading(false);
        }
    };


    const handleRejectAIResult = () => {
        console.log("🔄 User rejected AI result, returning to prompt form");
        // User không thích kết quả, quay về form prompt
        setShowAIPreviewModal(false);
        setAiGeneratedQuestions([]);
        setAiPreviewData(null);
        showNotification('info', '💡 Hãy thử điều chỉnh prompt hoặc thay đổi các thiết lập để có kết quả tốt hơn.');
    };

    // Question handling functions
    const handleQuestionTextChange = (index, value) => {
        setQuestions(prev => {
            const next = [...prev];
            next[index] = { ...next[index], question_text: value };
            return next;
        });
        clearError(`question_${index}`);
    };

    const handleQuestionTypeChange = (index, type, choiceType) => {
        setQuestions(prev => {
            const next = [...prev];
            const current = { ...next[index], question_type: type };

            if (type === 'multiple_choice' || type === 'single_choice') {
                current.choice_type = choiceType || current.choice_type || (type === 'multiple_choice' ? 'multiple' : 'single');
                current.options = (current.options && current.options.length > 0)
                    ? current.options
                    : createDefaultOptions();
                delete current.rating_scale;
            } else if (type === 'boolean_' || type === 'yes_no') {
                current.options = createYesNoOptions();
                delete current.choice_type;
                delete current.rating_scale;
            } else if (type === 'ranking') {
                current.options = (current.options && current.options.length > 0)
                    ? current.options
                    : createDefaultOptions();
                delete current.choice_type;
                delete current.rating_scale;
            } else if (type === 'rating') {
                delete current.choice_type;
                current.options = [];
                current.rating_scale = current.rating_scale || 5;
            } else if (type === 'date_time' || type === 'file_upload') {
                delete current.choice_type;
                delete current.rating_scale;
                current.options = [];
            } else {
                delete current.choice_type;
                delete current.rating_scale;
                current.options = [];
            }

            next[index] = current;
            return next;
        });

        if (type !== 'multiple_choice' && type !== 'single_choice' && type !== 'ranking' && type !== 'boolean_') {
            clearError(`question_${index}_options`);
        }
    };

    const handleOptionChange = (questionIndex, optionIndex, value) => {
        setQuestions(prev => {
            const next = [...prev];
            const question = { ...next[questionIndex] };
            const options = [...(question.options || [])];
            options[optionIndex] = { ...options[optionIndex], option_text: value };
            question.options = options;
            next[questionIndex] = question;
            return next;
        });
        clearError(`question_${questionIndex}_options`);
    };

    const handleDeleteOption = (questionIndex, optionIndex) => {
        setQuestions(prev => {
            const currentQuestion = prev[questionIndex];
            if (!currentQuestion || (currentQuestion.question_type !== 'multiple_choice' &&
                currentQuestion.question_type !== 'single_choice' &&
                currentQuestion.question_type !== 'ranking')) {
                return prev;
            }
            const next = [...prev];
            const question = { ...next[questionIndex] };
            const currentOptions = [...(question.options || [])];

            // Không cho phép xóa nếu chỉ còn 2 option
            if (currentOptions.length <= 2) {
                return prev;
            }

            const options = currentOptions.filter((_, idx) => idx !== optionIndex);
            question.options = options;
            next[questionIndex] = question;
            return next;
        });
        clearError(`question_${questionIndex}_options`);
    };

    const handleAddOption = (questionIndex) => {
        setQuestions(prev => {
            const currentQuestion = prev[questionIndex];
            if (!currentQuestion || (currentQuestion.question_type !== 'multiple_choice' &&
                currentQuestion.question_type !== 'single_choice' &&
                currentQuestion.question_type !== 'ranking')) {
                return prev;
            }
            const next = [...prev];
            const question = { ...next[questionIndex] };
            const options = [...(question.options || [])];
            options.push(createEmptyOption());
            question.options = options;
            next[questionIndex] = question;
            return next;
        });
    };

    // Move option up/down for ranking
    const handleMoveOptionUp = (questionIndex, optionIndex) => {
        setQuestions(prev => {
            const next = [...prev];
            const question = { ...next[questionIndex] };
            const options = [...(question.options || [])];
            if (optionIndex > 0) {
                [options[optionIndex], options[optionIndex - 1]] = [options[optionIndex - 1], options[optionIndex]];
            }
            question.options = options;
            next[questionIndex] = question;
            return next;
        });
    };

    const handleMoveOptionDown = (questionIndex, optionIndex) => {
        setQuestions(prev => {
            const next = [...prev];
            const question = { ...next[questionIndex] };
            const options = [...(question.options || [])];
            if (optionIndex < options.length - 1) {
                [options[optionIndex], options[optionIndex + 1]] = [options[optionIndex + 1], options[optionIndex]];
            }
            question.options = options;
            next[questionIndex] = question;
            return next;
        });
    };

    const handleChoiceTypeChange = (questionIndex, value) => {
        setQuestions(prev => {
            const next = [...prev];
            const question = { ...next[questionIndex] };
            question.choice_type = value;
            next[questionIndex] = question;
            return next;
        });
    };

    const handleToggleRequired = (questionIndex) => {
        setQuestions(prev => {
            const next = [...prev];
            next[questionIndex] = {
                ...next[questionIndex],
                is_required: !next[questionIndex].is_required
            };
            return next;
        });
    };

    const handleSelectQuestion = (index) => {
        setActiveQuestionIndex(index);
    };

    const handleDuplicateQuestion = (index) => {
        if (!questions[index]) return;
        const cloned = {
            ...questions[index],
            id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            options: (questions[index].options || []).map(opt => createEmptyOption(opt.option_text))
        };
        const next = [...questions];
        next.splice(index + 1, 0, cloned);
        setQuestions(next);
        setActiveQuestionIndex(index + 1);
        clearError('questions');
    };
    const handleAddQuestion = (type = 'open_ended') => {
        const newIndex = questions.length;
        setQuestions(prev => [...prev, createEmptyQuestion(type)]);
        setActiveQuestionIndex(newIndex);
        clearError('questions');
        clearQuestionErrors();
    };
    const handleDeleteQuestion = (index) => {
        setQuestions(prev => prev.filter((_, i) => i !== index));
        setActiveQuestionIndex(prev => {
            if (prev === null) return prev;
            if (index < prev) return prev - 1;
            if (index === prev) return null;
            return prev;
        });
        clearQuestionErrors();
        clearError('questions');
    };

    const handleRefreshQuestion = async (questionIndex, targetQuestionType = null) => {
        try {
            setRefreshingQuestions(prev => new Set([...prev, questionIndex]));

            const currentQuestion = questions[questionIndex];
            if (!currentQuestion) return;

            const requestData = {
                originalPrompt: form.ai_context || form.title || 'Khảo sát',
                contextHint: currentQuestion.question_text || '',
                targetAudience: form.target_audience || 'Người tham gia khảo sát',
                categoryName: form.category_name || 'General',
                questionTypeHint: targetQuestionType || currentQuestion.question_type // Gửi loại câu hỏi mong muốn
            };

            console.log("🔄 Refreshing question with type:", targetQuestionType || currentQuestion.question_type);

            const response = await aiSurveyService.regenerateQuestion(requestData);

            if (response.success && response.question) {
                const aiQuestion = response.question;

                const newQuestion = {
                    id: currentQuestion.id,
                    question_text: aiQuestion.question_text || aiQuestion.questionText || '',
                    question_type: mapTypeFromBackend(aiQuestion.question_type || aiQuestion.questionType),
                    is_required: aiQuestion.is_required ?? aiQuestion.isRequired ?? true,
                    options: (aiQuestion.options || []).map((opt, optIndex) => ({
                        id: `temp_option_${Date.now()}_${optIndex}`,
                        option_text: opt.option_text || opt.optionText || ''
                    }))
                };

                if (newQuestion.question_type === 'multiple_choice') {
                    newQuestion.choice_type = 'multiple';
                    if (!newQuestion.options.length) newQuestion.options = createDefaultOptions();
                } else if (newQuestion.question_type === 'single_choice') {
                    newQuestion.choice_type = 'single';
                    if (!newQuestion.options.length) newQuestion.options = createDefaultOptions();
                } else if (newQuestion.question_type === 'boolean_' || newQuestion.question_type === 'yes_no') {
                    if (!newQuestion.options.length) newQuestion.options = createYesNoOptions();
                } else if (newQuestion.question_type === 'ranking') {
                    if (!newQuestion.options.length) newQuestion.options = createDefaultOptions();
                } else if (newQuestion.question_type === 'rating') {
                    newQuestion.rating_scale = 5;
                    newQuestion.options = [];
                } else if (!needsOptions(newQuestion.question_type)) {
                    newQuestion.options = [];
                }

                setQuestions(prev => {
                    const next = [...prev];
                    next[questionIndex] = newQuestion;
                    return next;
                });
            } else {
                throw new Error(response.message || 'Không thể tạo câu hỏi mới');
            }

        } catch (error) {
            console.error('❌ Error refreshing question:', error);

            let errorMessage = 'Không thể tạo câu hỏi mới. Vui lòng thử lại.';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            showNotification('error', errorMessage);
        } finally {
            // Xóa questionIndex khỏi set đang refresh
            setRefreshingQuestions(prev => {
                const next = new Set(prev);
                next.delete(questionIndex);
                return next;
            });
        }
    };

    const handleSaveSurvey = async () => {
        if (isSavingRef.current || loading) {
            console.log('⚠️ Save operation already in progress, ignoring duplicate call');
            return;
        }

        if (!validateQuestions()) return;

        isSavingRef.current = true;
        setLoading(true);

        try {
            const surveyPayload = {
                title: form.title,
                description: form.description,
                categoryId: form.category_id ? Number(form.category_id) : 1,
                aiPrompt: form.ai_context
            };


            if (!savedSurveyId) {
                throw new Error('Survey chưa được khởi tạo. Vui lòng tạo khảo sát bằng AI trước.');
            }

            const surveyId = savedSurveyId;

            console.log('🔄 Saving AI survey (draft):', surveyId, surveyPayload);

            await surveyService.updateSurvey(surveyId, {
                ...surveyPayload,
                status: 'draft'
            });


            setSavedSurveyId(surveyId);
            setIsEditMode(true);

            // Xoá câu hỏi cũ trên server nếu người dùng đã xoá ở UI
            let existingQuestions = [];
            try {
                existingQuestions = await questionService.getQuestionsBySurvey(surveyId);
            } catch (error) {
                console.warn('⚠️ Không thể tải danh sách câu hỏi hiện có:', error);
            }

            const currentRealQuestionIds = new Set(
                questions
                    .map(q => q.id)
                    .filter(id => id && !id.toString().startsWith('temp_'))
            );

            for (const serverQuestion of existingQuestions) {
                if (!currentRealQuestionIds.has(serverQuestion.id)) {
                    try {
                        const serverOptions = await optionService.getOptionsByQuestion(serverQuestion.id);
                        for (const option of serverOptions) {
                            try {
                                await optionService.deleteOption(option.id);
                            } catch (error) {
                                console.warn(`⚠️ Không thể xóa option ${option.id}:`, error);
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠️ Không thể lấy options để xóa cho câu hỏi ${serverQuestion.id}:`, error);
                    }

                    try {
                        await questionService.deleteQuestion(serverQuestion.id);
                    } catch (error) {
                        console.warn(`⚠️ Không thể xóa câu hỏi ${serverQuestion.id}:`, error);
                    }
                }
            }

            // tạo / cập nhật câu hỏi hiện có
            for (const question of questions) {
                const backendType = mapTypeToBackend(question.question_type);
                const questionPayload = {
                    questionText: question.question_text,
                    questionType: backendType,
                    isRequired: question.is_required ?? false
                };

                let savedQuestion;
                if (question.id && !question.id.toString().startsWith('temp_')) {
                    savedQuestion = await questionService.updateQuestion(question.id, questionPayload);
                } else {
                    savedQuestion = await questionService.createQuestion({
                        surveyId,
                        ...questionPayload
                    });
                }

                const questionId = savedQuestion?.id || question.id;

                if (needsOptions(question.question_type) && questionId) {
                    let serverOptions = [];
                    try {
                        serverOptions = await optionService.getOptionsByQuestion(questionId);
                    } catch (error) {
                        console.warn(`⚠️ Không thể lấy options hiện có cho câu hỏi ${questionId}:`, error);
                    }

                    const currentOptionRealIds = new Set(
                        (question.options || [])
                            .map(opt => opt.id)
                            .filter(id => id && !id.toString().startsWith('temp_option_'))
                    );

                    for (const serverOption of serverOptions) {
                        if (!currentOptionRealIds.has(serverOption.id)) {
                            try {
                                await optionService.deleteOption(serverOption.id);
                            } catch (error) {
                                console.warn(`⚠️ Không thể xóa option ${serverOption.id}:`, error);
                            }
                        }
                    }

                    for (const option of question.options || []) {
                        if (!option.option_text || !option.option_text.trim()) continue;

                        if (option.id && !option.id.toString().startsWith('temp_option_')) {
                            try {
                                await optionService.updateOption(option.id, {
                                    optionText: option.option_text
                                });
                            } catch (error) {
                                console.warn(`⚠️ Không thể cập nhật option ${option.id}:`, error);
                            }
                        } else {
                            try {
                                await optionService.createOption({
                                    questionId,
                                    optionText: option.option_text
                                });
                            } catch (error) {
                                console.warn('⚠️ Không thể tạo mới option:', error);
                            }
                        }
                    }
                }
            }

            if (surveyId) {
                await syncSurveyFromServer(surveyId);
            }

            showNotification('success', isEditMode ? '✅ Đã cập nhật khảo sát thành công!' : '✅ Lưu khảo sát thành công!');
            // bỏ navigate nếu muốn ở lại trang
            // navigate('/dashboard');

        } catch (error) {
            console.error('❌ Error saving survey:', error);

            let errorMessage = 'Không thể lưu khảo sát. Vui lòng thử lại.';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            showNotification('error', '❌ ' + errorMessage);
        } finally {
            setLoading(false);
            isSavingRef.current = false;
        }
    };

    const handleShareSurvey = async () => {
        if (!validateQuestions()) {
            showNotification('warning', 'Vui lòng hoàn thành tất cả thông tin bắt buộc trước khi chia sẻ khảo sát.');
            return;
        }

        setLoading(true);
        try {
            if (!savedSurveyId) {
                throw new Error('Survey chưa được khởi tạo. Vui lòng lưu khảo sát trước khi chia sẻ.');
            }

            const surveyId = savedSurveyId;

            await surveyService.updateSurvey(surveyId, {
                title: form.title,
                description: form.description,
                categoryId: form.category_id ? Number(form.category_id) : 1,
                status: 'published',
                aiPrompt: form.ai_context
            });


            // Đồng bộ câu hỏi giống trong handleSaveSurvey
            let existingQuestions = [];
            try {
                existingQuestions = await questionService.getQuestionsBySurvey(surveyId);
            } catch (error) {
                console.warn('⚠️ Không thể tải danh sách câu hỏi hiện có:', error);
            }

            const currentRealQuestionIds = new Set(
                questions
                    .map(q => q.id)
                    .filter(id => id && !id.toString().startsWith('temp_'))
            );

            for (const serverQuestion of existingQuestions) {
                if (!currentRealQuestionIds.has(serverQuestion.id)) {
                    try {
                        const serverOptions = await optionService.getOptionsByQuestion(serverQuestion.id);
                        for (const option of serverOptions) {
                            await optionService.deleteOption(option.id);
                        }
                    } catch (error) {
                        console.warn(`⚠️ Không thể lấy options để xóa cho câu hỏi ${serverQuestion.id}:`, error);
                    }

                    try {
                        await questionService.deleteQuestion(serverQuestion.id);
                    } catch (error) {
                        console.warn(`⚠️ Không thể xóa câu hỏi ${serverQuestion.id}:`, error);
                    }
                }
            }

            for (const question of questions) {
                const backendType = mapTypeToBackend(question.question_type);
                const questionPayload = {
                    questionText: question.question_text,
                    questionType: backendType,
                    isRequired: question.is_required ?? true
                };

                let savedQuestion;
                if (question.id && !question.id.toString().startsWith('temp_')) {
                    savedQuestion = await questionService.updateQuestion(question.id, questionPayload);
                } else {
                    savedQuestion = await questionService.createQuestion({
                        surveyId,
                        ...questionPayload
                    });
                }

                const questionId = savedQuestion?.id || question.id;

                if (needsOptions(question.question_type) && questionId) {
                    let serverOptions = [];
                    try {
                        serverOptions = await optionService.getOptionsByQuestion(questionId);
                    } catch (error) {
                        console.warn(`⚠️ Không thể lấy options hiện có cho câu hỏi ${questionId}:`, error);
                    }

                    const currentOptionRealIds = new Set(
                        (question.options || [])
                            .map(opt => opt.id)
                            .filter(id => id && !id.toString().startsWith('temp_option_'))
                    );

                    for (const serverOption of serverOptions) {
                        if (!currentOptionRealIds.has(serverOption.id)) {
                            await optionService.deleteOption(serverOption.id);
                        }
                    }

                    for (const option of question.options || []) {
                        if (!option.option_text || !option.option_text.trim()) continue;

                        if (option.id && !option.id.toString().startsWith('temp_option_')) {
                            await optionService.updateOption(option.id, {
                                optionText: option.option_text
                            });
                        } else {
                            await optionService.createOption({
                                questionId,
                                optionText: option.option_text
                            });
                        }
                    }
                }
            }

            await surveyService.updateSurvey(surveyId, { status: 'published' });

            if (surveyId) {
                await syncSurveyFromServer(surveyId);
            }
            // điều hướng tới trang share 
            navigate(`/view-link-share/${surveyId}`);

        } catch (error) {
            console.error('Lỗi khi chia sẻ khảo sát:', error);
            let errorMessage = 'Có lỗi xảy ra khi chia sẻ khảo sát. Vui lòng thử lại.';

            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            showNotification('error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToForm = () => {
        // Xóa dữ liệu tạm thời nếu có
        localStorage.removeItem('aiSurveyTempData');
        setShowForm(true);
        setQuestions([]);
        setActiveQuestionIndex(null);
    };

    // Build preview survey xem trước khảo sát ResponseFormPage
    const buildPreviewSurvey = () => {
        const mappedQuestions = questions.map(q => {
            let type = 'open-ended';
            if (q.question_type === 'multiple_choice') {
                type = q.choice_type === 'multiple' ? 'multiple-choice-multiple' : 'multiple-choice-single';
            } else if (q.question_type === 'single_choice') {
                type = 'multiple-choice-single';
            } else if (q.question_type === 'boolean_' || q.question_type === 'yes_no') {
                type = 'boolean';
            } else if (q.question_type === 'ranking') {
                type = 'ranking';
            } else if (q.question_type === 'rating') {
                type = 'rating-scale';
            } else if (q.question_type === 'date_time') {
                type = 'date_time';
            } else if (q.question_type === 'file_upload') {
                type = 'file_upload';
            } else if (q.question_type === 'open_ended') {
                type = 'open-ended';
            }
            // Map options to {id, text} format for ResponseFormPage
            let options = undefined;
            if (q.options && q.options.length > 0) {
                options = q.options.map((o, idx) => {
                    // Handle both object and string formats
                    if (typeof o === 'string') {
                        return {
                            id: `temp_${q.id}_${idx}`,
                            text: o
                        };
                    }
                    return {
                        id: o.id || `temp_${q.id}_${idx}`,
                        text: o.option_text || o.text || ''
                    };
                });
            }
            return {
                id: q.id || `temp_q_${Date.now()}_${Math.random()}`,
                text: q.question_text || 'Câu hỏi',
                type,
                options,
                scale: q.question_type === 'rating' ? [1, 2, 3, 4, 5] : undefined,
                is_required: !!q.is_required
            };
        }).filter(q => q.text && q.text.trim() !== ''); // Filter out empty questions

        return {
            id: 'ai-preview',
            title: form.title || 'Xem trước khảo sát AI',
            description: form.description || '',
            questions: mappedQuestions
        };
    };

    const handlePreview = () => {
        try {
            // Validate before preview
            if (!questions || questions.length === 0) {
                showNotification('warning', 'Không có câu hỏi nào để xem trước. Vui lòng thêm ít nhất một câu hỏi.');
                return;
            }

            const preview = buildPreviewSurvey();

            // Validate preview data
            if (!preview || !preview.questions || preview.questions.length === 0) {
                showNotification('warning', 'Không thể tạo xem trước. Vui lòng kiểm tra lại các câu hỏi.');
                return;
            }

            console.log('Preview data:', preview); // Debug log

            // Lưu dữ liệu tạm thời vào localStorage để có thể quay lại
            const tempData = {
                form: form,
                questions: questions,
                activeQuestionIndex: activeQuestionIndex,
                timestamp: Date.now()
            };
            localStorage.setItem('aiSurveyTempData', JSON.stringify(tempData));

            navigate('/response-preview', { state: { survey: preview } });
        } catch (error) {
            console.error('Error in handlePreview:', error);
            showNotification('error', 'Có lỗi xảy ra khi tạo xem trước. Vui lòng thử lại.');
        }
    };

    const activeQuestion = activeQuestionIndex !== null ? questions[activeQuestionIndex] : null;
    const activeQuestionNumber = activeQuestionIndex !== null ? activeQuestionIndex + 1 : null;
    const activeQuestionError = activeQuestionIndex !== null ? errors[`question_${activeQuestionIndex}`] : null;
    const activeQuestionOptionError = activeQuestionIndex !== null ? errors[`question_${activeQuestionIndex}_options`] : null;
    const isMultipleChoice = activeQuestion?.question_type === 'multiple_choice';
    const isSingleChoice = activeQuestion?.question_type === 'single_choice';
    const isBoolean = activeQuestion?.question_type === 'boolean_' || activeQuestion?.question_type === 'yes_no';
    const isRanking = activeQuestion?.question_type === 'ranking';
    const isRating = activeQuestion?.question_type === 'rating';
    const isDateTime = activeQuestion?.question_type === 'date_time';
    const isFileUpload = activeQuestion?.question_type === 'file_upload';
    const isOpenEnded = activeQuestion?.question_type === 'open_ended';

    return (
        <MainLayout>
            {/* Notification Modal */}
            {notification && (
                <NotificationModal
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            {showForm ? (
                <div className="ai-container">
                    <h2 className="ai-title">Tạo khảo sát thông minh với AI</h2>
                    <p className="ai-subtitle">Cung cấp thông tin để AI tạo bộ câu hỏi phù hợp.</p>

                    <div className="ai-form-card">
                        <div className="ai-form-row">
                            <label>Tiêu đề khảo sát <span className="req">*</span></label>
                            <input
                                value={form.title}
                                onChange={(e) => handleFormChange('title', e.target.value)}
                                placeholder="Nhập tiêu đề khảo sát"
                                className={errors.title ? 'error' : ''}
                            />
                            {errors.title && <div className="ai-error">{errors.title}</div>}
                        </div>

                        <div className="ai-form-row category-form-row">
                            <label>Danh mục khảo sát <span className="req">*</span></label>
                            <div className="category-input-wrapper">
                                <select
                                    value={form.category_id}
                                    onChange={(e) => handleCategorySelectChange(e.target.value)}
                                    className={errors.category_id ? 'error' : ''}
                                    disabled={categoriesLoading}
                                >
                                    <option value="">Chọn danh mục</option>
                                    {categories.map((cat) => (
                                        <option
                                            key={cat.categoryId || cat.id}
                                            value={String(cat.categoryId ?? cat.id)}
                                        >
                                            {cat.categoryName || cat.name || 'Không có tên'}
                                        </option>
                                    ))}
                                </select>
                                <small className="field-hint">
                                    Lựa chọn danh mục phù hợp với khảo sát của bạn
                                </small>
                            </div>
                            {errors.category_id && <div className="ai-error">{errors.category_id}</div>}
                        </div>

                        <div className="ai-form-row">
                            <label>Mô tả khảo sát</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                placeholder="Mô tả ngắn gọn về mục đích khảo sát"
                                rows={3}
                            />
                        </div>

                        <div className="ai-form-row-group">
                            <div className="ai-form-row ai-form-row--half">
                                <label>Đối tượng mục tiêu</label>
                                <input
                                    value={form.target_audience}
                                    onChange={(e) => handleFormChange('target_audience', e.target.value)}
                                    placeholder="VD: Học sinh lớp 12, Nhân viên văn phòng..."
                                />
                                <small className="field-hint">Giúp AI tạo câu hỏi phù hợp với đối tượng</small>
                            </div>

                            <div className="ai-form-row ai-form-row--half">
                                <label>Số lượng câu hỏi <span className="req">*</span></label>
                                <input
                                    type="number"
                                    min="2"
                                    max="20"
                                    value={form.question_count}
                                    onChange={(e) => handleFormChange('question_count', e.target.value)}
                                    placeholder="Nhập số lượng câu hỏi"
                                    className={errors.question_count ? 'error' : ''}
                                />
                                {errors.question_count && <div className="ai-error">{errors.question_count}</div>}
                            </div>
                        </div>

                        <div className="ai-form-row">
                            <label>Ngữ cảnh chi tiết cho AI <span className="req">*</span></label>
                            <textarea
                                rows={6}
                                value={form.ai_context}
                                onChange={(e) => handleFormChange('ai_context', e.target.value)}
                                placeholder={`Ví dụ: "Tạo khảo sát đánh giá mức độ hài lòng của nhân viên IT về môi trường làm việc tại công ty công nghệ"`}
                                className={errors.ai_context ? 'error' : ''}
                            />
                            {errors.ai_context && <div className="ai-error">{errors.ai_context}</div>}
                        </div>

                        {/* Question Type Priorities Selector */}
                        <div className="ai-form-row">
                            <label>Loại câu hỏi ưu tiên <span className="field-hint-inline">(Tùy chọn)</span></label>
                            <small className="field-hint" style={{ marginBottom: '12px', display: 'block' }}>
                                Chọn các loại câu hỏi bạn muốn AI ưu tiên sinh ra. Nếu không chọn, AI sẽ tự động cân bằng.
                            </small>
                            <div className="question-type-priorities">
                                {QUESTION_TYPE_OPTIONS.map((type) => {
                                    const isSelected = form.question_type_priorities.includes(type.value);
                                    return (
                                        <button
                                            key={type.value}
                                            type="button"
                                            className={`priority-chip ${isSelected ? 'selected' : ''}`}
                                            onClick={() => {
                                                const currentPriorities = [...form.question_type_priorities];
                                                if (isSelected) {
                                                    // Remove from priorities
                                                    const filtered = currentPriorities.filter(t => t !== type.value);
                                                    handleFormChange('question_type_priorities', filtered);
                                                } else {
                                                    // Add to priorities
                                                    handleFormChange('question_type_priorities', [...currentPriorities, type.value]);
                                                }
                                            }}
                                        >
                                            {isSelected && <i className="fa-solid fa-check priority-check" aria-hidden="true"></i>}
                                            <span>{type.label}</span>
                                            {isSelected && (
                                                <span className="priority-badge">
                                                    #{form.question_type_priorities.indexOf(type.value) + 1}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <small className="field-hint" style={{ marginTop: '8px', display: 'block', color: '#3b82f6' }}>
                                <i className="fa-solid fa-lightbulb" style={{ marginRight: '4px' }}></i>
                                <strong>Gợi ý:</strong> Rating, Trắc nghiệm một/nhiều lựa chọn thường được sử dụng nhiều nhất trong khảo sát thực tế.
                            </small>
                        </div>

                        <div className="ai-actions">
                            <button className="btn-createAI" onClick={handleGenerateQuestions} disabled={loading}>
                                {loading ? 'Đang tạo gợi ý…' : 'Tạo gợi ý bằng AI'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="create-survey-wrapper">
                    <div className="survey-toolbar">
                        <div className="survey-toolbar-left">
                            <button
                                className="btn-top btn-ghost"
                                type="button"
                                onClick={handleBackToForm}
                            >
                                ← Quay lại form AI
                            </button>
                        </div>
                        <div className="survey-toolbar-right">
                            <button
                                className="btn-view"
                                type="button"
                                onClick={handlePreview}
                                disabled={questions.length === 0}
                                title="Xem trước khảo sát"
                            >
                                <i className="fa-regular fa-eye" aria-hidden="true"></i>
                                <span> Xem trước</span>
                            </button>
                            <button
                                className={`btn-mobile-view ${showMobileView ? 'active' : ''}`}
                                type="button"
                                onClick={() => setShowMobileView(!showMobileView)}
                                disabled={questions.length === 0}
                                title="Xem trước trên Mobile"
                            >
                                <i className="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>
                                <span> Mobile</span>
                            </button>
                            <button
                                className="btn-save"
                                type="button"
                                onClick={handleSaveSurvey}
                                disabled={loading}
                            >
                                {loading ? (
                                    'Đang xử lý…'
                                ) : (
                                    <>
                                        <i className="fa-solid fa-save" aria-hidden="true"></i>
                                        <span>{isEditMode ? 'Cập nhật' : 'Lưu'}</span>
                                    </>
                                )}
                            </button>
                            <button
                                className="btn-share"
                                type="button"
                                onClick={handleShareSurvey}
                                disabled={loading}
                            >
                                <i className="fa-solid fa-share-nodes" aria-hidden="true"></i>
                                <span> Chia sẻ</span>
                            </button>
                        </div>
                    </div>

                    {hasErrors && (
                        <div className="survey-error-banner" role="alert">
                            <div className="survey-error-title">Vui lòng kiểm tra lại thông tin</div>
                            <ul>
                                {errors.title && <li>{errors.title}</li>}
                                {errors.questions && <li>{errors.questions}</li>}
                            </ul>
                        </div>
                    )}

                    <div className="survey-info-card compact">
                        <div className="survey-form-grid">
                            <div className="survey-field survey-field--full">
                                <label className="field-label">
                                    Tiêu đề khảo sát <span className="field-required">*</span>
                                </label>
                                <input
                                    className={`survey-title-input ${errors.title ? 'error' : ''}`}
                                    value={form.title}
                                    onChange={(e) => handleFormChange('title', e.target.value)}
                                    placeholder="Tiêu đề khảo sát"
                                />
                                {errors.title && <p className="error-message">{errors.title}</p>}
                            </div>
                        </div>
                        <div className="survey-field survey-field--full">
                            <label className="field-label">Mô tả</label>
                            <textarea
                                className="survey-desc-input"
                                value={form.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                placeholder="Mô tả khảo sát..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="survey-editor">
                        <div className="survey-sidebar">
                            <div className="sidebar-header">
                                <h3>Danh sách câu hỏi AI</h3>
                                <span className="sidebar-count">{questions.length}</span>
                            </div>
                            {questions.length === 0 ? (
                                <div className="sidebar-empty">Chưa có câu hỏi</div>
                            ) : (
                                <div>
                                    {questions.map((q, idx) => (
                                        <div
                                            key={q.id}
                                            className={`sidebar-item ${idx === activeQuestionIndex ? 'is-active' : ''}`}
                                            onClick={() => handleSelectQuestion(idx)}
                                        >
                                            <div className="sidebar-item-body">
                                                <span className="sidebar-number">Câu {idx + 1}</span>
                                                <span className="sidebar-text" title={q.question_text || 'Chưa có nội dung'}>
                                                    {q.question_text || 'Chưa có nội dung'}
                                                </span>
                                            </div>
                                            <div className="sidebar-item-actions">
                                                <button
                                                    type="button"
                                                    className="sidebar-item-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDuplicateQuestion(idx);
                                                    }}
                                                    aria-label="Nhân đôi câu hỏi"
                                                    title="Nhân đôi câu hỏi"
                                                >
                                                    <i className="fa-regular fa-clone" aria-hidden="true"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sidebar-item-btn danger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('Bạn có chắc muốn xóa câu hỏi này không?')) {
                                                            handleDeleteQuestion(idx);
                                                        }
                                                    }}
                                                    aria-label="Xóa câu hỏi"
                                                    title="Xóa câu hỏi"
                                                >
                                                    <i className="fa-solid fa-trash" aria-hidden="true"></i>
                                                </button>
                                            </div>

                                        </div>
                                    ))}
                                </div>

                            )}
                            <button
                                className="sidebar-add"
                                type="button"
                                onClick={() => handleAddQuestion()}
                                disabled={loading}
                            >
                                + Câu hỏi mới
                            </button>
                        </div>

                        <div className="survey-main">
                            <div className="questions-container">
                                {errors.questions && (
                                    <p className="error-message">{errors.questions}</p>
                                )}
                                {questions.length === 0 ? (
                                    <div className="questions-empty">
                                        <i className="fa-regular fa-circle-question survey-empty-icon" title="Chưa có câu hỏi nào"></i>
                                        <p>Chưa có câu hỏi nào</p>
                                    </div>
                                ) : !activeQuestion ? (
                                    <div className="question-placeholder">
                                        Chọn một câu hỏi ở danh sách bên trái để bắt đầu chỉnh sửa.
                                    </div>
                                ) : (
                                    <div className="question-editor-card">
                                        <div className="question-editor-header">
                                            <span className="question-editor-pill">Câu {activeQuestionNumber}</span>
                                            <div className="question-editor-actions">
                                                <button
                                                    type="button"
                                                    className="question-action-btn"
                                                    onClick={() => {
                                                        setRefreshingQuestionIndex(activeQuestionIndex);
                                                        setShowRefreshModal(true);
                                                    }}
                                                    disabled={refreshingQuestions.has(activeQuestionIndex)}
                                                    title="Tạo lại câu hỏi"
                                                >
                                                    {refreshingQuestions.has(activeQuestionIndex) ? (
                                                        <>
                                                            <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                                                            Đang tạo lại...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
                                                            Tạo lại
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="question-editor-body">
                                            <label className="question-label">Nội dung câu hỏi</label>
                                            <textarea
                                                className={`question-input ${activeQuestionError ? 'error' : ''}`}
                                                value={activeQuestion.question_text}
                                                onChange={(e) => handleQuestionTextChange(activeQuestionIndex, e.target.value)}
                                                placeholder="Nhập nội dung câu hỏi"
                                                rows={3}
                                            />
                                            {activeQuestionError && (
                                                <p className="error-message">{activeQuestionError}</p>
                                            )}

                                            {isOpenEnded && (
                                                <div className="question-helper">
                                                    Người tham gia sẽ nhập câu trả lời ngắn gọn cho câu hỏi này.
                                                </div>
                                            )}

                                            {isDateTime && (
                                                <>
                                                    <div className="question-helper">
                                                        Người tham gia sẽ chọn ngày và giờ.
                                                    </div>
                                                    <div className="editor-section">
                                                        <div className="editor-section-header">
                                                            <span className="section-title">Xem trước</span>
                                                        </div>
                                                        <div className="date-time-inputs">
                                                            <input type="date" disabled className="preview-input" />
                                                            <input type="time" disabled className="preview-input" />
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {isFileUpload && (
                                                <>
                                                    <div className="question-helper">
                                                        Người tham gia sẽ tải file lên cho câu hỏi này.
                                                    </div>
                                                    <div className="editor-section">
                                                        <div className="editor-section-header">
                                                            <span className="section-title">Xem trước</span>
                                                        </div>
                                                        <div className="file-upload-preview">
                                                            <div className="upload-zone-preview">
                                                                <i className="fa-solid fa-cloud-arrow-up upload-icon"></i>
                                                                <p className="upload-text">
                                                                    <span>Nhấp hoặc kéo thả file vào đây</span>
                                                                </p>
                                                                <p className="upload-hint">Định dạng: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, ZIP, RAR (Tối đa 10MB)</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {isRanking && (
                                                <div className="question-helper">
                                                    Người tham gia sẽ sắp xếp các lựa chọn theo thứ tự ưu tiên.
                                                </div>
                                            )}

                                            {isSingleChoice && (
                                                <div className="question-helper">
                                                    Người tham gia sẽ chọn một lựa chọn từ danh sách.
                                                </div>
                                            )}

                                            {isMultipleChoice && (
                                                <div className="editor-section">
                                                    <div className="editor-section-header">
                                                        <span className="section-title">Lựa chọn trả lời</span>
                                                        <button
                                                            type="button"
                                                            className="add-option"
                                                            onClick={() => handleAddOption(activeQuestionIndex)}
                                                        >
                                                            + Thêm lựa chọn
                                                        </button>
                                                    </div>
                                                    <div className="options-list">
                                                        {activeQuestion.options?.map((opt, oIdx) => (
                                                            <div key={opt.id || oIdx} className="option-item">
                                                                <span className="option-index">{oIdx + 1}</span>
                                                                <input
                                                                    className={`option-input ${activeQuestionOptionError ? 'error' : ''}`}
                                                                    value={opt.option_text}
                                                                    onChange={(e) => handleOptionChange(activeQuestionIndex, oIdx, e.target.value)}
                                                                    placeholder={`Lựa chọn ${oIdx + 1}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="remove-option"
                                                                    onClick={() => {
                                                                        if (activeQuestion.options.length <= 2) return;
                                                                        if (window.confirm('Bạn có chắc muốn xóa lựa chọn này không?')) {
                                                                            handleDeleteOption(activeQuestionIndex, oIdx);
                                                                        }
                                                                    }}
                                                                    disabled={activeQuestion.options.length <= 2}
                                                                    aria-label="Xóa lựa chọn"
                                                                >
                                                                    <i className="fa-solid fa-delete-left" aria-hidden="true"></i>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {activeQuestionOptionError && (
                                                        <p className="error-message">{activeQuestionOptionError}</p>
                                                    )}
                                                </div>
                                            )}

                                            {isSingleChoice && (
                                                <div className="editor-section">
                                                    <div className="editor-section-header">
                                                        <span className="section-title">Lựa chọn trả lời</span>
                                                        <button
                                                            type="button"
                                                            className="add-option"
                                                            onClick={() => handleAddOption(activeQuestionIndex)}
                                                        >
                                                            + Thêm lựa chọn
                                                        </button>
                                                    </div>
                                                    <div className="options-list">
                                                        {activeQuestion.options?.map((opt, oIdx) => (
                                                            <div key={opt.id || oIdx} className="option-item">
                                                                <span className="option-index">{oIdx + 1}</span>
                                                                <input
                                                                    className={`option-input ${activeQuestionOptionError ? 'error' : ''}`}
                                                                    value={opt.option_text}
                                                                    onChange={(e) => handleOptionChange(activeQuestionIndex, oIdx, e.target.value)}
                                                                    placeholder={`Lựa chọn ${oIdx + 1}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="remove-option"
                                                                    onClick={() => {
                                                                        if (activeQuestion.options.length <= 2) return;
                                                                        if (window.confirm('Bạn có chắc muốn xóa lựa chọn này không?')) {
                                                                            handleDeleteOption(activeQuestionIndex, oIdx);
                                                                        }
                                                                    }}
                                                                    disabled={activeQuestion.options.length <= 2}
                                                                    aria-label="Xóa lựa chọn"
                                                                >
                                                                    <i className="fa-solid fa-delete-left" aria-hidden="true"></i>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {activeQuestionOptionError && (
                                                        <p className="error-message">{activeQuestionOptionError}</p>
                                                    )}
                                                </div>
                                            )}

                                            {isRanking && (
                                                <div className="editor-section">
                                                    <div className="editor-section-header">
                                                        <span className="section-title">Lựa chọn để xếp hạng</span>
                                                        <button
                                                            type="button"
                                                            className="add-option"
                                                            onClick={() => handleAddOption(activeQuestionIndex)}
                                                        >
                                                            + Thêm lựa chọn
                                                        </button>
                                                    </div>
                                                    <DndContext
                                                        sensors={sensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={(event) => {
                                                            const { active, over } = event;
                                                            if (!over || active.id === over.id) return;

                                                            const oldIndex = activeQuestion.options.findIndex(opt => opt.id === active.id);
                                                            const newIndex = activeQuestion.options.findIndex(opt => opt.id === over.id);

                                                            const newOptions = arrayMove(activeQuestion.options, oldIndex, newIndex);
                                                            setQuestions(prev => {
                                                                const next = [...prev];
                                                                next[activeQuestionIndex] = { ...next[activeQuestionIndex], options: newOptions };
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        <SortableContext
                                                            items={activeQuestion.options?.map(opt => opt.id) || []}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            <div className="ranking-options-list">
                                                                {activeQuestion.options?.map((opt, oIdx) => (
                                                                    <SortableRankingOption
                                                                        key={opt.id}
                                                                        id={opt.id}
                                                                        index={oIdx}
                                                                        option={opt}
                                                                        error={activeQuestionOptionError}
                                                                        onTextChange={(value) => handleOptionChange(activeQuestionIndex, oIdx, value)}
                                                                        onDelete={() => {
                                                                            if (activeQuestion.options.length <= 2) return;
                                                                            if (window.confirm('Bạn có chắc muốn xóa lựa chọn này không?')) {
                                                                                handleDeleteOption(activeQuestionIndex, oIdx);
                                                                            }
                                                                        }}
                                                                        disabled={activeQuestion.options.length <= 2}
                                                                        onMoveUp={() => handleMoveOptionUp(activeQuestionIndex, oIdx)}
                                                                        onMoveDown={() => handleMoveOptionDown(activeQuestionIndex, oIdx)}
                                                                        totalCount={activeQuestion.options.length}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </SortableContext>
                                                    </DndContext>
                                                    {activeQuestionOptionError && (
                                                        <p className="error-message">{activeQuestionOptionError}</p>
                                                    )}
                                                </div>
                                            )}

                                            {isBoolean && (
                                                <div className="editor-section">
                                                    <div className="editor-section-header">
                                                        <span className="section-title">Tuỳ chỉnh nhãn</span>
                                                    </div>
                                                    <div className="options-list two-column">
                                                        {(activeQuestion.options && activeQuestion.options.length > 0) ? (
                                                            activeQuestion.options.map((opt, oIdx) => (
                                                                <div key={opt.id || oIdx} className="option-item soft">
                                                                    <span className="option-index">{oIdx === 0 ? 'Yes' : 'No'}</span>
                                                                    <input
                                                                        className={`option-input ${activeQuestionOptionError ? 'error' : ''}`}
                                                                        value={opt.option_text}
                                                                        onChange={(e) => handleOptionChange(activeQuestionIndex, oIdx, e.target.value)}
                                                                        placeholder={oIdx === 0 ? 'Đúng' : 'Sai'}
                                                                    />
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="empty-state">Không có lựa chọn. Vui lòng tạo lại câu hỏi.</div>
                                                        )}
                                                    </div>
                                                    {activeQuestionOptionError && (
                                                        <p className="error-message">{activeQuestionOptionError}</p>
                                                    )}
                                                </div>
                                            )}

                                            {isRating && (
                                                <div className="editor-section">
                                                    <div className="editor-section-header">
                                                        <span className="section-title">Đánh giá (tối đa 5 sao)</span>
                                                    </div>
                                                    <div className="rating-preview">
                                                        {Array.from({ length: 5 }).map((_, idx) => (
                                                            <span key={idx} className="rating-star">★</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <aside className="right-sidebar-answer">
                            {activeQuestion ? (
                                <>
                                    <div className="answer-panel">
                                        <h3 className="answer-panel-title">Thiết lập câu hỏi</h3>
                                        <div className="panel-field">
                                            <label>Loại trả lời</label>
                                            <div className="panel-select-wrapper">
                                                <select
                                                    className="panel-select"
                                                    value={activeQuestion.question_type}
                                                    onChange={(e) => handleQuestionTypeChange(activeQuestionIndex, e.target.value)}
                                                >
                                                    {QUESTION_TYPE_OPTIONS.map(option => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Chế độ lựa chọn đã bị ẩn như CreateSurvey */}

                                        {isRating && (
                                            <div className="panel-field">
                                                <label>Tối đa</label>
                                                <div className="rating-scale-chip">5 sao</div>
                                            </div>
                                        )}

                                        <div className="panel-field required-toggle-row">
                                            <div>
                                                <label>Bắt buộc trả lời</label>
                                                <p className="panel-hint">Người tham gia phải trả lời trước khi tiếp tục.</p>
                                            </div>
                                            <label className="switch">
                                                <input
                                                    type="checkbox"
                                                    checked={activeQuestion.is_required}
                                                    onChange={() => handleToggleRequired(activeQuestionIndex)}
                                                />
                                                <span className="slider" />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="answer-panel secondary">
                                        <h3 className="answer-panel-title">Tổng quan</h3>
                                        <div className="panel-stats-grid">
                                            <div className="stat-chip">
                                                <span className="stat-label">Tổng câu</span>
                                                <span className="stat-value">{stats.total}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Bắt buộc</span>
                                                <span className="stat-value">{stats.required}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Trắc nghiệm nhiều</span>
                                                <span className="stat-value">{stats.multipleChoice}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Trắc nghiệm một</span>
                                                <span className="stat-value">{stats.singleChoice}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Đúng/Sai</span>
                                                <span className="stat-value">{stats.booleanQ}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Xếp hạng</span>
                                                <span className="stat-value">{stats.ranking}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Đánh giá</span>
                                                <span className="stat-value">{stats.rating}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Ngày/Giờ</span>
                                                <span className="stat-value">{stats.dateTime}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Tải file</span>
                                                <span className="stat-value">{stats.fileUpload}</span>
                                            </div>
                                            <div className="stat-chip">
                                                <span className="stat-label">Câu hỏi mở</span>
                                                <span className="stat-value">{stats.open}</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="answer-placeholder">
                                    <h3>Chọn câu hỏi</h3>
                                    <p>Nhấp vào một câu hỏi ở danh sách bên trái để cấu hình loại trả lời.</p>
                                </div>
                            )}
                        </aside>
                    </div>
                </div>
            )}

            {/* AI Processing Modal */}
            {showProcessingModal && (
                <div className="ai-processing-modal">
                    <div className="ai-processing-content">
                        {/* Header with AI icon and title */}
                        <div className="ai-processing-header">
                            <div className="ai-icon">💡</div>
                            <h2>AI đang phân tích và tạo câu hỏi</h2>
                            <p>Đang tạo câu hỏi phù hợp</p>
                        </div>

                        {/* Progress bar */}
                        <div className="ai-progress-container">
                            <div className="ai-progress-bar">
                                <div
                                    className="ai-progress-fill"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <span className="ai-progress-text">{Math.round(progress)}% hoàn thành</span>
                        </div>

                        {/* Survey Information */}
                        <div className="ai-survey-info">
                            <h3>Thông tin khảo sát của bạn:</h3>
                            <div className="ai-survey-details">
                                <div className="ai-survey-item">
                                    <strong>Tiêu đề:</strong> {form.title}
                                </div>
                                <div className="ai-survey-item">
                                    <strong>Mô tả:</strong> {form.description || 'Không có mô tả'}
                                </div>
                                <div className="ai-survey-item">
                                    <strong>Danh mục:</strong> {form.category_name || 'Chưa chọn'}
                                </div>
                                <div className="ai-survey-item">
                                    <strong>Số câu hỏi:</strong> {form.question_count || questions.length || '—'} câu
                                </div>
                            </div>
                        </div>

                        {/* AI Processing Steps */}
                        <div className="ai-processing-steps">
                            <h3>AI đang thực hiện:</h3>
                            <div className="ai-steps-list">
                                {[
                                    'Phân tích ngữ cảnh và mục tiêu khảo sát',
                                    'Tạo bộ câu hỏi phù hợp',
                                    'Tối ưu hóa thứ tự và logic câu hỏi',
                                    'Hoàn thiện và chuẩn bị giao diện chỉnh sửa'
                                ].map((step, index) => (
                                    <div
                                        key={index}
                                        className={`ai-step-item ${currentStep > index ? 'completed' : currentStep === index + 1 ? 'active' : ''}`}
                                    >
                                        <div className="ai-step-icon">
                                            {currentStep > index ? '✅' : currentStep === index + 1 ? '🔄' : (index + 1)}
                                        </div>
                                        <span className="ai-step-label">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Cancel button */}
                        <div className="ai-processing-actions">
                            <button
                                className="ai-cancel-btn"
                                onClick={handleCancelProcessing}
                            >
                                Hủy bỏ và quay lại
                            </button>
                        </div>

                        <div className="ai-footer-note"></div>
                        <em>Lưu ý: Quá trình này có thể mất vài phút tuỳ thuộc vào độ dài ngữ cảnh và số lượng câu hỏi.</em>
                    </div>
                </div>
            )}

            {/* Refresh Question Type Selection Modal */}
            {showRefreshModal && (
                <div className="refresh-modal-overlay" onClick={() => setShowRefreshModal(false)}>
                    <div className="refresh-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Chọn loại câu hỏi muốn tạo lại</h3>
                        <p className="refresh-modal-subtitle">
                            Chọn loại câu hỏi bạn muốn AI tạo lại cho câu hỏi này
                        </p>

                        <div className="refresh-type-grid">
                            {QUESTION_TYPE_OPTIONS.map((type) => (
                                <button
                                    key={type.value}
                                    className={`refresh-type-card ${selectedRefreshType === type.value ? 'selected' : ''}`}
                                    onClick={() => setSelectedRefreshType(type.value)}
                                >
                                    <div className="refresh-type-label">{type.label}</div>
                                    {selectedRefreshType === type.value && (
                                        <div className="refresh-type-check">✓</div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="refresh-modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => {
                                    setShowRefreshModal(false);
                                    setSelectedRefreshType('');
                                    setRefreshingQuestionIndex(null);
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={() => {
                                    if (selectedRefreshType && refreshingQuestionIndex !== null) {
                                        handleRefreshQuestion(refreshingQuestionIndex, selectedRefreshType);
                                        setShowRefreshModal(false);
                                        setSelectedRefreshType('');
                                        setRefreshingQuestionIndex(null);
                                    }
                                }}
                                disabled={!selectedRefreshType}
                            >
                                Xác nhận tạo lại
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Result Preview Modal */}
            {showAIPreviewModal && aiPreviewData && (
                <div className="ai-preview-modal-overlay">
                    <div className="ai-preview-modal-container">
                        <div className="ai-preview-modal-header">
                            <div className="ai-preview-header-content">
                                <div className="ai-preview-icon">✨</div>
                                <div>
                                    <h2>Xem trước khảo sát AI đã tạo</h2>
                                    <p>Kiểm tra các câu hỏi AI đã tạo. Bạn có thể chấp nhận để chỉnh sửa hoặc tạo lại với prompt khác.</p>
                                </div>
                            </div>
                        </div>

                        <div className="ai-preview-modal-body">
                            <div className="ai-preview-survey-info">
                                <h3 className="ai-preview-title">{aiPreviewData.generatedSurvey?.title || aiPreviewData.surveyTitle}</h3>
                                {(aiPreviewData.generatedSurvey?.description || aiPreviewData.description) && (
                                    <p className="ai-preview-description">{aiPreviewData.generatedSurvey?.description || aiPreviewData.description}</p>
                                )}
                                <div className="ai-preview-stats">
                                    <span className="ai-preview-stat">
                                        <i className="fa-solid fa-list-check"></i>
                                        {(aiPreviewData.generatedSurvey?.questions || aiPreviewData.questions || []).length} câu hỏi
                                    </span>
                                    <span className="ai-preview-stat">
                                        <i className="fa-solid fa-robot"></i>
                                        Tạo bởi AI
                                    </span>
                                </div>
                            </div>

                            <div className="ai-preview-questions-list">
                                {(aiPreviewData.generatedSurvey?.questions || aiPreviewData.questions || []).map((q, idx) => (
                                    <div key={q.id || idx} className="ai-preview-question-card">
                                        <div className="ai-preview-question-header">
                                            <span className="ai-preview-question-number">Câu {idx + 1}</span>
                                            <span className={`ai-preview-question-type type-${q.question_type}`}>
                                                {QUESTION_TYPE_OPTIONS.find(t => t.value === q.question_type)?.label || q.question_type}
                                            </span>
                                        </div>
                                        <p className="ai-preview-question-text">
                                            {q.question_text}
                                            {q.is_required && <span className="ai-preview-required">*</span>}
                                        </p>

                                        {/* Hiển thị options nếu có */}
                                        {q.options && q.options.length > 0 && (
                                            <div className="ai-preview-options">
                                                {q.options.map((opt, optIdx) => (
                                                    <div key={opt.id || optIdx} className="ai-preview-option">
                                                        <span className="ai-preview-option-bullet">
                                                            {q.question_type === 'multiple_choice' ? '☐' : '○'}
                                                        </span>
                                                        <span>{opt.option_text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Hiển thị thông tin cho rating */}
                                        {q.question_type === 'rating' && (
                                            <div className="ai-preview-rating">
                                                <span>Thang đánh giá: 1 - 5 ⭐</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="ai-preview-modal-footer">
                            <button
                                className="ai-preview-btn ai-preview-btn-reject"
                                onClick={handleRejectAIResult}
                            >
                                <i className="fa-solid fa-arrows-rotate"></i>
                                Tạo lại với prompt khác
                            </button>
                            <button
                                className="ai-preview-btn ai-preview-btn-accept"
                                onClick={handleAcceptAIResult}
                            >
                                <i className="fa-solid fa-check"></i>
                                Chấp nhận và chỉnh sửa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile View Preview Panel */}
            {showMobileView && (
                <div className="mobile-view-overlay" onClick={() => setShowMobileView(false)}>
                    <div className="mobile-view-container" onClick={(e) => e.stopPropagation()}>
                        <div className="mobile-view-header">
                            <h3>Xem trước trên Mobile</h3>
                            <button
                                className="mobile-view-close"
                                onClick={() => setShowMobileView(false)}
                                aria-label="Đóng xem trước"
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                            </button>
                        </div>
                        <div className="mobile-view-device">
                            <div className="mobile-view-frame">
                                <div className="mobile-view-content">
                                    {(() => {
                                        const preview = buildPreviewSurvey();
                                        return (
                                            <div style={{ padding: '16px', background: '#fff', minHeight: '100vh' }}>
                                                <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>
                                                    <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0', color: '#1e293b' }}>
                                                        {form.title || 'Tiêu đề khảo sát'}
                                                    </h2>
                                                    {form.description && (
                                                        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                                                            {form.description}
                                                        </p>
                                                    )}
                                                </div>

                                                {preview.questions.map((q, idx) => (
                                                    <div key={q.id || idx} style={{
                                                        background: '#f8fafc',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        padding: '16px',
                                                        marginBottom: '16px'
                                                    }}>
                                                        <h3 style={{
                                                            fontSize: '16px',
                                                            fontWeight: '600',
                                                            margin: '0 0 12px 0',
                                                            color: '#1e293b'
                                                        }}>
                                                            {q.text || 'Câu hỏi'}
                                                            {q.is_required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                                                        </h3>

                                                        {/* Render preview of question type */}
                                                        {(q.type === 'open-ended' || q.type === 'open-text') && (
                                                            <textarea
                                                                disabled
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '12px',
                                                                    border: '1px solid #cbd5e1',
                                                                    borderRadius: '6px',
                                                                    fontSize: '14px',
                                                                    resize: 'vertical',
                                                                    minHeight: '80px'
                                                                }}
                                                                placeholder="Nhập câu trả lời..."
                                                            />
                                                        )}

                                                        {(q.type === 'multiple-choice-single' || q.type === 'multiple-choice-multiple' || q.type === 'boolean') && q.options && Array.isArray(q.options) && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {q.options.map((opt, optIdx) => {
                                                                    const optText = typeof opt === 'string' ? opt : (opt?.text || opt?.option_text || opt?.id || '');
                                                                    const optId = typeof opt === 'object' && opt?.id ? opt.id : optIdx;
                                                                    return (
                                                                        <label key={optId || optIdx} style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '10px',
                                                                            cursor: 'pointer'
                                                                        }}>
                                                                            <input
                                                                                type={q.type === 'multiple-choice-multiple' ? 'checkbox' : 'radio'}
                                                                                disabled
                                                                                style={{ width: '18px', height: '18px' }}
                                                                            />
                                                                            <span style={{ fontSize: '14px', color: '#1e293b' }}>
                                                                                {optText}
                                                                            </span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {q.type === 'ranking' && q.options && Array.isArray(q.options) && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {q.options.map((opt, optIdx) => {
                                                                    const optText = typeof opt === 'string' ? opt : (opt?.text || opt?.option_text || opt?.id || '');
                                                                    const optId = typeof opt === 'object' && opt?.id ? opt.id : optIdx;
                                                                    return (
                                                                        <div key={optId || optIdx} style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '12px',
                                                                            padding: '12px',
                                                                            background: '#fff',
                                                                            border: '1px solid #e2e8f0',
                                                                            borderRadius: '6px'
                                                                        }}>
                                                                            <div style={{
                                                                                minWidth: '32px',
                                                                                height: '32px',
                                                                                background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                                                                                borderRadius: '50%',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                color: '#fff',
                                                                                fontWeight: '600',
                                                                                fontSize: '14px'
                                                                            }}>
                                                                                {optIdx + 1}
                                                                            </div>
                                                                            <span style={{ fontSize: '14px', color: '#1e293b', flex: 1 }}>
                                                                                {optText}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {q.type === 'rating-scale' && (
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                {[1, 2, 3, 4, 5].map(num => (
                                                                    <div key={num} style={{
                                                                        width: '40px',
                                                                        height: '40px',
                                                                        borderRadius: '50%',
                                                                        background: '#f1f5f9',
                                                                        border: '2px solid #cbd5e1',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        fontSize: '16px',
                                                                        fontWeight: '600',
                                                                        color: '#475569'
                                                                    }}>
                                                                        {num}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {(q.type === 'date_time' || q.type === 'date-time') && (
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                <input
                                                                    type="date"
                                                                    disabled
                                                                    style={{
                                                                        flex: 1,
                                                                        minWidth: '120px',
                                                                        padding: '12px',
                                                                        border: '1px solid #cbd5e1',
                                                                        borderRadius: '6px',
                                                                        fontSize: '14px',
                                                                        background: '#f8fafc'
                                                                    }}
                                                                />
                                                                <input
                                                                    type="time"
                                                                    disabled
                                                                    style={{
                                                                        flex: 1,
                                                                        minWidth: '120px',
                                                                        padding: '12px',
                                                                        border: '1px solid #cbd5e1',
                                                                        borderRadius: '6px',
                                                                        fontSize: '14px',
                                                                        background: '#f8fafc'
                                                                    }}
                                                                />
                                                            </div>
                                                        )}

                                                        {(q.type === 'file_upload' || q.type === 'file-upload') && (
                                                            <div style={{
                                                                border: '2px dashed #cbd5e1',
                                                                borderRadius: '12px',
                                                                padding: '24px',
                                                                textAlign: 'center',
                                                                background: '#f8fafc'
                                                            }}>
                                                                <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '8px' }}></i>
                                                                <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 4px 0', fontWeight: '600' }}>
                                                                    Nhấp hoặc kéo thả file vào đây
                                                                </p>
                                                                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                                                                    Định dạng: PDF, DOC, XLS, PPT, TXT, ZIP, RAR
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}

                                                <button
                                                    type="button"
                                                    disabled
                                                    style={{
                                                        width: '100%',
                                                        padding: '14px',
                                                        background: '#e5e7eb',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontSize: '16px',
                                                        fontWeight: '600',
                                                        color: '#9ca3af',
                                                        cursor: 'not-allowed'
                                                    }}
                                                >
                                                    Gửi khảo sát
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}