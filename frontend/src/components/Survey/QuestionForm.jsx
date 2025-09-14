import React from 'react';
import OptionList from './OptionList';
import './QuestionForm.css';

const QuestionForm = ({ question, onChange, onDelete }) => {
    const handleQuestionTextChange = (e) => {
        onChange({
            ...question,
            question_text: e.target.value
        });
    };

    const handleQuestionTypeChange = (e) => {
        const newQuestionType = e.target.value;
        onChange({
            ...question,
            question_type: newQuestionType,
            // Reset options khi chuyển từ multiple_choice sang loại khác
            options: newQuestionType === 'multiple_choice'
                ? (question.options || [{ option_text: '' }, { option_text: '' }])
                : []
        });
    };

    const handleOptionsChange = (newOptions) => {
        onChange({
            ...question,
            options: newOptions
        });
    };

    const handleRequiredChange = (e) => {
        onChange({
            ...question,
            is_required: e.target.checked
        });
    };

    return (
        <div className="question-form">
            <div className="form-group">
                <label className="form-label">
                    📝 Nội dung câu hỏi *
                </label>
                <textarea
                    value={question.question_text || ''}
                    onChange={handleQuestionTextChange}
                    placeholder="Nhập nội dung câu hỏi của bạn (bắt buộc)..."
                    rows={3}
                    className="form-input form-textarea question-textarea"
                    required
                />
            </div>

            <div className="form-group">
                <label className="form-label">
                    🎯 Loại câu hỏi *
                </label>
                <select
                    value={question.question_type || 'multiple_choice'}
                    onChange={handleQuestionTypeChange}
                    className="form-input form-select question-type-select"
                >
                    <option value="multiple_choice">🔘 Trắc nghiệm</option>
                    <option value="open_ended">📝 Tự luận</option>
                    <option value="rating">⭐ Đánh giá (1-5)</option>
                    <option value="boolean">✅ Có/Không</option>
                </select>
            </div>

            {/* Hiển thị options nếu là multiple_choice */}
            {question.question_type === 'multiple_choice' && (
                <div className="options-section">
                    <OptionList
                        options={question.options || [{ option_text: '' }, { option_text: '' }]}
                        onChangeOptions={handleOptionsChange}
                    />
                </div>
            )}

            {/* Có bắt buộc trả lời */}
            <div className="checkbox-container">
                <input
                    type="checkbox"
                    id={`required-${question.id || Math.random()}`}
                    checked={question.is_required !== false}
                    onChange={handleRequiredChange}
                    className="custom-checkbox"
                />
                <label htmlFor={`required-${question.id || Math.random()}`} className="checkbox-label">
                    Bắt buộc trả lời câu hỏi này
                </label>
            </div>

            {/* Nút xóa câu hỏi */}
            <div className="delete-section">
                <button
                    type="button"
                    onClick={onDelete}
                    className="btn-delete"
                >
                    Xóa câu hỏi
                </button>
            </div>
        </div>
    );
};

export default QuestionForm;
