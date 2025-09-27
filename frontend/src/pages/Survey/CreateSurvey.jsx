import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { surveyService } from '../../services/surveyService';
import { questionService, optionService } from '../../services/questionSurvey';
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

function SortableSidebarItem({ id, index, text }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="sidebar-item">
            <span className="sidebar-number">Câu {index + 1}:</span>
            <span className="sidebar-text" title={text || 'Chưa có nội dung'}>
                {text || 'Chưa có nội dung'}
            </span>
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
    const [showChoiceModal, setShowChoiceModal] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(null);

    const [surveyData, setSurveyData] = useState({
        title: '',
        description: '',
        category_id: '',
        status: 'draft'
    });

    const sensors = useSensors(useSensor(PointerSensor));

    // Function để xóa question
    const deleteQuestion = async (questionId, questionIndex) => {
        try {
            // Chỉ xóa khỏi giao diện, không xóa khỏi database ngay lập tức
            // Sẽ xóa khỏi database khi ấn "Cập nhật"
            const newQuestions = questions.filter((_, i) => i !== questionIndex);
            setQuestions(newQuestions);

            console.log('✅ Đã xóa câu hỏi khỏi giao diện. Sẽ xóa khỏi database khi ấn "Cập nhật"');
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('Có lỗi xảy ra khi xóa câu hỏi. Vui lòng thử lại.');
        }
    };

    // Function để xóa option
    const deleteOption = async (optionId, questionIndex, optionIndex) => {
        try {
            // Chỉ xóa khỏi giao diện, không xóa khỏi database ngay lập tức
            // Sẽ xóa khỏi database khi ấn "Cập nhật"
            const newQuestions = [...questions];
            newQuestions[questionIndex].options.splice(optionIndex, 1);
            setQuestions(newQuestions);

            console.log('✅ Đã xóa tùy chọn khỏi giao diện. Sẽ xóa khỏi database khi ấn "Cập nhật"');
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
            console.log('Loading questions from server for survey:', surveyId);
            const questionsFromServer = await questionService.getQuestionsBySurvey(surveyId);
            console.log('Questions loaded from server:', questionsFromServer);

            // Load options cho mỗi question
            const questionsWithOptions = [];
            for (const question of questionsFromServer) {
                let options = [];
                if (question.questionType === 'multiple_choice') {
                    try {
                        options = await optionService.getOptionsByQuestion(question.id);
                        console.log(`Options loaded for question ${question.id}:`, options);
                    } catch (error) {
                        console.log(`No options found for question ${question.id}`);
                    }
                }

                questionsWithOptions.push({
                    id: question.id,
                    question_text: question.questionText,
                    question_type: question.questionType,
                    is_required: question.isRequired,
                    options: options.map(opt => ({
                        id: opt.id,
                        option_text: opt.optionText
                    }))
                });
            }

            setQuestions(questionsWithOptions);
        } catch (error) {
            console.error('Error loading questions from server:', error);
            // Fallback: load từ localStorage nếu có
            const editSurvey = location.state?.editSurvey;
            if (editSurvey?.questions && editSurvey.questions.length > 0) {
                setQuestions(editSurvey.questions);
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
                console.log('✅ Survey updated:', savedSurvey);
            } else {
                // Create new survey - backend luôn tạo với status 'draft'
                savedSurvey = await surveyService.createSurvey(payload);
                console.log('✅ Survey created:', savedSurvey);

                // Nếu muốn status 'published', cần cập nhật status sau khi tạo
                if (status === 'published') {
                    savedSurvey = await surveyService.updateSurvey(savedSurvey.id, { status: 'published' });
                    console.log('✅ Survey status updated to published:', savedSurvey);
                }
            }

            // Kiểm tra nếu savedSurvey tồn tại và có ID
            if (!savedSurvey || !savedSurvey.id) {
                console.error('❌ Failed to save survey:', savedSurvey);
                throw new Error('Không thể lưu khảo sát. Vui lòng thử lại.');
            }

            const surveyId = savedSurvey.id;

            // Xử lý xóa các câu hỏi và options đã bị xóa khỏi giao diện
            if (isEditMode && editSurveyId) {
                try {
                    // Lấy danh sách câu hỏi hiện tại từ server
                    const serverQuestions = await questionService.getQuestionsBySurvey(surveyId);
                    console.log('📋 Server questions:', serverQuestions);

                    // Tìm các câu hỏi đã bị xóa khỏi giao diện
                    const currentQuestionIds = questions.map(q => q.id).filter(id => id && !id.toString().startsWith('temp_'));
                    const deletedQuestions = serverQuestions.filter(sq => !currentQuestionIds.includes(sq.id));

                    console.log('🗑️ Questions to delete from server:', deletedQuestions);

                    // Xóa các câu hỏi đã bị xóa
                    for (const deletedQuestion of deletedQuestions) {
                        try {
                            // Xóa tất cả options của câu hỏi trước
                            const options = await optionService.getOptionsByQuestion(deletedQuestion.id);
                            for (const option of options) {
                                await optionService.deleteOption(option.id);
                                console.log(`✅ Deleted option ${option.id}`);
                            }

                            // Xóa câu hỏi
                            await questionService.deleteQuestion(deletedQuestion.id);
                            console.log(`✅ Deleted question ${deletedQuestion.id}`);
                        } catch (error) {
                            console.error(`❌ Error deleting question ${deletedQuestion.id}:`, error);
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

                                console.log(`🗑️ Options to delete for question ${question.id}:`, deletedOptions);

                                // Xóa các options đã bị xóa
                                for (const deletedOption of deletedOptions) {
                                    await optionService.deleteOption(deletedOption.id);
                                    console.log(`✅ Deleted option ${deletedOption.id}`);
                                }
                            } catch (error) {
                                console.error(`❌ Error processing options for question ${question.id}:`, error);
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ Error processing deletions:', error);
                }
            }

            // Tạo/cập nhật questions và options
            const updatedQuestions = [];
            if (questions.length > 0) {
                for (const question of questions) {
                    const questionPayload = {
                        surveyId: surveyId,
                        questionText: question.question_text,
                        questionType: question.question_type,
                        isRequired: question.is_required || false
                    };

                    let savedQuestion;
                    if (question.id && question.id.toString().startsWith('temp_')) {
                        // Tạo question mới
                        savedQuestion = await questionService.createQuestion(questionPayload);
                        console.log('✅ Question created:', savedQuestion);
                    } else if (question.id && !question.id.toString().startsWith('temp_')) {
                        // Cập nhật question hiện có
                        savedQuestion = await questionService.updateQuestion(question.id, {
                            questionText: question.question_text,
                            questionType: question.question_type,
                            isRequired: question.is_required || false
                        });
                        console.log('✅ Question updated:', savedQuestion);
                    } else {
                        // Nếu không có ID, tạo question mới
                        savedQuestion = await questionService.createQuestion(questionPayload);
                        console.log('✅ Question created (no ID):', savedQuestion);
                    }

                    // Kiểm tra nếu savedQuestion tồn tại
                    if (!savedQuestion || !savedQuestion.id) {
                        console.error('❌ Failed to save question:', question);
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
                                    console.log('✅ Option created:', savedOption);
                                } else if (option.id && !option.id.toString().startsWith('temp_option_')) {
                                    // Cập nhật option hiện có
                                    savedOption = await optionService.updateOption(option.id, {
                                        optionText: option.option_text
                                    });
                                    console.log('✅ Option updated:', savedOption);
                                } else {
                                    // Nếu không có ID, tạo option mới
                                    savedOption = await optionService.createOption(optionPayload);
                                    console.log('✅ Option created (no ID):', savedOption);
                                }

                                if (savedOption && savedOption.id) {
                                    updatedOptions.push({
                                        id: savedOption.id,
                                        option_text: savedOption.optionText
                                    });
                                } else {
                                    console.error('❌ Failed to save option:', option);
                                    throw new Error(`Không thể lưu lựa chọn: ${option.option_text}`);
                                }
                            }
                        }
                    }

                    // Tạo question object với ID thực từ server
                    const updatedQuestion = {
                        id: savedQuestion.id,
                        question_text: savedQuestion.questionText,
                        question_type: savedQuestion.questionType,
                        is_required: savedQuestion.isRequired,
                        options: updatedOptions
                    };

                    updatedQuestions.push(updatedQuestion);
                }
            }

            // Đồng bộ thứ tự câu hỏi lên backend theo thứ tự hiện tại trên giao diện
            try {
                if (updatedQuestions.length > 0) {
                    const orderedQuestionIds = updatedQuestions.map(q => q.id);
                    await questionService.reorderQuestions(surveyId, orderedQuestionIds);
                    console.log('✅ Đã lưu thứ tự câu hỏi mới lên server');
                }
            } catch (error) {
                console.error('❌ Lỗi khi lưu thứ tự câu hỏi:', error);
            }

            // Cập nhật state với questions có ID thực
            setQuestions(updatedQuestions);

            // Refresh questions từ server để đảm bảo đồng bộ
            if (surveyId) {
                setTimeout(async () => {
                    try {
                        await loadQuestionsFromServer(surveyId);
                    } catch (error) {
                        console.error('❌ Error refreshing questions:', error);
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

    return (
        <MainLayout>
            <div className="survey-topbar">
                <div className="survey-topbar-left">
                    <button
                        className="btn-top"
                        onClick={() =>
                            setQuestions(prev => [
                                ...prev,
                                {
                                    id: `temp_${Date.now()}`,
                                    question_text: '',
                                    question_type: 'open_ended',
                                    options: [],
                                    is_required: false
                                }
                            ])
                        }
                    >
                        + Thêm câu hỏi
                    </button>
                    <button
                        className="btn-top"
                        onClick={() => navigate('/create-ai')}
                    >
                        ⚡Gợi ý bằng AI
                    </button>
                </div>
                <div className="survey-topbar-right">
                    {!isEditMode && (
                        <button className="btn-save" onClick={() => saveSurvey('draft')} disabled={loading}>
                            Lưu bản nháp
                        </button>
                    )}
                    <button className="btn-publish" onClick={() => saveSurvey('published')} disabled={loading}>
                        {isEditMode ? 'Cập nhật' : 'Xuất bản'}
                    </button>
                </div>
            </div>

            <div className="survey-editor horizontal-layout">
                {/* Sidebar */}
                <div className="survey-sidebar">
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

                                // Chỉ đổi thứ tự trên giao diện. Gọi API khi ấn Lưu/Cập nhật
                                console.log('↔️ Đã thay đổi thứ tự câu hỏi trên giao diện');
                            }}
                        >
                            <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                                {questions.map((q, idx) => (
                                    <SortableSidebarItem key={q.id} id={q.id} index={idx} text={q.question_text} />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {/* Main content */}
                <div className="survey-main">
                    <div className="survey-info-card">
                        <label className="field-label">Tiêu đề:</label>
                        <input
                            className="survey-title-input"
                            value={surveyData.title}
                            onChange={(e) => handleSurveyDataChange('title', e.target.value)}
                            placeholder="Tiêu đề khảo sát"
                        />
                        <label className="field-label">Mô tả:</label>
                        <textarea
                            className="survey-desc-input"
                            value={surveyData.description}
                            onChange={(e) => handleSurveyDataChange('description', e.target.value)}
                            placeholder="Mô tả khảo sát..."
                        />
                    </div>

                    <div className="questions-container">
                        {questions.length === 0 ? (
                            <div className="questions-empty">
                                <i class="fa-regular fa-circle-question" style={{ fontSize: '4rem' }}></i>
                                <p>Chưa có câu hỏi nào</p>
                                <button
                                    className="btn-add-question"
                                    onClick={() =>
                                        setQuestions([{
                                            id: `temp_${Date.now()}`,
                                            question_text: '',
                                            question_type: 'open_ended',
                                            options: [],
                                            is_required: false
                                        }])
                                    }
                                >
                                    + Thêm câu hỏi đầu tiên
                                </button>
                            </div>
                        ) : (
                            <>
                                {questions.map((q, idx) => (
                                    <div key={q.id} className="question-block">
                                        <div className="question-header">
                                            <span className="question-label">Câu {idx + 1}</span>
                                            <div className="question-header-right">
                                                <select
                                                    className="question-type"
                                                    value={q.question_type}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'multiple_choice') {
                                                            setCurrentQuestionIndex(idx);
                                                            setShowChoiceModal(true);
                                                        } else {
                                                            const newQ = [...questions];
                                                            newQ[idx].question_type = e.target.value;
                                                            // Clear choice_type for non-multiple_choice questions
                                                            if (newQ[idx].choice_type) {
                                                                delete newQ[idx].choice_type;
                                                            }
                                                            setQuestions(newQ);
                                                        }
                                                    }}
                                                >
                                                    <option value="multiple_choice">Câu hỏi đóng</option>
                                                    <option value="open_ended">Câu hỏi mở</option>

                                                </select>
                                                <button
                                                    className="btn-delete-question"
                                                    onClick={() => {
                                                        if (window.confirm('Bạn có chắc muốn xóa câu hỏi này không?')) {
                                                            deleteQuestion(q.id, idx);
                                                        }
                                                    }}
                                                >
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>

                                        <input
                                            className="question-input"
                                            value={q.question_text}
                                            onChange={(e) => {
                                                const newQ = [...questions];
                                                newQ[idx].question_text = e.target.value;
                                                setQuestions(newQ);
                                            }}
                                            placeholder="Nhập nội dung câu hỏi"
                                        />

                                        {q.question_type === 'multiple_choice' && (
                                            <div className="options-list">
                                                {q.options?.map((opt, oIdx) => (
                                                    <div key={oIdx} className="option-item">
                                                        <input
                                                            className="option-input"
                                                            value={opt.option_text}
                                                            onChange={(e) => {
                                                                const newQ = [...questions];
                                                                newQ[idx].options[oIdx].option_text = e.target.value;
                                                                setQuestions(newQ);
                                                            }}
                                                            placeholder="Nhập nội dung câu trả lời"
                                                        />
                                                        <button
                                                            className="remove-option"
                                                            onClick={() => {
                                                                if (window.confirm('Bạn có chắc muốn xóa lựa chọn này không?')) {
                                                                    deleteOption(opt.id, idx, oIdx);
                                                                }
                                                            }}
                                                        ><i class="fa-solid fa-delete-left"></i></button>
                                                    </div>
                                                ))}
                                                <button
                                                    className="add-option"
                                                    onClick={() => {
                                                        const newQ = [...questions];
                                                        newQ[idx].options.push({
                                                            id: `temp_option_${Date.now()}_${newQ[idx].options.length + 1}`,
                                                            option_text: ''
                                                        });
                                                        setQuestions(newQ);
                                                    }}
                                                >
                                                    + Thêm lựa chọn
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="add-question-footer">
                                    <button
                                        className="btn-add-question"
                                        onClick={() =>
                                            setQuestions(prev => [
                                                ...prev,
                                                {
                                                    id: `temp_${Date.now()}`,
                                                    question_text: '',
                                                    question_type: 'open_ended',
                                                    options: [],
                                                    is_required: false
                                                }
                                            ])
                                        }
                                    >
                                        + Thêm câu hỏi
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Choice Type Modal */}
            {showChoiceModal && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            // Reset to open_ended if modal overlay is clicked
                            const newQ = [...questions];
                            newQ[currentQuestionIndex].question_type = 'open_ended';
                            if (newQ[currentQuestionIndex].choice_type) {
                                delete newQ[currentQuestionIndex].choice_type;
                            }
                            setQuestions(newQ);
                            setShowChoiceModal(false);
                        }
                    }}
                >
                    <div className="choice-modal">
                        <div className="modal-header">
                            <h3>Chọn loại câu hỏi đóng</h3>
                        </div>
                        <button
                            className="modal-close"
                            onClick={() => {
                                // Reset to open_ended if modal is closed without selection
                                const newQ = [...questions];
                                newQ[currentQuestionIndex].question_type = 'open_ended';
                                if (newQ[currentQuestionIndex].choice_type) {
                                    delete newQ[currentQuestionIndex].choice_type;
                                }
                                setQuestions(newQ);
                                setShowChoiceModal(false);
                            }}
                        >
                            ×
                        </button>
                        <div className="modal-content">
                            <p>Bạn muốn tạo loại câu hỏi nào?</p>
                            <div className="choice-options">
                                <button
                                    className="choice-option"
                                    onClick={() => {
                                        const newQ = [...questions];
                                        newQ[currentQuestionIndex].question_type = 'multiple_choice';
                                        newQ[currentQuestionIndex].choice_type = 'single';
                                        newQ[currentQuestionIndex].options = [
                                            { id: `temp_option_${Date.now()}_1`, option_text: '' },
                                            { id: `temp_option_${Date.now()}_2`, option_text: '' }
                                        ];
                                        setQuestions(newQ);
                                        setShowChoiceModal(false);
                                    }}
                                >
                                    <div className="choice-icon"><i class="fa-solid fa-check"></i></div>
                                    <div className="choice-text">
                                        <h4>Chọn 1 đáp án</h4>
                                        <p>Người trả lời chỉ có thể chọn một lựa chọn</p>
                                    </div>
                                </button>
                                <button
                                    className="choice-option"
                                    onClick={() => {
                                        const newQ = [...questions];
                                        newQ[currentQuestionIndex].question_type = 'multiple_choice';
                                        newQ[currentQuestionIndex].choice_type = 'multiple';
                                        newQ[currentQuestionIndex].options = [
                                            { id: `temp_option_${Date.now()}_1`, option_text: '' },
                                            { id: `temp_option_${Date.now()}_2`, option_text: '' }
                                        ];
                                        setQuestions(newQ);
                                        setShowChoiceModal(false);
                                    }}
                                >
                                    <div className="choice-icon"><i class="fa-solid fa-dice-two"></i></div>
                                    <div className="choice-text">
                                        <h4>Chọn nhiều đáp án</h4>
                                        <p>Người trả lời có thể chọn nhiều lựa chọn</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default CreateSurvey;
