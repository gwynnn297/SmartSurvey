import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { surveyService } from '../../services/surveyService';
import { questionService, optionService } from '../../services/questionSurvey';
import { aiSurveyService } from '../../services/aiSurveyService';
import './CreateSurvey.css';

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

// ✅ 7 loại câu hỏi chính thức theo backend mới
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

// Helper function để kiểm tra xem question type có cần options không
const needsOptions = (questionType) => {
    return ['multiple_choice', 'single_choice', 'boolean_', 'ranking'].includes(questionType);
};

const createEmptyOption = (text = '') => ({
    id: `temp_option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    option_text: text
});

const createDefaultOptions = () => [
    createEmptyOption(''),
    createEmptyOption('')
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
        is_required: true
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

const cloneQuestion = (question) => {
    const cloned = {
        ...question,
        id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        options: (question.options || []).map(opt => createEmptyOption(opt.option_text))
    };

    // Handle choice_type for multiple_choice and single_choice
    if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
        cloned.choice_type = question.choice_type ||
            (question.question_type === 'multiple_choice' ? 'multiple' : 'single');
    } else {
        delete cloned.choice_type;
    }

    // Handle rating_scale for rating
    if (question.question_type === 'rating') {
        cloned.rating_scale = question.rating_scale || 5;
    } else {
        delete cloned.rating_scale;
    }

    return cloned;
};

const ensureOptionShape = (option) => ({
    id: option?.id || `temp_option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    option_text: option?.option_text ?? option?.optionText ?? ''
});

const normalizeQuestionData = (rawQuestion) => {
    if (!rawQuestion) {
        return createEmptyQuestion();
    }

    const questionId = rawQuestion.id || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const backendType = rawQuestion.question_type || rawQuestion.questionType || 'open_ended';
    const normalizedType = mapTypeFromBackend(backendType);

    const base = {
        id: questionId,
        question_text: rawQuestion.question_text || rawQuestion.questionText || '',
        question_type: normalizedType,
        is_required: rawQuestion.is_required ?? rawQuestion.isRequired ?? true,
        options: []
    };

    // multiple_choice hoặc single_choice cần options
    if (normalizedType === 'multiple_choice' || normalizedType === 'single_choice') {
        const rawOptions = rawQuestion.options || rawQuestion.optionsList || [];
        const mappedOptions = rawOptions.length > 0
            ? rawOptions.map(ensureOptionShape)
            : createDefaultOptions();
        return {
            ...base,
            options: mappedOptions,
            choice_type: rawQuestion.choice_type || rawQuestion.choiceType ||
                (normalizedType === 'multiple_choice' ? 'multiple' : 'single')
        };
    }

    // boolean_ cần options Yes/No
    if (normalizedType === 'boolean_' || normalizedType === 'yes_no') {
        const rawOptions = rawQuestion.options || [];
        const mappedOptions = rawOptions.length >= 2
            ? rawOptions.map(ensureOptionShape)
            : createYesNoOptions();
        return {
            ...base,
            options: mappedOptions
        };
    }

    // ranking cần options để xếp hạng
    if (normalizedType === 'ranking') {
        const rawOptions = rawQuestion.options || rawQuestion.optionsList || [];
        const mappedOptions = rawOptions.length > 0
            ? rawOptions.map(ensureOptionShape)
            : createDefaultOptions();
        return {
            ...base,
            options: mappedOptions
        };
    }

    // rating có thang điểm
    if (normalizedType === 'rating') {
        return {
            ...base,
            rating_scale: rawQuestion.rating_scale || rawQuestion.ratingScale || 5
        };
    }

    // open_ended, date_time, file_upload không cần special config
    return base;
};

function SortableSidebarItem({ id, index, text, isActive, onSelect, onDuplicate, onDelete }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`sidebar-item ${isActive ? 'is-active' : ''}`}
            {...attributes}
            {...listeners}
            onClick={onSelect}
        >
            <div className="sidebar-item-body">
                <span className="sidebar-number">Câu {index + 1}</span>
                <span className="sidebar-text" title={text || 'Chưa có nội dung'}>
                    {text || 'Chưa có nội dung'}
                </span>
            </div>
            <div className="sidebar-item-actions">
                <button
                    type="button"
                    className="sidebar-item-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate?.();
                    }}
                    disabled={!onDuplicate}
                    title={!onDuplicate ? "Cần có tiêu đề hoặc mô tả khảo sát để sử dụng AI" : "Tạo lại câu hỏi bằng AI"}
                    aria-label="Tạo lại câu hỏi bằng AI"
                >
                    <i className="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
                </button>
                <button
                    type="button"
                    className="sidebar-item-btn danger"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.();
                    }}
                    aria-label="Xóa câu hỏi"
                >
                    <i className="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    );
}

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
                <button
                    type="button"
                    className="remove-option"
                    onClick={onDelete}
                    disabled={disabled}
                    aria-label="Xóa lựa chọn"
                >
                    <i className="fa-solid fa-delete-left" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    );
}

