import React, { useState } from 'react';
import './PreviewSurvey.css';

const PreviewSurvey = ({ surveyData, onPublish, onRefreshQuestion, onUpdateSurvey }) => {
    if (!surveyData) return null;

    const { title, description, questions, aiGenerated } = surveyData;
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [editingOption, setEditingOption] = useState(null);
    const [editData, setEditData] = useState({});

    const getQuestionTypeLabel = (type) => {
        const typeLabels = {
            'single_choice': 'Lựa chọn đơn',
            'multiple_choice': 'Lựa chọn nhiều',
            'text': 'Văn bản',
            'rating': 'Đánh giá',
            'date': 'Ngày tháng'
        };
        return typeLabels[type] || type;
    };

    const handleEditQuestion = (questionId, currentText) => {
        setEditingQuestion(questionId);
        setEditData({ ...editData, [`question_${questionId}`]: currentText });
    };

    const handleSaveQuestion = (questionId) => {
        const newText = editData[`question_${questionId}`];
        if (newText && newText.trim()) {
            const updatedQuestions = questions.map(q =>
                q.id === questionId ? { ...q, text: newText.trim() } : q
            );
            onUpdateSurvey({ ...surveyData, questions: updatedQuestions });
        }
        setEditingQuestion(null);
        setEditData({ ...editData, [`question_${questionId}`]: '' });
    };

    const handleEditOption = (questionId, optionId, currentText) => {
        setEditingOption(`${questionId}_${optionId}`);
        setEditData({ ...editData, [`option_${questionId}_${optionId}`]: currentText });
    };

    const handleSaveOption = (questionId, optionId) => {
        const newText = editData[`option_${questionId}_${optionId}`];
        if (newText && newText.trim()) {
            const updatedQuestions = questions.map(q => {
                if (q.id === questionId) {
                    const updatedOptions = q.options.map(opt =>
                        opt.id === optionId ? { ...opt, text: newText.trim() } : opt
                    );
                    return { ...q, options: updatedOptions };
                }
                return q;
            });
            onUpdateSurvey({ ...surveyData, questions: updatedQuestions });
        }
        setEditingOption(null);
        setEditData({ ...editData, [`option_${questionId}_${optionId}`]: '' });
    };

    const handleRefreshQuestion = async (questionId) => {
        if (onRefreshQuestion) {
            await onRefreshQuestion(questionId);
        }
    };

    const handleAddOption = (questionId) => {
        const question = questions.find(q => q.id === questionId);
        if (question && (question.type === 'single_choice' || question.type === 'multiple_choice')) {
            const newOptionId = Math.max(...question.options.map(o => o.id), 0) + 1;
            const newOption = { id: newOptionId, text: 'Lựa chọn mới' };

            const updatedQuestions = questions.map(q =>
                q.id === questionId ? { ...q, options: [...q.options, newOption] } : q
            );
            onUpdateSurvey({ ...surveyData, questions: updatedQuestions });
        }
    };

    const handleRemoveOption = (questionId, optionId) => {
        const updatedQuestions = questions.map(q => {
            if (q.id === questionId && q.options.length > 1) {
                return { ...q, options: q.options.filter(opt => opt.id !== optionId) };
            }
            return q;
        });
        onUpdateSurvey({ ...surveyData, questions: updatedQuestions });
    };

    const renderQuestion = (question, index) => {
        const isEditingQuestion = editingQuestion === question.id;

        return (
            <div key={question.id} className="preview-question">
                <div className="question-header">
                    <div className="question-title-section">
                        {isEditingQuestion ? (
                            <div className="edit-input-group">
                                <span className="question-number">Câu {index + 1}:</span>
                                <input
                                    type="text"
                                    value={editData[`question_${question.id}`] || question.text}
                                    onChange={(e) => setEditData({ ...editData, [`question_${question.id}`]: e.target.value })}
                                    className="edit-input"
                                    autoFocus
                                />
                                <div className="edit-actions">
                                    <button
                                        className="btn-save"
                                        onClick={() => handleSaveQuestion(question.id)}
                                        title="Lưu"
                                    >
                                        ✓
                                    </button>
                                    <button
                                        className="btn-cancel"
                                        onClick={() => setEditingQuestion(null)}
                                        title="Hủy"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <h4 className="question-title">
                                Câu {index + 1}: {question.text}
                                {question.required && <span className="required-asterisk"> *</span>}
                            </h4>
                        )}
                    </div>

                    <div className="question-controls">
                        <span className="question-type-badge">
                            {getQuestionTypeLabel(question.type)}
                        </span>

                        {!isEditingQuestion && (
                            <div className="question-actions">
                                <button
                                    className="btn-edit"
                                    onClick={() => handleEditQuestion(question.id, question.text)}
                                    title="Chỉnh sửa câu hỏi"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="btn-refresh"
                                    onClick={() => handleRefreshQuestion(question.id)}
                                    title="Sinh câu hỏi mới bằng AI"
                                >
                                    🔄
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {question.options && question.options.length > 0 && (
                    <div className="question-options">
                        {question.options.map((option) => {
                            const isEditingOption = editingOption === `${question.id}_${option.id}`;

                            return (
                                <div key={option.id} className="option-item">
                                    {question.type === 'single_choice' ? (
                                        <input type="radio" name={`question_${question.id}`} disabled />
                                    ) : question.type === 'multiple_choice' ? (
                                        <input type="checkbox" disabled />
                                    ) : null}

                                    {isEditingOption ? (
                                        <div className="edit-option-group">
                                            <input
                                                type="text"
                                                value={editData[`option_${question.id}_${option.id}`] || option.text}
                                                onChange={(e) => setEditData({ ...editData, [`option_${question.id}_${option.id}`]: e.target.value })}
                                                className="edit-input"
                                                autoFocus
                                            />
                                            <div className="edit-actions">
                                                <button
                                                    className="btn-save"
                                                    onClick={() => handleSaveOption(question.id, option.id)}
                                                    title="Lưu"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    className="btn-cancel"
                                                    onClick={() => setEditingOption(null)}
                                                    title="Hủy"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="option-content">
                                            <span className="option-text">{option.text}</span>
                                            <div className="option-actions">
                                                <button
                                                    className="btn-edit-small"
                                                    onClick={() => handleEditOption(question.id, option.id, option.text)}
                                                    title="Chỉnh sửa"
                                                >
                                                    ✏️
                                                </button>
                                                {question.options.length > 1 && (
                                                    <button
                                                        className="btn-delete-small"
                                                        onClick={() => handleRemoveOption(question.id, option.id)}
                                                        title="Xóa"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
                            <button
                                className="btn-add-option"
                                onClick={() => handleAddOption(question.id)}
                                title="Thêm lựa chọn"
                            >
                                + Thêm lựa chọn
                            </button>
                        )}
                    </div>
                )}

                {question.type === 'text' && (
                    <div className="text-input-preview">
                        <textarea
                            placeholder="Nhập câu trả lời của bạn..."
                            disabled
                            rows="3"
                        />
                    </div>
                )}

                {question.type === 'rating' && (
                    <div className="rating-preview">
                        <div className="rating-scale">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className="rating-star">⭐</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="preview-survey-container">
            <div className="preview-header">
                <div className="preview-title-section">
                    <h2 className="preview-title">{title}</h2>
                    {aiGenerated && (
                        <span className="ai-generated-badge">
                            🤖 Form được tạo bởi AI
                        </span>
                    )}
                </div>
                {description && (
                    <p className="preview-description">{description}</p>
                )}
            </div>

            <div className="preview-content">
                <div className="preview-questions">
                    <h3 className="questions-section-title">
                        Câu hỏi ({questions?.length || 0})
                    </h3>
                    {questions?.map((question, index) => renderQuestion(question, index))}
                </div>
            </div>

            <div className="preview-actions">
                <button className="btn-primary" onClick={onPublish}>
                    🚀 Publish khảo sát
                </button>
            </div>
        </div>
    );
};

export default PreviewSurvey;
