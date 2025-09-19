import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Item trong sidebar
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
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [errors, setErrors] = useState({});

    const [surveyData, setSurveyData] = useState({
        title: '',
        description: '',
        category_id: '',
        status: 'draft'
    });

    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const response = await surveyService.getCategories();
            setCategories(response.data || response || []);
        } catch (error) {
            console.error('Error loading categories:', error);
            setCategories([
                { id: 1, name: 'Khảo sát khách hàng' },
                { id: 2, name: 'Khảo sát nhân viên' },
                { id: 3, name: 'Khảo sát sản phẩm' },
                { id: 4, name: 'Khảo sát dịch vụ' },
                { id: 5, name: 'Khác' }
            ]);
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
        questions.forEach((question, index) => {
            if (!question.question_text.trim()) {
                newErrors[`question_${index}`] = 'Nội dung câu hỏi là bắt buộc';
            }
            if (question.question_type === 'multiple_choice') {
                const validOptions = question.options?.filter(opt => opt.option_text.trim());
                if (!validOptions || validOptions.length < 2) {
                    newErrors[`question_${index}_options`] = 'Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn';
                }
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const saveAsDraft = async () => {
        if (!validateForm()) return;
        setLoading(true);
        try {
            const surveyPayload = { ...surveyData, status: 'draft' };
            const savedSurvey = await surveyService.createSurvey(surveyPayload);
            if (questions.length > 0 && savedSurvey.survey_id) {
                for (const question of questions) {
                    await surveyService.addQuestion(savedSurvey.survey_id, {
                        question_text: question.question_text,
                        question_type: question.question_type,
                        is_required: question.is_required
                    });
                }
            }
            const existing = JSON.parse(localStorage.getItem('userSurveys') || '[]');
            existing.unshift({
                id: savedSurvey.survey_id || Date.now(),
                title: surveyData.title,
                description: surveyData.description,
                status: 'draft',
                createdAt: new Date().toISOString(),
                responses: 0,
                questionsCount: questions.length,
                questions
            });
            localStorage.setItem('userSurveys', JSON.stringify(existing));
            alert('Lưu nháp thành công!');
            navigate('/dashboard');
        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Có lỗi xảy ra khi lưu nháp. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const publishSurvey = async () => {
        if (!validateForm()) return;
        setLoading(true);
        try {
            const surveyPayload = { ...surveyData, status: 'active' };
            const savedSurvey = await surveyService.createSurvey(surveyPayload);
            if (questions.length > 0 && savedSurvey.survey_id) {
                for (const question of questions) {
                    await surveyService.addQuestion(savedSurvey.survey_id, {
                        question_text: question.question_text,
                        question_type: question.question_type,
                        is_required: question.is_required
                    });
                }
            }
            const existing = JSON.parse(localStorage.getItem('userSurveys') || '[]');
            existing.unshift({
                id: savedSurvey.survey_id || Date.now(),
                title: surveyData.title,
                description: surveyData.description,
                status: 'active',
                createdAt: new Date().toISOString(),
                responses: 0,
                questionsCount: questions.length,
                questions
            });
            localStorage.setItem('userSurveys', JSON.stringify(existing));
            alert('Xuất bản khảo sát thành công!');
            navigate('/dashboard');
        } catch (error) {
            console.error('Error publishing survey:', error);
            alert('Có lỗi xảy ra khi xuất bản. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
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
                        <button className="btn-save" onClick={saveAsDraft} disabled={loading}>Lưu bản nháp</button>
                        <button className="btn-publish" onClick={publishSurvey} disabled={loading}>Lưu</button>
                    </div>
                </div>

                <div className="survey-editor">
                    {/* Sidebar trái có kéo thả */}
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

                    {/* Cột phải */}
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
        </>
    );
};

export default CreateSurvey;
