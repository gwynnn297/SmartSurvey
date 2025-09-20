import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { surveyService } from '../../services/surveyService';
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
            <span className="sidebar-text">{text?.slice(0, 20) || 'Chưa có nội dung'}</span>
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

    const [surveyData, setSurveyData] = useState({
        title: '',
        description: '',
        category_id: '',
        status: 'draft'
    });

    const sensors = useSensors(useSensor(PointerSensor));

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

            // Load questions nếu có
            if (editSurvey.questions && editSurvey.questions.length > 0) {
                setQuestions(editSurvey.questions);
            }
        }
    }, [location.state]);

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
                // Update existing survey
                savedSurvey = await surveyService.updateSurvey(editSurveyId, payload);
                console.log('✅ Survey updated:', savedSurvey);
            } else {
                // Create new survey
                savedSurvey = await surveyService.createSurvey(payload);
                console.log('✅ Survey created:', savedSurvey);
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
                            questionsCount: questions.length,
                            questions: questions,
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
                    status: 'draft',
                    categoryName: savedSurvey.categoryName,
                    createdAt: savedSurvey.createdAt,
                    questionsCount: questions.length,
                    questions: questions,
                    responses: 0
                };
                existingSurveys.push(newSurvey);
                localStorage.setItem('userSurveys', JSON.stringify(existingSurveys));
            }

            const message = isEditMode
                ? (status === 'draft' ? 'Đã cập nhật bản nháp khảo sát!' : 'Đã cập nhật khảo sát thành công!')
                : (status === 'draft' ? 'Đã lưu bản nháp khảo sát!' : 'Đã tạo khảo sát thành công!');

            alert(message);
            navigate('/dashboard');
        } catch (err) {
            console.error('Lỗi khi lưu khảo sát:', err);
            alert('Có lỗi xảy ra khi lưu khảo sát. Vui lòng thử lại.');
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
                                    id: Date.now(),
                                    question_text: '',
                                    question_type: 'multiple_choice',
                                    options: [{ option_text: '' }, { option_text: '' }],
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
                        ⚡ Gợi ý bằng AI
                    </button>
                </div>
                <div className="survey-topbar-right">
                    <button className="btn-save" onClick={() => saveSurvey('draft')} disabled={loading}>
                        {isEditMode ? 'Cập nhật bản nháp' : 'Lưu bản nháp'}
                    </button>
                    <button className="btn-publish" onClick={() => saveSurvey('active')} disabled={loading}>
                        {isEditMode ? 'Cập nhật' : 'Lưu'}
                    </button>
                </div>
            </div>

            <div className="survey-editor">
                {/* Sidebar */}
                <div className="survey-sidebar">
                    {questions.length === 0 ? (
                        <div className="sidebar-empty">Chưa có câu hỏi</div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={({ active, over }) => {
                                if (active.id !== over.id) {
                                    const oldIndex = questions.findIndex(q => q.id === active.id);
                                    const newIndex = questions.findIndex(q => q.id === over.id);
                                    setQuestions(arrayMove(questions, oldIndex, newIndex));
                                }
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
                        <input
                            className="survey-title-input"
                            value={surveyData.title}
                            onChange={(e) => handleSurveyDataChange('title', e.target.value)}
                            placeholder="Tiêu đề khảo sát"
                        />
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
                                <p>Chưa có câu hỏi nào.</p>
                                <button
                                    className="btn-add-question"
                                    onClick={() =>
                                        setQuestions([{
                                            id: Date.now(),
                                            question_text: '',
                                            question_type: 'multiple_choice',
                                            options: [{ option_text: '' }, { option_text: '' }],
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
                                                        const newQ = [...questions];
                                                        newQ[idx].question_type = e.target.value;
                                                        setQuestions(newQ);
                                                    }}
                                                >
                                                    <option value="multiple_choice">Trắc nghiệm</option>
                                                    <option value="open_ended">Tự luận</option>
                                                </select>
                                                <button
                                                    className="btn-delete-question"
                                                    onClick={() => {
                                                        const newQ = questions.filter((_, i) => i !== idx);
                                                        setQuestions(newQ);
                                                    }}
                                                >
                                                    🗑
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
                                                                const newQ = [...questions];
                                                                newQ[idx].options.splice(oIdx, 1);
                                                                setQuestions(newQ);
                                                            }}
                                                        >x</button>
                                                    </div>
                                                ))}
                                                <button
                                                    className="add-option"
                                                    onClick={() => {
                                                        const newQ = [...questions];
                                                        newQ[idx].options.push({ option_text: '' });
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
                                                    id: Date.now(),
                                                    question_text: '',
                                                    question_type: 'multiple_choice',
                                                    options: [{ option_text: '' }, { option_text: '' }],
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
        </MainLayout>
    );
};

export default CreateSurvey;
