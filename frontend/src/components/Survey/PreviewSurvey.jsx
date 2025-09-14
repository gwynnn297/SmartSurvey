import React from 'react';
import './PreviewSurvey.css';

const PreviewSurvey = ({ surveyData, questions, onClose }) => {
    const renderQuestion = (question, index) => {
        return (
            <div key={question.id || index} className="preview-question">
                <div className="preview-question-header">
                    <span className="question-number">{index + 1}</span>
                    <span className="question-type-badge">
                        {question.question_type === 'multiple_choice' && '🔘 Trắc nghiệm'}
                        {question.question_type === 'open_ended' && '📝 Tự luận'}
                        {question.question_type === 'rating' && '⭐ Đánh giá'}
                        {question.question_type === 'boolean' && '✅ Có/Không'}
                    </span>
                </div>

                <h3 className="preview-question-text">
                    {question.question_text || 'Câu hỏi chưa có nội dung'}
                </h3>

                {question.is_required && (
                    <span className="required-badge">* Bắt buộc</span>
                )}

                <div className="preview-question-input">
                    {renderQuestionInput(question)}
                </div>
            </div>
        );
    };

    const renderQuestionInput = (question) => {
        switch (question.question_type) {
            case 'multiple_choice':
                return (
                    <div className="preview-options">
                        {question.options?.map((option, index) => (
                            <label key={index} className="preview-option">
                                <input type="radio" name={`question_${question.id}`} disabled />
                                <span className="option-text">
                                    {option.option_text || `Lựa chọn ${index + 1}`}
                                </span>
                            </label>
                        )) || (
                                <div className="preview-placeholder">
                                    Chưa có lựa chọn nào
                                </div>
                            )}
                    </div>
                );

            case 'open_ended':
                return (
                    <textarea
                        placeholder="Nhập câu trả lời của bạn..."
                        disabled
                        rows={4}
                        className="preview-textarea"
                    />
                );

            case 'rating':
                return (
                    <div className="preview-rating">
                        <div className="rating-scale">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <label key={star} className="rating-option">
                                    <input type="radio" name={`rating_${question.id}`} disabled />
                                    <span className="star">⭐</span>
                                    <span className="rating-number">{star}</span>
                                </label>
                            ))}
                        </div>
                        <div className="rating-labels">
                            <span>Rất không hài lòng</span>
                            <span>Rất hài lòng</span>
                        </div>
                    </div>
                );

            case 'boolean':
                return (
                    <div className="preview-boolean">
                        <label className="boolean-option">
                            <input type="radio" name={`boolean_${question.id}`} disabled />
                            <span>✅ Có</span>
                        </label>
                        <label className="boolean-option">
                            <input type="radio" name={`boolean_${question.id}`} disabled />
                            <span>❌ Không</span>
                        </label>
                    </div>
                );

            default:
                return <div className="preview-placeholder">Loại câu hỏi không được hỗ trợ</div>;
        }
    };

    return (
        <div className="preview-modal-overlay" onClick={onClose}>
            <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
                <div className="preview-header">
                    <div className="preview-title-section">
                        <h2 className="preview-survey-title">
                            {surveyData.title || 'Khảo sát chưa có tiêu đề'}
                        </h2>
                        {surveyData.description && (
                            <p className="preview-survey-description">
                                {surveyData.description}
                            </p>
                        )}
                        <div className="preview-meta">
                            <span>📊 {questions.length} câu hỏi</span>
                            <span>•</span>
                            <span>⏱️ Dự kiến hoàn thành: {Math.ceil(questions.length * 0.5)} phút</span>
                        </div>
                    </div>
                    <button className="preview-close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="preview-content">
                    {questions.length === 0 ? (
                        <div className="preview-empty">
                            <div className="empty-icon">📝</div>
                            <h3>Chưa có câu hỏi nào</h3>
                            <p>Thêm câu hỏi để xem trước khảo sát</p>
                        </div>
                    ) : (
                        <div className="preview-questions">
                            {questions.map((question, index) => renderQuestion(question, index))}
                        </div>
                    )}
                </div>

                <div className="preview-footer">
                    <div className="preview-actions">
                        <button className="btn-secondary" onClick={onClose}>
                            Đóng
                        </button>
                        <button className="btn-primary" disabled>
                            Gửi khảo sát (Chế độ xem trước)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviewSurvey;