const CreateSurvey = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [errors, setErrors] = useState({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [editSurveyId, setEditSurveyId] = useState(null);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(null);
    const [refreshingQuestions, setRefreshingQuestions] = useState(new Set());
    const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // idle, saving, saved, error
    const autoSaveTimeoutRef = React.useRef(null);
    const [showMobileView, setShowMobileView] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const draftStorageKey = React.useRef(null); // Key để lưu draft vào localStorage
    const [showDraftModal, setShowDraftModal] = useState(false);
    const isNavigatingToPreviewOrShare = React.useRef(false); // Để theo dõi navigation tới preview/share

    const [surveyData, setSurveyData] = useState({
        title: '',
        description: '',
        category_id: '',
        status: 'draft'
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        })
    );

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
        const open = questions.filter(q => q.question_type === 'open_ended').length;
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
            open,
            closed
        };
    }, [questions]);

    const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

    useEffect(() => {
        if (questions.length === 0) {
            setActiveQuestionIndex(null);
            return;
        }

        if (activeQuestionIndex === null || activeQuestionIndex >= questions.length) {
            setActiveQuestionIndex(0);
        }
    }, [questions, activeQuestionIndex]);

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

    const handleAddQuestion = (type = 'open_ended') => {
        setQuestions(prev => [...prev, createEmptyQuestion(type)]);
        clearError('questions');
        setActiveQuestionIndex(questions.length);
    };

    const handleDuplicateQuestion = (index) => {
        if (!questions[index]) return;
        const cloned = cloneQuestion(questions[index]);
        const next = [...questions];
        next.splice(index + 1, 0, cloned);
        setQuestions(next);
        setActiveQuestionIndex(index + 1);
        clearError('questions');
    };

    const handleRefreshQuestion = async (questionIndex) => {
        try {
            const hasTitle = surveyData.title?.trim().length > 0;
            const hasDescription = surveyData.description?.trim().length > 0;

            if (!hasTitle && !hasDescription) {
                alert('⚠️ Không thể tạo lại câu hỏi!\n\nĐể sử dụng tính năng này, vui lòng:\n1. Thêm tiêu đề cho khảo sát\n2. Thêm mô tả cho khảo sát\n\nSau đó thử lại.');
                return;
            }

            setRefreshingQuestions(prev => new Set([...prev, questionIndex]));

            const currentQuestion = questions[questionIndex];
            if (!currentQuestion) return;

            const surveyTitle = hasTitle ? surveyData.title : 'Khảo sát';
            const surveyDesc = hasDescription ? surveyData.description : 'Khảo sát không có mô tả cụ thể';
            const categoryName =
                categories.find(cat => cat.id === parseInt(surveyData.category_id))?.category_name || 'General';

            const requestData = {
                originalPrompt: surveyData.aiPrompt || surveyTitle,
                contextHint: currentQuestion.question_text,
                targetAudience: 'Người tham gia khảo sát',
                categoryName,
                description: `Tạo lại câu hỏi cho khảo sát "${surveyTitle}". Mô tả: "${surveyDesc}".`
            };

            console.log('🔄 Regenerating question in CreateSurvey:', requestData);

            const response = await aiSurveyService.regenerateQuestion(requestData);

            if (response.success && response.question) {
                const aiQuestion = response.question;

                const newQuestion = {
                    id: currentQuestion.id,
                    question_text: aiQuestion.questionText || aiQuestion.question_text || '',
                    question_type: mapTypeFromBackend(aiQuestion.questionType || aiQuestion.question_type),
                    is_required: aiQuestion.isRequired ?? aiQuestion.is_required ?? true,
                    options: (aiQuestion.options || []).map((opt, optIndex) => ({
                        id: `temp_option_${Date.now()}_${optIndex}`,
                        option_text: opt.optionText || opt.option_text || ''
                    }))
                };

                if (newQuestion.question_type === 'multiple_choice') {
                    newQuestion.choice_type = 'single';
                    if (!newQuestion.options.length) {
                        newQuestion.options = createDefaultOptions();
                    }
                } else if (newQuestion.question_type === 'boolean_' || newQuestion.question_type === 'yes_no') {
                    if (!newQuestion.options.length) {
                        newQuestion.options = createYesNoOptions();
                    }
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

                console.log('✅ Question regenerated in CreateSurvey:', newQuestion);
            } else {
                throw new Error(response.message || 'Không thể tạo câu hỏi mới');
            }
        } catch (error) {
            console.error('❌ Error refreshing question in CreateSurvey:', error);

            let errorMessage = 'Không thể tạo câu hỏi mới. Vui lòng thử lại.';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            alert(errorMessage);
        } finally {
            setRefreshingQuestions(prev => {
                const next = new Set(prev);
                next.delete(questionIndex);
                return next;
            });
        }
    };

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
                current.choice_type = choiceType || current.choice_type ||
                    (type === 'multiple_choice' ? 'multiple' : 'single');
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
            } else {
                // open_ended, date_time, file_upload
                delete current.choice_type;
                delete current.rating_scale;
                current.options = [];
            }

            next[index] = current;
            return next;
        });

        if (type !== 'multiple_choice' && type !== 'single_choice' && type !== 'ranking') {
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

    const handleAddOption = (questionIndex) => {
        setQuestions(prev => {
            const currentQuestion = prev[questionIndex];
            // Allow adding options for multiple_choice, single_choice, and ranking
            if (!currentQuestion ||
                (currentQuestion.question_type !== 'multiple_choice' &&
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

    // Rating cố định 5 sao nên không cần thay đổi
    const handleRatingScaleChange = () => { };

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

    // Function để xóa question
    const deleteQuestion = async (_questionId, questionIndex) => {
        try {
            setQuestions(prev => prev.filter((_, i) => i !== questionIndex));
            setActiveQuestionIndex(prev => {
                if (prev === null) return prev;
                if (questionIndex < prev) return prev - 1;
                if (questionIndex === prev) return null;
                return prev;
            });
            clearQuestionErrors();
            clearError('questions');
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('Có lỗi xảy ra khi xóa câu hỏi. Vui lòng thử lại.');
        }
    };

    // Function để xóa option
    const deleteOption = async (optionId, questionIndex, optionIndex) => {
        try {
            setQuestions(prev => {
                const currentQuestion = prev[questionIndex];
                // Allow deleting options for multiple_choice, single_choice, and ranking
                if (!currentQuestion ||
                    (currentQuestion.question_type !== 'multiple_choice' &&
                        currentQuestion.question_type !== 'single_choice' &&
                        currentQuestion.question_type !== 'ranking')) {
                    return prev;
                }
                const next = [...prev];
                const question = { ...next[questionIndex] };
                const currentOptions = [...(question.options || [])];
                if (currentOptions.length <= 2) {
                    return prev;
                }
                const options = currentOptions.filter((_, idx) => idx !== optionIndex);
                question.options = options;
                next[questionIndex] = question;
                return next;
            });
            clearError(`question_${questionIndex}_options`);
        } catch (error) {
            console.error('Error deleting option:', error);
            alert('Có lỗi xảy ra khi xóa lựa chọn. Vui lòng thử lại.');
        }
    };

    // Hàm lưu draft vào localStorage
    const saveDraftToLocalStorage = () => {
        try {
            const draftKey = draftStorageKey.current || `survey_draft_${editSurveyId || 'new'}`;
            if (!draftStorageKey.current) {
                draftStorageKey.current = draftKey;
            }

            const draftData = {
                surveyData,
                questions,
                editSurveyId,
                isEditMode,
                timestamp: Date.now()
            };

            localStorage.setItem(draftKey, JSON.stringify(draftData));
            setHasUnsavedChanges(false);
            return true;
        } catch (err) {
            console.error('Error saving draft to localStorage:', err);
            return false;
        }
    };

    // Hàm khôi phục draft từ localStorage
    const restoreDraftFromLocalStorage = () => {
        try {
            const draftKey = draftStorageKey.current || `survey_draft_${editSurveyId || 'new'}`;
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const draftData = JSON.parse(savedDraft);
                // Chỉ khôi phục nếu dữ liệu còn mới (trong vòng 24h)
                const draftAge = Date.now() - (draftData.timestamp || 0);
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours
                if (draftAge < maxAge) {
                    if (draftData.surveyData) {
                        setSurveyData(draftData.surveyData);
                    }
                    if (draftData.questions) {
                        setQuestions(draftData.questions);
                    }
                    if (draftData.editSurveyId) {
                        setEditSurveyId(draftData.editSurveyId);
                    }
                    if (draftData.isEditMode !== undefined) {
                        setIsEditMode(draftData.isEditMode);
                    }
                    return true;
                } else {
                    // Xóa draft cũ
                    localStorage.removeItem(draftKey);
                }
            }
            return false;
        } catch (err) {
            console.error('Error restoring draft from localStorage:', err);
            return false;
        }
    };

    // Auto-save effect - lưu vào localStorage thay vì database
    useEffect(() => {
        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // Chỉ auto-save nếu có dữ liệu
        if (!surveyData.title.trim() && questions.length === 0) {
            return;
        }

        // Set new timeout for auto-save (3 seconds after last change)
        autoSaveTimeoutRef.current = setTimeout(() => {
            try {
                setAutoSaveStatus('saving');
                // Lưu vào localStorage thay vì database
                const success = saveDraftToLocalStorage();
                if (success) {
                    setAutoSaveStatus('saved');
                    setTimeout(() => setAutoSaveStatus('idle'), 2000);
                } else {
                    setAutoSaveStatus('error');
                    setTimeout(() => setAutoSaveStatus('idle'), 2000);
                }
            } catch (err) {
                console.error('Auto-save failed:', err);
                setAutoSaveStatus('error');
                setTimeout(() => setAutoSaveStatus('idle'), 2000);
            }
        }, 3000);

        // Đánh dấu có thay đổi chưa lưu
        setHasUnsavedChanges(true);

        // Cleanup
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [surveyData, questions]);

    useEffect(() => {
        loadCategories();

        // Kiểm tra xem có đang quay lại từ preview/share không
        const returningFromPreview = sessionStorage.getItem('returning_from_preview') === 'true';
        if (returningFromPreview) {
            sessionStorage.removeItem('returning_from_preview');
            // Tự động khôi phục draft, không hiển thị modal
            draftStorageKey.current = 'survey_draft_new';
            const restored = restoreDraftFromLocalStorage();
            if (restored) {
                console.log('✅ Auto-restored draft from localStorage (returning from preview/share)');
                return; // Không cần xử lý tiếp
            }
        }

        // Kiểm tra nếu đang edit survey
        const editSurvey = location.state?.editSurvey;
        if (editSurvey) {
            setIsEditMode(true);
            const surveyId = editSurvey.id;
            setEditSurveyId(surveyId);
            draftStorageKey.current = `survey_draft_${surveyId || 'new'}`;

            // Thử khôi phục từ localStorage trước (nếu có draft chưa lưu)
            const restored = restoreDraftFromLocalStorage();
            if (!restored) {
                // Load dữ liệu survey từ location.state
                setSurveyData({
                    title: editSurvey.title || '',
                    description: editSurvey.description || '',
                    category_id: editSurvey.categoryId || '',
                    status: editSurvey.status || 'draft'
                });

                // Load questions từ server nếu có surveyId
                if (surveyId && !surveyId.toString().startsWith('temp_')) {
                    loadQuestionsFromServer(surveyId);
                } else if (editSurvey.questions && editSurvey.questions.length > 0) {
                    // Fallback: load từ location.state
                    setQuestions(editSurvey.questions);
                }
            } else {
                // Đã khôi phục từ localStorage, không cần load từ server
                console.log('✅ Restored draft from localStorage');
            }
        } else {
            // Không có editSurvey, kiểm tra xem có draft không
            draftStorageKey.current = 'survey_draft_new';
            const hasDraft = checkDraftExists();
            if (hasDraft && !returningFromPreview) {
                // Hiển thị modal hỏi người dùng (chỉ khi không quay lại từ preview/share)
                setShowDraftModal(true);
            }
        }
    }, [location.state]);

    // Kiểm tra xem có draft tồn tại không
    const checkDraftExists = () => {
        try {
            const draftKey = draftStorageKey.current || 'survey_draft_new';
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const draftData = JSON.parse(savedDraft);
                const draftAge = Date.now() - (draftData.timestamp || 0);
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours
                return draftAge < maxAge;
            }
            return false;
        } catch (err) {
            return false;
        }
    };

    // Xử lý khi người dùng chọn tiếp tục chỉnh sửa
    const handleContinueEditing = () => {
        setShowDraftModal(false);
        const restored = restoreDraftFromLocalStorage();
        if (restored) {
            console.log('✅ Restored draft from localStorage');
        }
    };

    // Xử lý khi người dùng chọn tạo mới
    const handleCreateNew = () => {
        setShowDraftModal(false);
        // Xóa draft
        if (draftStorageKey.current) {
            localStorage.removeItem(draftStorageKey.current);
        }
        // Reset form
        setSurveyData({
            title: '',
            description: '',
            category_id: '',
            status: 'draft'
        });
        setQuestions([]);
        setEditSurveyId(null);
        setIsEditMode(false);
        setHasUnsavedChanges(false);
    };

    // Lưu draft khi rời trang (trừ khi đi tới preview/share)
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            // Lưu draft trước khi đóng tab
            if (hasUnsavedChanges || (surveyData.title.trim() || questions.length > 0)) {
                saveDraftToLocalStorage();
            }
        };

        // Lưu khi đóng tab/window
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Lưu draft khi component unmount (chỉ nếu không đi tới preview/share)
            if (!isNavigatingToPreviewOrShare.current && (hasUnsavedChanges || (surveyData.title.trim() || questions.length > 0))) {
                saveDraftToLocalStorage();
            }
            // Reset flag
            isNavigatingToPreviewOrShare.current = false;
        };
    }, [hasUnsavedChanges, surveyData, questions]);

    // Function để load questions từ server
    const loadQuestionsFromServer = async (surveyId) => {
        try {
            const questionsFromServer = await questionService.getQuestionsBySurvey(surveyId);
            const questionsWithOptions = [];

            for (const question of questionsFromServer) {
                let options = [];
                // Load options cho tất cả các loại câu hỏi cần options
                if (needsOptions(question.questionType)) {
                    try {
                        options = await optionService.getOptionsByQuestion(question.id);
                    } catch (error) {
                        console.log(`No options found for question ${question.id}`);
                    }
                }

                // Normalize questionType từ backend
                const normalizedType = mapTypeFromBackend(question.questionType);
                const normalized = normalizeQuestionData({
                    id: question.id,
                    question_text: question.questionText,
                    question_type: normalizedType,
                    is_required: question.isRequired ?? true,
                    options: options.map(opt => ({
                        id: opt.id,
                        option_text: opt.optionText
                    }))
                });

                questionsWithOptions.push(normalized);
            }

            setQuestions(questionsWithOptions);
        } catch (error) {
            console.error('Error loading questions from server:', error);
            // Fallback: load từ localStorage nếu có
            const editSurvey = location.state?.editSurvey;
            if (editSurvey?.questions && editSurvey.questions.length > 0) {
                const mappedQuestions = editSurvey.questions.map(normalizeQuestionData);
                setQuestions(mappedQuestions);
            }
        }
    };

    const loadCategories = async () => {
        try {
            const response = await surveyService.getCategories();
            setCategories(response.data || response || []);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const handleSurveyDataChange = (field, value) => {
        setSurveyData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!surveyData.title.trim()) {
            newErrors.title = 'Tiêu đề khảo sát là bắt buộc';
        }
        if (questions.length === 0) {
            newErrors.questions = 'Khảo sát phải có ít nhất 1 câu hỏi';
        }
        questions.forEach((q, idx) => {
            if (!q.question_text.trim()) {
                newErrors[`question_${idx}`] = 'Nội dung câu hỏi là bắt buộc';
            }
            // Validate options for questions that need them
            if (needsOptions(q.question_type)) {
                const validOpts = q.options?.filter(o => o.option_text && o.option_text.trim());
                if (!validOpts || validOpts.length < 2) {
                    newErrors[`question_${idx}_options`] = 'Câu hỏi này cần ít nhất 2 lựa chọn';
                }
            }
            // rating cố định 5 sao, bỏ validate phạm vi
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const saveSurvey = async (status) => {
        if (!validateForm()) return;
        setLoading(true);

        try {
            const payload = {
                title: surveyData.title,
                description: surveyData.description,
                categoryId: surveyData.category_id ? parseInt(surveyData.category_id) : null,
                aiPrompt: null
            };

            let savedSurvey;
            if (isEditMode && editSurveyId) {
                // Update existing survey - giữ nguyên status hiện tại
                savedSurvey = await surveyService.updateSurvey(editSurveyId, payload);
            } else {
                // Create new survey - backend luôn tạo với status 'draft'
                savedSurvey = await surveyService.createSurvey(payload);

                // Nếu muốn status 'published', cần cập nhật status sau khi tạo
                if (status === 'published') {
                    savedSurvey = await surveyService.updateSurvey(savedSurvey.id, { status: 'published' });
                }
            }

            // Kiểm tra nếu savedSurvey tồn tại và có ID
            if (!savedSurvey || !savedSurvey.id) {
                console.error('Failed to save survey:', savedSurvey);
                throw new Error('Không thể lưu khảo sát. Vui lòng thử lại.');
            }

            const surveyId = savedSurvey.id;

            // Xử lý xóa các câu hỏi và options đã bị xóa khỏi giao diện
            if (isEditMode && editSurveyId) {
                try {
                    // Lấy danh sách câu hỏi hiện tại từ server
                    const serverQuestions = await questionService.getQuestionsBySurvey(surveyId);

                    // Tìm các câu hỏi đã bị xóa khỏi giao diện
                    const currentQuestionIds = questions.map(q => q.id).filter(id => id && !id.toString().startsWith('temp_'));
                    const deletedQuestions = serverQuestions.filter(sq => !currentQuestionIds.includes(sq.id));

                    // Xóa các câu hỏi đã bị xóa
                    for (const deletedQuestion of deletedQuestions) {
                        try {
                            // Xóa tất cả options của câu hỏi trước
                            const options = await optionService.getOptionsByQuestion(deletedQuestion.id);
                            for (const option of options) {
                                await optionService.deleteOption(option.id);
                            }

                            // Xóa câu hỏi
                            await questionService.deleteQuestion(deletedQuestion.id);
                        } catch (error) {
                            console.error(`Error deleting question ${deletedQuestion.id}:`, error);
                        }
                    }

                    // Xử lý xóa options trong các câu hỏi còn lại
                    for (const question of questions) {
                        // Kiểm tra tất cả các loại câu hỏi cần options
                        if (question.id && !question.id.toString().startsWith('temp_') && needsOptions(question.question_type)) {
                            try {
                                // Lấy options hiện tại từ server
                                const serverOptions = await optionService.getOptionsByQuestion(question.id);

                                // Tìm các options đã bị xóa khỏi giao diện
                                const currentOptionIds = question.options?.map(o => o.id).filter(id => id && !id.toString().startsWith('temp_option_')) || [];
                                const deletedOptions = serverOptions.filter(so => !currentOptionIds.includes(so.id));

                                // Xóa các options đã bị xóa
                                for (const deletedOption of deletedOptions) {
                                    await optionService.deleteOption(deletedOption.id);
                                }
                            } catch (error) {
                                console.error(`Error processing options for question ${question.id}:`, error);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error processing deletions:', error);
                }
            }

            // Tạo/cập nhật questions và options
            const updatedQuestions = [];
            if (questions.length > 0) {
                for (const question of questions) {
                    const backendType = mapTypeToBackend(question.question_type);
                    const questionPayload = {
                        surveyId: surveyId,
                        questionText: question.question_text,
                        questionType: backendType,
                        isRequired: question.is_required ?? true
                    };

                    let savedQuestion;
                    if (question.id && question.id.toString().startsWith('temp_')) {
                        // Tạo question mới
                        savedQuestion = await questionService.createQuestion(questionPayload);
                    } else if (question.id && !question.id.toString().startsWith('temp_')) {
                        // Cập nhật question hiện có
                        savedQuestion = await questionService.updateQuestion(question.id, {
                            questionText: question.question_text,
                            questionType: backendType,
                            isRequired: question.is_required ?? true
                        });
                    } else {
                        // Nếu không có ID, tạo question mới
                        savedQuestion = await questionService.createQuestion(questionPayload);
                    }

                    // Kiểm tra nếu savedQuestion tồn tại
                    if (!savedQuestion || !savedQuestion.id) {
                        console.error('Failed to save question:', question);
                        throw new Error(`Không thể lưu câu hỏi: ${question.question_text}`);
                    }

                    // Tạo/cập nhật options cho các loại câu hỏi cần options
                    const updatedOptions = [];
                    if (needsOptions(question.question_type) && question.options?.length > 0) {
                        for (const option of question.options) {
                            if (option.option_text && option.option_text.trim()) {
                                const optionPayload = {
                                    questionId: savedQuestion.id,
                                    optionText: option.option_text
                                };

                                let savedOption;
                                if (option.id && option.id.toString().startsWith('temp_option_')) {
                                    // Tạo option mới
                                    savedOption = await optionService.createOption(optionPayload);
                                } else if (option.id && !option.id.toString().startsWith('temp_option_')) {
                                    // Cập nhật option hiện có
                                    savedOption = await optionService.updateOption(option.id, {
                                        optionText: option.option_text
                                    });
                                } else {
                                    // Nếu không có ID, tạo option mới
                                    savedOption = await optionService.createOption(optionPayload);
                                }

                                if (savedOption && savedOption.id) {
                                    updatedOptions.push({
                                        id: savedOption.id,
                                        option_text: savedOption.optionText
                                    });
                                } else {
                                    console.error('Failed to save option:', option);
                                    throw new Error(`Không thể lưu lựa chọn: ${option.option_text}`);
                                }
                            }
                        }
                    }

                    const updatedQuestion = normalizeQuestionData({
                        id: savedQuestion.id,
                        question_text: savedQuestion.questionText,
                        question_type: savedQuestion.questionType,
                        is_required: savedQuestion.isRequired,
                        // Giữ lại options cho tất cả các loại câu hỏi cần options
                        options: needsOptions(question.question_type) ? updatedOptions : [],
                        choice_type: question.choice_type,
                        rating_scale: question.rating_scale
                    });

                    updatedQuestions.push(updatedQuestion);
                }
            }

            // Đồng bộ thứ tự câu hỏi lên backend theo thứ tự hiện tại trên giao diện
            try {
                if (updatedQuestions.length > 0) {
                    const orderedQuestionIds = updatedQuestions.map(q => q.id);
                    await questionService.reorderQuestions(surveyId, orderedQuestionIds);
                }
            } catch (error) {
                console.error('Lỗi khi lưu thứ tự câu hỏi:', error);
            }

            // Cập nhật state với questions có ID thực
            setQuestions(updatedQuestions);

            // Refresh questions từ server để đảm bảo đồng bộ
            if (surveyId) {
                setTimeout(async () => {
                    try {
                        await loadQuestionsFromServer(surveyId);
                    } catch (error) {
                        console.error('Error refreshing questions:', error);
                    }
                }, 200); // Delay 1 giây để server xử lý xong
            }

            // Cập nhật localStorage
            const existingSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');

            if (isEditMode && editSurveyId) {
                // Update existing survey in localStorage
                const updatedSurveys = existingSurveys.map(s =>
                    s.id === editSurveyId
                        ? {
                            ...s,
                            title: savedSurvey.title,
                            description: savedSurvey.description,
                            categoryName: savedSurvey.categoryName,
                            questionsCount: updatedQuestions.length,
                            questions: updatedQuestions,
                            updatedAt: savedSurvey.updatedAt
                        }
                        : s
                );
                localStorage.setItem('userSurveys', JSON.stringify(updatedSurveys));
            } else {
                // Add new survey to localStorage
                const newSurvey = {
                    id: savedSurvey.id,
                    title: savedSurvey.title,
                    description: savedSurvey.description,
                    status: status,
                    categoryName: savedSurvey.categoryName,
                    createdAt: savedSurvey.createdAt,
                    questionsCount: updatedQuestions.length,
                    questions: updatedQuestions,
                    responses: 0
                };
                existingSurveys.push(newSurvey);
                localStorage.setItem('userSurveys', JSON.stringify(existingSurveys));
            }

            const message = isEditMode
                ? 'Đã cập nhật khảo sát thành công!'
                : (status === 'draft' ? 'Đã lưu bản nháp khảo sát!' : 'Đã xuất bản khảo sát thành công!');

            alert(message);

            // Xóa draft từ localStorage sau khi đã lưu vào database
            if (draftStorageKey.current) {
                localStorage.removeItem(draftStorageKey.current);
            }
            setHasUnsavedChanges(false);

            // Cập nhật draftStorageKey với surveyId mới (nếu có)
            if (surveyId) {
                draftStorageKey.current = `survey_draft_${surveyId}`;
                setEditSurveyId(surveyId);
                setIsEditMode(true);
            }

            // Điều hướng sau khi lưu
            if (status === 'published') {
                // Chỉ chuyển hướng khi publish
                if (isEditMode) {
                    // Khi cập nhật và publish thì quay về dashboard
                    navigate('/dashboard');
                } else {
                    // Khi xuất bản mới thì sang trang chia sẻ
                    navigate('/share-survey', { state: { surveyId } });
                }
            } else {
                // Khi lưu draft thì ở lại trang hiện tại, không chuyển hướng
                console.log('✅ Survey saved as draft, staying on current page');
            }
        } catch (err) {
            console.error('Lỗi khi lưu khảo sát:', err);

            // Hiển thị thông báo lỗi chi tiết hơn
            let errorMessage = 'Có lỗi xảy ra khi lưu khảo sát. Vui lòng thử lại.';

            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.message) {
                errorMessage = err.message;
            } else if (err.response?.status) {
                switch (err.response.status) {
                    case 400:
                        errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
                        break;
                    case 401:
                        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
                        break;
                    case 403:
                        errorMessage = 'Bạn không có quyền thực hiện thao tác này.';
                        break;
                    case 500:
                        errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
                        break;
                    default:
                        errorMessage = `Lỗi ${err.response.status}: ${err.response.statusText || 'Không xác định'}`;
                }
            }

            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const activeQuestion = activeQuestionIndex !== null ? questions[activeQuestionIndex] : null;
    const activeQuestionNumber = activeQuestionIndex !== null ? activeQuestionIndex + 1 : null;
    const activeQuestionError = activeQuestionIndex !== null ? errors[`question_${activeQuestionIndex}`] : null;
    const activeQuestionOptionError = activeQuestionIndex !== null ? errors[`question_${activeQuestionIndex}_options`] : null;
    const activeQuestionRatingError = activeQuestionIndex !== null ? errors[`question_${activeQuestionIndex}_rating`] : null;
    const isMultipleChoice = activeQuestion?.question_type === 'multiple_choice';
    const isSingleChoice = activeQuestion?.question_type === 'single_choice';
    const isBoolean = activeQuestion?.question_type === 'boolean_' || activeQuestion?.question_type === 'yes_no';
    const isRanking = activeQuestion?.question_type === 'ranking';
    const isRating = activeQuestion?.question_type === 'rating';
    const isDateTime = activeQuestion?.question_type === 'date_time';
    const isFileUpload = activeQuestion?.question_type === 'file_upload';
    const isOpenEnded = activeQuestion?.question_type === 'open_ended';

    // Build preview survey xem trước khảo sát ResponseFormPage
    const buildPreviewSurvey = () => {
        const mappedQuestions = questions.map(q => {
            let type = 'open-ended';
            if (q.question_type === 'multiple_choice') {
                type = 'multiple-choice-multiple';
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
                options = q.options.map((o, idx) => ({
                    id: o.id || `temp_${q.id}_${idx}`,
                    text: o.option_text
                }));
            }
            return {
                id: q.id,
                text: q.question_text,
                type,
                options,
                scale: q.question_type === 'rating' ? [1, 2, 3, 4, 5] : undefined,
                is_required: !!q.is_required
            };
        });
        return {
            id: editSurveyId || 'preview',
            title: surveyData.title || 'Xem trước khảo sát',
            description: surveyData.description || '',
            questions: mappedQuestions
        };
    };

    const handlePreview = () => {
        // Đánh dấu là đang điều hướng tới preview (không hiển thị modal khi quay lại)
        isNavigatingToPreviewOrShare.current = true;
        sessionStorage.setItem('returning_from_preview', 'true');
        // Lưu draft vào localStorage trước khi xem trước
        saveDraftToLocalStorage();
        const preview = buildPreviewSurvey();
        navigate('/response-preview', { state: { survey: preview } });
    };

    const handleShareSurvey = async () => {
        if (!validateForm()) {
            alert('Vui lòng hoàn thành tất cả thông tin bắt buộc trước khi chia sẻ khảo sát.');
            return;
        }

        // Đánh dấu là đang điều hướng tới share (không hiển thị modal khi quay lại)
        isNavigatingToPreviewOrShare.current = true;
        sessionStorage.setItem('returning_from_preview', 'true');

        setLoading(true);
        try {
            // Nếu có thay đổi chưa lưu, tự động lưu vào localStorage trước
            if (hasUnsavedChanges) {
                saveDraftToLocalStorage();
            }

            // Lưu survey trước (nếu chưa có)
            let surveyId = editSurveyId;
            if (!surveyId || surveyId.toString().startsWith('temp_')) {
                // Tạo survey mới với status published
                const payload = {
                    title: surveyData.title,
                    description: surveyData.description,
                    categoryId: surveyData.category_id ? parseInt(surveyData.category_id) : null,
                    aiPrompt: null
                };

                const savedSurvey = await surveyService.createSurvey(payload);
                if (!savedSurvey || !savedSurvey.id) {
                    throw new Error('Không thể tạo khảo sát. Vui lòng thử lại.');
                }

                surveyId = savedSurvey.id;
                setEditSurveyId(surveyId);
                draftStorageKey.current = `survey_draft_${surveyId}`;

                // Cập nhật status thành published
                await surveyService.updateSurvey(surveyId, { status: 'published' });

                // Lưu questions và options vào database
                await saveQuestionsAndOptions(surveyId);
            } else {
                // Cập nhật survey hiện có thành published và lưu questions/options mới nhất
                await surveyService.updateSurvey(surveyId, {
                    status: 'published',
                    title: surveyData.title,
                    description: surveyData.description,
                    categoryId: surveyData.category_id ? parseInt(surveyData.category_id) : null
                });

                try {
                    const serverQuestions = await questionService.getQuestionsBySurvey(surveyId);
                    const currentQuestionIds = questions.map(q => q.id).filter(id => id && !id.toString().startsWith('temp_'));
                    const deletedQuestions = serverQuestions.filter(sq => !currentQuestionIds.includes(sq.id));
                    for (const deletedQuestion of deletedQuestions) {
                        try {
                            const options = await optionService.getOptionsByQuestion(deletedQuestion.id);
                            for (const option of options) {
                                await optionService.deleteOption(option.id);
                            }
                            await questionService.deleteQuestion(deletedQuestion.id);
                        } catch (error) {
                            console.warn(`Could not delete question ${deletedQuestion.id} (may have responses):`, error);
                        }
                    }

                    for (const question of questions) {
                        if (question.id && !question.id.toString().startsWith('temp_') && needsOptions(question.question_type)) {
                            try {
                                const serverOptions = await optionService.getOptionsByQuestion(question.id);
                                const currentOptionIds = question.options?.map(o => o.id).filter(id => id && !id.toString().startsWith('temp_option_')) || [];
                                const deletedOptions = serverOptions.filter(so => !currentOptionIds.includes(so.id));
                                for (const deletedOption of deletedOptions) {
                                    await optionService.deleteOption(deletedOption.id);
                                }
                            } catch (error) {
                                console.error(`Error processing options for question ${question.id}:`, error);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error processing deletions:', error);
                }

                for (const question of questions) {
                    const backendType = mapTypeToBackend(question.question_type);
                    const questionPayload = {
                        surveyId: surveyId,
                        questionText: question.question_text,
                        questionType: backendType,
                        isRequired: question.is_required ?? true
                    };

                    let savedQuestion;
                    if (question.id && question.id.toString().startsWith('temp_')) {
                        // Tạo question mới
                        savedQuestion = await questionService.createQuestion(questionPayload);
                    } else if (question.id && !question.id.toString().startsWith('temp_')) {
                        // Cập nhật question hiện có (không tạo mới) - ĐÂY LÀ KEY FIX
                        savedQuestion = await questionService.updateQuestion(question.id, {
                            questionText: question.question_text,
                            questionType: backendType,
                            isRequired: question.is_required ?? true
                        });
                    } else {
                        // Nếu không có ID, tạo question mới
                        savedQuestion = await questionService.createQuestion(questionPayload);
                    }

                    if (!savedQuestion || !savedQuestion.id) {
                        console.error('Failed to save question:', question);
                        throw new Error(`Không thể lưu câu hỏi: ${question.question_text}`);
                    }

                    // Tạo/cập nhật options cho các loại câu hỏi cần options
                    if (needsOptions(question.question_type) && question.options?.length > 0) {
                        for (const option of question.options) {
                            if (option.option_text && option.option_text.trim()) {
                                const optionPayload = {
                                    questionId: savedQuestion.id,
                                    optionText: option.option_text
                                };

                                let savedOption;
                                if (option.id && option.id.toString().startsWith('temp_option_')) {
                                    // Tạo option mới
                                    savedOption = await optionService.createOption(optionPayload);
                                } else if (option.id && !option.id.toString().startsWith('temp_option_')) {
                                    // Cập nhật option hiện có (không tạo mới)
                                    savedOption = await optionService.updateOption(option.id, {
                                        optionText: option.option_text
                                    });
                                } else {
                                    // Nếu không có ID, tạo option mới
                                    savedOption = await optionService.createOption(optionPayload);
                                }
                            }
                        }
                    }
                }
            }

            // Xóa draft từ localStorage sau khi đã lưu vào database
            if (draftStorageKey.current) {
                localStorage.removeItem(draftStorageKey.current);
            }
            setHasUnsavedChanges(false);

            // Chuyển đến trang ViewLinkSharePage để hiển thị link chia sẻ
            navigate(`/view-link-share/${surveyId}`);

        } catch (error) {
            console.error('Lỗi khi chia sẻ khảo sát:', error);
            let errorMessage = 'Có lỗi xảy ra khi chia sẻ khảo sát. Vui lòng thử lại.';

            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleReport = async () => {
        try {
            // Kiểm tra nếu đang edit mode và có surveyId
            if (!editSurveyId) {
                alert('Vui lòng lưu khảo sát trước khi xem báo cáo.');
                return;
            }

            // Lưu survey trước (nếu chưa có)
            let surveyId = editSurveyId;
            if (surveyId.toString().startsWith('temp_')) {
                // Nếu đang ở draft mode, lưu survey trước
                if (!validateForm()) {
                    alert('Vui lòng hoàn thành tất cả thông tin bắt buộc trước khi xem báo cáo.');
                    return;
                }

                const payload = {
                    title: surveyData.title,
                    description: surveyData.description,
                    categoryId: surveyData.category_id ? parseInt(surveyData.category_id) : null,
                    aiPrompt: null
                };

                const savedSurvey = await surveyService.createSurvey(payload);
                if (!savedSurvey || !savedSurvey.id) {
                    throw new Error('Không thể lưu khảo sát. Vui lòng thử lại.');
                }

                surveyId = savedSurvey.id;

                // Lưu questions và options
                await saveQuestionsAndOptions(surveyId);

                // Cập nhật editSurveyId
                setEditSurveyId(surveyId);
            }

            // Chuyển đến trang DashboardReportPage với surveyId cụ thể
            navigate('/report', {
                state: {
                    surveyId: surveyId,
                    surveyTitle: surveyData.title,
                    surveyDescription: surveyData.description,
                    surveyData: surveyData,
                    questions: questions,
                    questionsCount: questions.length,
                    isFromCreateSurvey: true
                }
            });

        } catch (error) {
            console.error('Lỗi khi chuyển đến báo cáo:', error);
            let errorMessage = 'Có lỗi xảy ra khi chuyển đến báo cáo. Vui lòng thử lại.';

            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            alert(errorMessage);
        }
    };

    const saveQuestionsAndOptions = async (surveyId) => {
        if (questions.length === 0) return;

        for (const question of questions) {
            const backendType = mapTypeToBackend(question.question_type);
            const questionPayload = {
                surveyId: surveyId,
                questionText: question.question_text,
                questionType: backendType,
                isRequired: question.is_required ?? true
            };

            const savedQuestion = await questionService.createQuestion(questionPayload);
            if (!savedQuestion || !savedQuestion.id) {
                throw new Error(`Không thể lưu câu hỏi: ${question.question_text}`);
            }

            // Tạo options cho tất cả các loại câu hỏi cần options
            if (needsOptions(question.question_type) && question.options?.length > 0) {
                for (const option of question.options) {
                    if (option.option_text && option.option_text.trim()) {
                        const optionPayload = {
                            questionId: savedQuestion.id,
                            optionText: option.option_text
                        };

                        await optionService.createOption(optionPayload);
                    }
                }
            }
        }
    };

    return (
        <MainLayout>
            {/* Modal hỏi người dùng về draft */}
            {showDraftModal && (
                <div className="draft-modal-overlay" onClick={() => setShowDraftModal(false)}>
                    <div className="draft-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="draft-modal-header">
                            <h3>Phát hiện bản nháp chưa hoàn thành</h3>
                            <button
                                className="draft-modal-close"
                                onClick={() => setShowDraftModal(false)}
                                aria-label="Đóng"
                            >
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        <div className="draft-modal-body">
                            <p>Bạn có một bản nháp khảo sát chưa hoàn thành. Bạn muốn:</p>
                        </div>
                        <div className="draft-modal-footer">
                            <button
                                className="btn-draft-continue"
                                onClick={handleContinueEditing}
                            >
                                <i className="fa-solid fa-edit"></i>
                                Tiếp tục chỉnh sửa
                            </button>
                            <button
                                className="btn-draft-new"
                                onClick={handleCreateNew}
                            >
                                <i className="fa-solid fa-plus"></i>
                                Tạo mới
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="create-survey-wrapper">
                <div className="survey-toolbar">
                    <div className="survey-toolbar-left">
                        <button
                            className="btn-top btn-quaylai"
                            type="button"
                            onClick={() => navigate('/dashboard')}
                        >
                            ← Quay lại
                        </button>
                        <button
                            className="btn-top"
                            type="button"
                            onClick={() => navigate('/create-ai')}
                            disabled={loading}
                        >
                            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                            <span>Gợi ý bằng AI</span>
                        </button>
                    </div>
                    <div className="survey-toolbar-right">
                        {/* Auto-save status indicator */}
                        {editSurveyId && autoSaveStatus !== 'idle' && (
                            <div className="auto-save-status">
                                {autoSaveStatus === 'saving' && (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                                        <span>Đang lưu...</span>
                                    </>
                                )}
                                {autoSaveStatus === 'saved' && (
                                    <>
                                        <i className="fa-solid fa-check" aria-hidden="true"></i>
                                        <span>Đã lưu</span>
                                    </>
                                )}
                                {autoSaveStatus === 'error' && (
                                    <>
                                        <i className="fa-solid fa-exclamation-triangle" aria-hidden="true"></i>
                                        <span>Lỗi lưu</span>
                                    </>
                                )}
                            </div>
                        )}
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
                            className="btn-report"
                            type="button"
                            onClick={handleReport}
                            disabled={loading || !editSurveyId || surveyData.status === 'draft'}
                            title={
                                !editSurveyId
                                    ? "Cần lưu khảo sát trước khi xem báo cáo"
                                    : surveyData.status === 'draft'
                                        ? "Khảo sát ở trạng thái Draft - cần xuất bản để xem báo cáo"
                                        : "Xem báo cáo phân tích"
                            }
                        >
                            <i className="fa-solid fa-file-lines" aria-hidden="true"></i>
                            <span> Báo cáo</span>
                        </button>
                        <button
                            className="btn-save"
                            type="button"
                            onClick={() => saveSurvey('draft')}
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
                                value={surveyData.title}
                                onChange={(e) => handleSurveyDataChange('title', e.target.value)}
                                placeholder="Tiêu đề khảo sát"
                            />
                            {errors.title && <p className="error-message">{errors.title}</p>}
                        </div>
                    </div>
                    <div className="survey-field survey-field--full">
                        <label className="field-label">Mô tả</label>
                        <textarea
                            className="survey-desc-input"
                            value={surveyData.description}
                            onChange={(e) => handleSurveyDataChange('description', e.target.value)}
                            placeholder="Mô tả khảo sát..."
                            rows={3}
                        />
                    </div>
                </div>

                <div className="survey-editor">
                    <div className="survey-sidebar">
                        <div className="sidebar-header">
                            <h3>Danh sách câu hỏi</h3>
                            <span className="sidebar-count">{questions.length}</span>
                        </div>
                        {questions.length === 0 ? (
                            <div className="sidebar-empty">Chưa có câu hỏi</div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={({ active, over }) => {
                                    if (!over || active.id === over.id) return;

                                    const oldIndex = questions.findIndex(q => q.id === active.id);
                                    const newIndex = questions.findIndex(q => q.id === over.id);
                                    const newOrder = arrayMove(questions, oldIndex, newIndex);
                                    setQuestions(newOrder);

                                    if (activeQuestion) {
                                        const activeId = activeQuestion.id;
                                        const updatedIndex = newOrder.findIndex(q => q.id === activeId);
                                        setActiveQuestionIndex(updatedIndex === -1 ? null : updatedIndex);
                                    }
                                }}
                            >
                                <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                                    {questions.map((q, idx) => (
                                        <SortableSidebarItem
                                            key={q.id}
                                            id={q.id}
                                            index={idx}
                                            text={q.question_text}
                                            isActive={idx === activeQuestionIndex}
                                            onSelect={() => handleSelectQuestion(idx)}
                                            onDuplicate={(!surveyData.title?.trim() && !surveyData.description?.trim())
                                                ? null
                                                : () => handleRefreshQuestion(idx)}
                                            onDelete={() => {
                                                if (window.confirm('Bạn có chắc muốn xóa câu hỏi này không?')) {
                                                    deleteQuestion(q.id, idx);
                                                }
                                            }}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
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
                                    <button
                                        className="btn-add-question"
                                        type="button"
                                        onClick={() => handleAddQuestion()}
                                        disabled={loading}
                                    >
                                        + Thêm câu hỏi đầu tiên
                                    </button>
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
                                                onClick={() => handleRefreshQuestion(activeQuestionIndex)}
                                                disabled={refreshingQuestions.has(activeQuestionIndex) ||
                                                    (!surveyData.title?.trim() && !surveyData.description?.trim())}
                                                title={(!surveyData.title?.trim() && !surveyData.description?.trim())
                                                    ? "Cần có tiêu đề hoặc mô tả khảo sát để sử dụng AI tạo lại câu hỏi"
                                                    : "Tạo lại câu hỏi bằng AI"}
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
                                            <button
                                                type="button"
                                                className="question-action-btn danger"
                                                onClick={() => {
                                                    if (window.confirm('Bạn có chắc muốn xóa câu hỏi này không?')) {
                                                        deleteQuestion(activeQuestion.id, activeQuestionIndex);
                                                    }
                                                }}
                                            >
                                                <i className="fa-solid fa-trash" aria-hidden="true"></i>
                                                Xóa
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
                                                                        deleteOption(opt.id, activeQuestionIndex, oIdx);
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
                                                                        deleteOption(opt.id, activeQuestionIndex, oIdx);
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

                                        {isBoolean && (
                                            <div className="editor-section">
                                                <div className="editor-section-header">
                                                    <span className="section-title">Tuỳ chỉnh nhãn</span>
                                                </div>
                                                <div className="options-list two-column">
                                                    {activeQuestion.options?.map((opt, oIdx) => (
                                                        <div key={opt.id || oIdx} className="option-item soft">
                                                            <span className="option-index">{oIdx === 0 ? 'Yes' : 'No'}</span>
                                                            <input
                                                                className={`option-input ${activeQuestionOptionError ? 'error' : ''}`}
                                                                value={opt.option_text}
                                                                onChange={(e) => handleOptionChange(activeQuestionIndex, oIdx, e.target.value)}
                                                                placeholder={oIdx === 0 ? 'Có' : 'Không'}
                                                            />
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
                                                                            deleteOption(opt.id, activeQuestionIndex, oIdx);
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

                                    {/* {isMultipleChoice && (
                                        <div className="panel-field">
                                            <label>Chế độ lựa chọn</label>
                                            <div className="choice-toggle">
                                                <button
                                                    type="button"
                                                    className={`choice-pill ${activeQuestion.choice_type !== 'multiple' ? 'is-active' : ''}`}
                                                    onClick={() => handleChoiceTypeChange(activeQuestionIndex, 'single')}
                                                >
                                                    Chọn một
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`choice-pill ${activeQuestion.choice_type === 'multiple' ? 'is-active' : ''}`}
                                                    onClick={() => handleChoiceTypeChange(activeQuestionIndex, 'multiple')}
                                                >
                                                    Chọn nhiều
                                                </button>
                                            </div>
                                        </div>
                                    )} */}

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
                                        {stats.multipleChoice > 0 && (
                                            <div className="stat-chip">
                                                <span className="stat-label">Trắc nghiệm nhiều</span>
                                                <span className="stat-value">{stats.multipleChoice}</span>
                                            </div>
                                        )}
                                        {stats.singleChoice > 0 && (
                                            <div className="stat-chip">
                                                <span className="stat-label">Trắc nghiệm một</span>
                                                <span className="stat-value">{stats.singleChoice}</span>
                                            </div>
                                        )}
                                        {stats.booleanQ > 0 && (
                                            <div className="stat-chip">
                                                <span className="stat-label">Đúng/Sai</span>
                                                <span className="stat-value">{stats.booleanQ}</span>
                                            </div>
                                        )}
                                        {stats.ranking > 0 && (
                                            <div className="stat-chip">
                                                <span className="stat-label">Xếp hạng</span>
                                                <span className="stat-value">{stats.ranking}</span>
                                            </div>
                                        )}
                                        {stats.rating > 0 && (
                                            <div className="stat-chip">
                                                <span className="stat-label">Đánh giá</span>
                                                <span className="stat-value">{stats.rating}</span>
                                            </div>
                                        )}
                                        {stats.open > 0 && (
                                            <div className="stat-chip">
                                                <span className="stat-label">Mở</span>
                                                <span className="stat-value">{stats.open}</span>
                                            </div>
                                        )}
                                        {stats.dateTime > 0 && (
                                            <div className="stat-chip">
                                                <span className="stat-label">Ngày/Giờ</span>
                                                <span className="stat-value">{stats.dateTime}</span>
                                            </div>
                                        )}
                                        {stats.fileUpload > 0 && (
                                            <div className="stat-chip">
                                                <span className="stat-label">File</span>
                                                <span className="stat-value">{stats.fileUpload}</span>
                                            </div>
                                        )}
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
                                                        {surveyData.title || 'Tiêu đề khảo sát'}
                                                    </h2>
                                                    {surveyData.description && (
                                                        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                                                            {surveyData.description}
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
                                                        {q.type === 'open-ended' && (
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

                                                        {(q.type === 'multiple-choice-single' || q.type === 'multiple-choice-multiple' || q.type === 'boolean') && q.options && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {q.options.map((opt, optIdx) => (
                                                                    <label key={optIdx} style={{
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
                                                                            {typeof opt === 'string' ? opt : (opt.text || opt.id)}
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {q.type === 'ranking' && q.options && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {q.options.map((opt, optIdx) => (
                                                                    <div key={optIdx} style={{
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
                                                                            {typeof opt === 'string' ? opt : (opt.text || opt.id)}
                                                                        </span>
                                                                    </div>
                                                                ))}
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

                                                        {q.type === 'date_time' && (
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

                                                        {q.type === 'file_upload' && (
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
                                                    Gửi phản hồi
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
};

export default CreateSurvey;
