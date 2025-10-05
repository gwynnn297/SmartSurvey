import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { surveyService } from '../../services/surveyService';
import { questionService, optionService } from '../../services/questionSurvey';
import './CreateAI.css';
import '../Survey/CreateSurvey.css';

// Constants from CreateSurvey
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
    createEmptyOption('Lựa chọn 1'),
    createEmptyOption('Lựa chọn 2')
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
            rating_scale: 5
        };
    }

    return base;
};

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
            ? rawOptions.map(opt => ({
                id: opt?.id || `temp_option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                option_text: opt?.option_text ?? opt?.optionText ?? ''
            }))
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
            ? rawOptions.map(opt => ({
                id: opt?.id || `temp_option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                option_text: opt?.option_text ?? opt?.optionText ?? ''
            }))
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

export default function CreateAI() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: '',
        category_id: '',
        description: '',
        ai_context: '',
        question_count: 15
    });

    const [errors, setErrors] = useState({});
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [questions, setQuestions] = useState([]);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(null);
    const [showProcessingModal, setShowProcessingModal] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [showForm, setShowForm] = useState(true);

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
            const response = await surveyService.getCategories();
            setCategories(response.data || response || []);
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setCategoriesLoading(false);
        }
    };

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
        if (!form.ai_context.trim()) {
            newErrors.ai_context = 'Vui lòng nhập ngữ cảnh chi tiết';
        }
        const questionCount = Number(form.question_count);
        if (!questionCount || questionCount < 1 || questionCount > 30) {
            newErrors.question_count = 'Vui lòng nhập số lượng câu hỏi từ 1 đến 30';
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
        });
        setErrors(prev => ({ ...prev, ...newErrors }));
        return Object.keys(newErrors).length === 0;
    };

    // Generate mock questions based on question count
    const generateMockQuestions = (count) => {
        const questionTypes = ['short_text', 'multiple_choice', 'rating', 'yes_no'];
        const sampleTexts = [
            'Bạn đánh giá chất lượng dịch vụ thế nào?',
            'Bạn có hài lòng với sản phẩm không?',
            'Bạn sẽ giới thiệu cho bạn bè không?',
            'Điểm mạnh nhất của sản phẩm là gì?',
            'Bạn gặp khó khăn gì khi sử dụng?',
            'Tần suất bạn sử dụng sản phẩm?',
            'Bạn sử dụng kênh nào để tìm hiểu?',
            'Bạn có tham gia chương trình khách hàng thân thiết không?',
            'Đánh giá tổng thể về trải nghiệm?',
            'Bạn có kế hoạch tiếp tục sử dụng không?',
            'Mức độ hài lòng của bạn với giá cả?',
            'Bạn có gặp vấn đề gì khi mua hàng không?',
            'Bạn thích tính năng nào nhất?',
            'Bạn có muốn cải thiện điều gì không?',
            'Bạn có sẵn sàng trả thêm phí cho tính năng mới không?'
        ];

        const questions = Array.from({ length: count }, (_, i) => {
            const type = questionTypes[i % questionTypes.length];
            const textIndex = i % sampleTexts.length;
            const questionText = i < sampleTexts.length ? sampleTexts[i] : `Câu hỏi số ${i + 1} do AI sinh ra`;

            const question = {
                id: `temp_${Date.now()}_${i}`,
                question_text: questionText,
                question_type: type,
                is_required: Math.random() > 0.3, // 70% required
                options: []
            };

            // Add options for choice-based questions
            if (type === 'multiple_choice') {
                const optionTexts = [
                    ['Rất tốt', 'Tốt', 'Bình thường', 'Kém'],
                    ['Có', 'Không', 'Không chắc'],
                    ['Hàng ngày', 'Vài lần/tuần', 'Hàng tuần', 'Hàng tháng'],
                    ['Rất hài lòng', 'Hài lòng', 'Bình thường', 'Không hài lòng'],
                    ['Chắc chắn có', 'Có thể có', 'Không chắc', 'Có thể không']
                ];

                const selectedOptions = optionTexts[i % optionTexts.length];
                const optionCount = Math.random() > 0.5 ? 3 : 4;
                question.options = selectedOptions.slice(0, optionCount).map((text, idx) =>
                    createEmptyOption(text)
                );
                question.choice_type = 'single';
            } else if (type === 'yes_no') {
                question.options = createYesNoOptions();
            } else if (type === 'rating') {
                question.rating_scale = 5;
            }

            return question;
        });

        return questions;
    };

    // Simulate AI processing with animated steps
    const simulateAIProcessing = async () => {
        setCurrentStep(0);
        setProgress(0);

        const aiSteps = [
            'Phân tích ngữ cảnh và mục tiêu khảo sát',
            'Tạo bộ câu hỏi phù hợp',
            'Tối ưu hóa thứ tự và logic câu hỏi',
            'Hoàn thiện và chuẩn bị giao diện chỉnh sửa'
        ];

        for (let i = 0; i < aiSteps.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second per step
            setCurrentStep(i + 1);
            setProgress(((i + 1) / aiSteps.length) * 100);
        }
    };

    const handleGenerateQuestions = async () => {
        if (!validateForm()) return;

        setShowProcessingModal(true);
        setLoading(true);

        try {
            // Mô phỏng AI processing
            await simulateAIProcessing();

            console.log("🚀 Generating mock questions with", form.question_count, "questions");

            // Tạo dữ liệu mock câu hỏi theo số lượng người dùng nhập
            const mockQuestions = generateMockQuestions(Number(form.question_count || 15));

            setQuestions(mockQuestions);
            setShowProcessingModal(false);
            setShowForm(false);

        } catch (e) {
            console.error("❌ AI generation error:", e);
            alert("Không thể tạo gợi ý. Vui lòng thử lại.");
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

    const handleRefreshQuestion = async (questionIndex) => {
        try {
            // Generate a new question to replace the current one
            const questionTypes = ['short_text', 'multiple_choice', 'rating', 'yes_no'];
            const sampleTexts = [
                'Bạn đánh giá chất lượng dịch vụ thế nào?',
                'Bạn có hài lòng với sản phẩm không?',
                'Bạn sẽ giới thiệu cho bạn bè không?',
                'Điểm mạnh nhất của sản phẩm là gì?',
                'Bạn gặp khó khăn gì khi sử dụng?',
                'Tần suất bạn sử dụng sản phẩm?',
                'Bạn sử dụng kênh nào để tìm hiểu?',
                'Bạn có tham gia chương trình khách hàng thân thiết không?',
                'Đánh giá tổng thể về trải nghiệm?',
                'Bạn có kế hoạch tiếp tục sử dụng không?'
            ];

            // Get random type and text
            const randomType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
            const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];

            const newQuestion = {
                id: `temp_${Date.now()}_${questionIndex}`,
                question_text: randomText,
                question_type: randomType,
                is_required: Math.random() > 0.3,
                options: []
            };

            // Add options for choice-based questions
            if (randomType === 'multiple_choice') {
                const optionTexts = [
                    ['Rất tốt', 'Tốt', 'Bình thường', 'Kém'],
                    ['Có', 'Không', 'Không chắc'],
                    ['Hàng ngày', 'Vài lần/tuần', 'Hàng tuần', 'Hàng tháng'],
                    ['Rất hài lòng', 'Hài lòng', 'Bình thường', 'Không hài lòng'],
                    ['Chắc chắn có', 'Có thể có', 'Không chắc', 'Có thể không']
                ];

                const selectedOptions = optionTexts[Math.floor(Math.random() * optionTexts.length)];
                const optionCount = Math.random() > 0.5 ? 3 : 4;
                newQuestion.options = selectedOptions.slice(0, optionCount).map((text, idx) =>
                    createEmptyOption(text)
                );
                newQuestion.choice_type = 'single';
            } else if (randomType === 'yes_no') {
                newQuestion.options = createYesNoOptions();
            } else if (randomType === 'rating') {
                newQuestion.rating_scale = 5;
            }

            // Update the question in the questions array
            setQuestions(prev => {
                const next = [...prev];
                next[questionIndex] = newQuestion;
                return next;
            });

        } catch (error) {
            console.error('Error refreshing question:', error);
            alert('Không thể tạo câu hỏi mới. Vui lòng thử lại.');
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
            id: 'ai-preview',
            title: form.title || 'Xem trước khảo sát AI',
            description: form.description || '',
            questions: mappedQuestions
        };
    };

    const handlePreview = () => {
        const preview = buildPreviewSurvey();

        // Lưu dữ liệu tạm thời vào localStorage để có thể quay lại
        const tempData = {
            form: form,
            questions: questions,
            activeQuestionIndex: activeQuestionIndex,
            timestamp: Date.now()
        };
        localStorage.setItem('aiSurveyTempData', JSON.stringify(tempData));

        navigate('/response-preview', { state: { survey: preview } });
    };

    const activeQuestion = activeQuestionIndex !== null ? questions[activeQuestionIndex] : null;
    const activeQuestionNumber = activeQuestionIndex !== null ? activeQuestionIndex + 1 : null;
    const activeQuestionError = activeQuestionIndex !== null ? errors[`question_${activeQuestionIndex}`] : null;
    const activeQuestionOptionError = activeQuestionIndex !== null ? errors[`question_${activeQuestionIndex}_options`] : null;
    const isMultipleChoice = activeQuestion?.question_type === 'multiple_choice';
    const isYesNo = activeQuestion?.question_type === 'yes_no';
    const isRating = activeQuestion?.question_type === 'rating';

    return (
        <MainLayout>
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
                        <div className="ai-form-row">
                            <label>Mô tả khảo sát</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                placeholder="Mô tả ngắn gọn về mục đích khảo sát"
                                rows={3}
                            />
                        </div>
                        <div className="ai-form-row">
                            <label>Số lượng câu hỏi cần tạo <span className="req">*</span></label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={form.question_count || 15}
                                onChange={(e) => handleFormChange('question_count', e.target.value)}
                                placeholder="Nhập số lượng câu hỏi (VD: 15)"
                                className={errors.question_count ? 'error' : ''}
                            />
                            {errors.question_count && <div className="ai-error">{errors.question_count}</div>}
                        </div>
                        <div className="ai-form-row">
                            <label>Ngữ cảnh chi tiết cho AI <span className="req">*</span></label>
                            <textarea
                                rows={8}
                                value={form.ai_context}
                                onChange={(e) => handleFormChange('ai_context', e.target.value)}
                                placeholder={`Hãy mô tả chi tiết:\n- Mục tiêu khảo sát\n- Đối tượng tham gia\n- Thông tin cần thu thập\n- Bối cảnh cụ thể`}
                                className={errors.ai_context ? 'error' : ''}
                            />
                            {errors.ai_context && <div className="ai-error">{errors.ai_context}</div>}
                        </div>

                        <div className="ai-actions">
                            <button className="btn-primary" onClick={handleGenerateQuestions} disabled={loading}>
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
                                className="btn-share"
                                type="button"
                                onClick={() => alert('Chức năng lưu sẽ được phát triển')}
                                disabled={loading}
                            >
                                <i className="fa-solid fa-share-nodes" aria-hidden="true"></i>
                                <span>Lưu khảo sát</span>
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
                                                    onClick={() => handleRefreshQuestion(activeQuestionIndex)}
                                                    title="Tạo lại câu hỏi"
                                                >
                                                    <i className="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
                                                    Tạo lại
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

                                        {isMultipleChoice && (
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
                                        )}

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
                                    <strong>Số câu hỏi:</strong> {form.question_count || 15} câu
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

                        {/* Helpful tips */}
                        <div className="ai-tips">
                            <div className="ai-tips-header">
                                <span className="ai-tips-icon">💡</span>
                                <strong>Mẹo hữu ích</strong>
                            </div>
                            <p>Sau khi AI hoàn thành, bạn sẽ có thể:</p>
                            <ul className="ai-tips-list">
                                <li>Chỉnh sửa nội dung từng câu hỏi</li>
                                <li>Thay đổi loại câu hỏi (trắc nghiệm, tự luận, v.v.)</li>
                                <li>Thêm, xóa hoặc sắp xếp lại câu hỏi</li>
                                <li>Tùy chỉnh các lựa chọn trả lời</li>
                                <li>Sử dụng nút refresh để tạo lại câu hỏi</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}