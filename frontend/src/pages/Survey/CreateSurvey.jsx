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

const QUESTION_TYPE_OPTIONS = [
    { value: 'short_text', label: 'Trả lời ngắn' },
    { value: 'multiple_choice', label: 'Trắc nghiệm' },
    { value: 'rating', label: 'Xếp hạng' },
    { value: 'yes_no', label: 'Yes / No' }
];

const mapTypeFromBackend = (type) => {
    switch (type) {
        case 'open_ended':
            return 'short_text';
        case 'boolean':
        case 'boolean_':
            return 'yes_no';
        default:
            return type || 'short_text';
    }
};

const mapTypeToBackend = (type) => {
    switch (type) {
        case 'short_text':
            return 'open_ended';
        case 'yes_no':
            return 'boolean';
        default:
            return type;
    }
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

const createEmptyQuestion = (type = 'short_text') => {
    const base = {
        id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        question_text: '',
        question_type: type,
        options: [],
        is_required: false
    };

    if (type === 'multiple_choice') {
        return {
            ...base,
            options: createDefaultOptions(),
            choice_type: 'single'
        };
    }

    if (type === 'yes_no') {
        return {
            ...base,
            options: createYesNoOptions()
        };
    }

    if (type === 'rating') {
        return {
            ...base,
            // cố định thang điểm 5 sao
            rating_scale: 5
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

    if (question.question_type === 'multiple_choice') {
        cloned.choice_type = question.choice_type || 'single';
    } else {
        delete cloned.choice_type;
    }

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
        is_required: rawQuestion.is_required ?? rawQuestion.isRequired ?? false,
        options: []
    };

    if (normalizedType === 'multiple_choice') {
        const rawOptions = rawQuestion.options || rawQuestion.optionsList || [];
        const mappedOptions = rawOptions.length > 0
            ? rawOptions.map(ensureOptionShape)
            : createDefaultOptions();
        return {
            ...base,
            options: mappedOptions,
            choice_type: rawQuestion.choice_type || rawQuestion.choiceType || 'single'
        };
    }

    if (normalizedType === 'yes_no') {
        const rawOptions = rawQuestion.options || [];
        const mappedOptions = rawOptions.length >= 2
            ? rawOptions.map(ensureOptionShape)
            : createYesNoOptions();
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
        const yesNo = questions.filter(q => q.question_type === 'yes_no').length;
        const rating = questions.filter(q => q.question_type === 'rating').length;
        const closed = multipleChoice + yesNo + rating;
        return {
            total,
            required,
            multipleChoice,
            yesNo,
            rating,
            open: total - closed
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

    const handleAddQuestion = (type = 'short_text') => {
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
            // Kiểm tra xem có đủ thông tin để tạo AI context không
            const hasTitle = surveyData.title && surveyData.title.trim().length > 0;
            const hasDescription = surveyData.description && surveyData.description.trim().length > 0;
            
            if (!hasTitle && !hasDescription) {
                alert('⚠️ Không thể tạo lại câu hỏi!\n\nĐể sử dụng tính năng này, vui lòng:\n1. Thêm tiêu đề cho khảo sát\n2. Thêm mô tả cho khảo sát\n\nSau đó thử lại.');
                return;
            }

            // Thêm questionIndex vào set đang refresh
            setRefreshingQuestions(prev => new Set([...prev, questionIndex]));

            const currentQuestion = questions[questionIndex];
            if (!currentQuestion) return;

            // Tạo AI context từ thông tin có sẵn
            const surveyTitle = hasTitle ? surveyData.title : "Khảo sát";
            const surveyDesc = hasDescription ? surveyData.description : "Khảo sát không có mô tả cụ thể";
            const categoryName = categories.find(cat => cat.id === parseInt(surveyData.category_id))?.category_name || "General";

            // Tạo prompt dựa trên thông tin survey và câu hỏi hiện tại
            const requestData = {
                title: `Câu hỏi thay thế`,
                description: `Tạo lại câu hỏi cho khảo sát: ${surveyTitle}`,
                categoryName: categoryName,
                aiPrompt: `Tạo khảo sát về "${surveyTitle}". Mô tả: "${surveyDesc}". Tạo câu hỏi thay thế tương tự nhưng khác biệt cho câu hỏi hiện tại: "${currentQuestion.question_text}"`,
                targetAudience: "Người tham gia khảo sát",
                numberOfQuestions: 3 // Tạo 3 câu ổn định, lấy câu đầu để thay thế
            };

            console.log("🔄 Regenerating question in CreateSurvey:", requestData);

            const response = await aiSurveyService.generateSurvey(requestData);

            if (response.success && response.generated_survey && response.generated_survey.questions && response.generated_survey.questions.length > 0) {
                // Lấy câu hỏi đầu tiên từ response
                const aiQuestion = response.generated_survey.questions[0];

                // Map response về format frontend tương tự như CreateAI
                const newQuestion = {
                    id: currentQuestion.id, // Giữ nguyên ID để không bị conflict
                    question_text: aiQuestion.question_text,
                    question_type: mapTypeFromBackend(aiQuestion.question_type),
                    is_required: aiQuestion.is_required ?? true,
                    options: aiQuestion.options ? aiQuestion.options.map((opt, optIndex) => ({
                        id: `temp_option_${Date.now()}_${optIndex}`,
                        option_text: opt.option_text
                    })) : []
                };

                // Add special handling for question types
                if (newQuestion.question_type === 'multiple_choice') {
                    newQuestion.choice_type = 'single';
                    if (newQuestion.options.length === 0) {
                        newQuestion.options = createDefaultOptions();
                    }
                } else if (newQuestion.question_type === 'yes_no' && newQuestion.options.length === 0) {
                    newQuestion.options = createYesNoOptions();
                } else if (newQuestion.question_type === 'rating') {
                    newQuestion.rating_scale = 5;
                }

                // Update the question in the questions array
                setQuestions(prev => {
                    const next = [...prev];
                    next[questionIndex] = newQuestion;
                    return next;
                });

                console.log("✅ Question regenerated in CreateSurvey:", newQuestion);
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
            // Xóa questionIndex khỏi set đang refresh
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

            if (type === 'multiple_choice') {
                current.choice_type = choiceType || current.choice_type || 'single';
                current.options = (current.options && current.options.length > 0)
                    ? current.options
                    : createDefaultOptions();
                delete current.rating_scale;
            } else if (type === 'yes_no') {
                current.options = createYesNoOptions();
                delete current.choice_type;
                delete current.rating_scale;
            } else if (type === 'rating') {
                delete current.choice_type;
                current.options = [];
                current.rating_scale = current.rating_scale || 5;
            } else {
                delete current.choice_type;
                delete current.rating_scale;
                current.options = [];
            }

            next[index] = current;
            return next;
        });

        if (type !== 'multiple_choice') {
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
            if (!currentQuestion || currentQuestion.question_type !== 'multiple_choice') {
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
                if (!currentQuestion || currentQuestion.question_type !== 'multiple_choice') {
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

    useEffect(() => {
        loadCategories();

        // Kiểm tra nếu đang edit survey
        const editSurvey = location.state?.editSurvey;
        if (editSurvey) {
            setIsEditMode(true);
            setEditSurveyId(editSurvey.id);

            // Load dữ liệu survey
            setSurveyData({
                title: editSurvey.title || '',
                description: editSurvey.description || '',
                category_id: editSurvey.categoryId || '',
                status: editSurvey.status || 'draft'
            });

            // Load questions từ server nếu có surveyId
            if (editSurvey.id && !editSurvey.id.toString().startsWith('temp_')) {
                loadQuestionsFromServer(editSurvey.id);
            } else if (editSurvey.questions && editSurvey.questions.length > 0) {
                // Fallback: load từ localStorage
                setQuestions(editSurvey.questions);
            }
        }
    }, [location.state]);

    // Function để load questions từ server
    const loadQuestionsFromServer = async (surveyId) => {
        try {
            const questionsFromServer = await questionService.getQuestionsBySurvey(surveyId);
            const questionsWithOptions = [];

            for (const question of questionsFromServer) {
                let options = [];
                if (question.questionType === 'multiple_choice') {
                    try {
                        options = await optionService.getOptionsByQuestion(question.id);
                    } catch (error) {
                        console.log(`No options found for question ${question.id}`);
                    }
                }

                const normalized = normalizeQuestionData({
                    id: question.id,
                    question_text: question.questionText,
                    question_type: question.questionType,
                    is_required: question.isRequired,
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
            if (q.question_type === 'multiple_choice') {
                const validOpts = q.options?.filter(o => o.option_text.trim());
                if (!validOpts || validOpts.length < 2) {
                    newErrors[`question_${idx}_options`] = 'Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn';
                }
            }
            if (q.question_type === 'yes_no') {
                const yesNoOpts = q.options?.filter(o => o.option_text.trim());
                if (!yesNoOpts || yesNoOpts.length < 2) {
                    newErrors[`question_${idx}_options`] = 'Câu hỏi Yes/No cần tối thiểu 2 lựa chọn';
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
                        if (question.id && !question.id.toString().startsWith('temp_') && question.question_type === 'multiple_choice') {
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
                        isRequired: question.is_required || false
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
                            isRequired: question.is_required || false
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

                    // Tạo/cập nhật options cho multiple choice questions
                    const updatedOptions = [];
                    if (question.question_type === 'multiple_choice' && question.options?.length > 0) {
                        for (const option of question.options) {
                            if (option.option_text.trim()) {
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
                        options: question.question_type === 'multiple_choice'
                            ? updatedOptions
                            : (question.question_type === 'yes_no' ? question.options : []),
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

            // Chuyển về dashboard sau khi lưu/cập nhật thành công
            navigate('/dashboard');
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
    const isYesNo = activeQuestion?.question_type === 'yes_no';
    const isRating = activeQuestion?.question_type === 'rating';

    // Build preview survey xem trước khảo sát ResponseFormPage
    const buildPreviewSurvey = () => {
        const mappedQuestions = questions.map(q => {
            let type = 'open-text';
            if (q.question_type === 'multiple_choice') {
                type = q.choice_type === 'multiple' ? 'multiple-choice-multiple' : 'multiple-choice-single';
            } else if (q.question_type === 'yes_no') {
                type = 'multiple-choice-single';
            } else if (q.question_type === 'rating') {
                type = 'rating-scale';
            }
            return {
                id: q.id,
                text: q.question_text,
                type,
                options: (q.options || []).map(o => o.option_text),
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
        const preview = buildPreviewSurvey();
        navigate('/response-preview', { state: { survey: preview } });
    };

    return (
        <MainLayout>
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
                            className="btn-share"
                            type="button"
                            onClick={() => saveSurvey('published')}
                            disabled={loading}
                        >
                            {loading ? (
                                'Đang xử lý…'
                            ) : (
                                <>
                                    <i className="fa-solid fa-share-nodes" aria-hidden="true"></i>
                                    <span>{isEditMode ? 'Cập nhật' : 'Xuất bản'}</span>
                                </>
                            )}
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

                                        {!isMultipleChoice && !isYesNo && !isRating && (
                                            <div className="question-helper">
                                                Người tham gia sẽ nhập câu trả lời ngắn gọn cho câu hỏi này.
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

                                        {isYesNo && (
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
                                        <div className="stat-chip">
                                            <span className="stat-label">Trắc nghiệm</span>
                                            <span className="stat-value">{stats.multipleChoice}</span>
                                        </div>
                                        <div className="stat-chip">
                                            <span className="stat-label">Yes/No</span>
                                            <span className="stat-value">{stats.yesNo}</span>
                                        </div>
                                        <div className="stat-chip">
                                            <span className="stat-label">Xếp hạng</span>
                                            <span className="stat-value">{stats.rating}</span>
                                        </div>
                                        <div className="stat-chip">
                                            <span className="stat-label">Trả lời ngắn</span>
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
        </MainLayout>
    );
};

export default CreateSurvey;
