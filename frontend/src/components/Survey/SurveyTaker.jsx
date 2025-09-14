import React, { useState } from 'react';
import './SurveyTaker.css';

const SurveyTaker = ({ surveyData, questions = [], onSubmit, onClose }) => {
    const [answers, setAnswers] = useState({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAnswerChange = (questionId, value) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Validate required questions
            const requiredQuestions = questions.filter(q => q.is_required !== false);
            const missingAnswers = requiredQuestions.filter(q => !answers[q.id]);

            if (missingAnswers.length > 0) {
                alert(`Vui lòng trả lời tất cả câu hỏi bắt buộc (${missingAnswers.length} câu hỏi còn thiếu)`);
                setIsSubmitting(false);
                return;
            }

            const responseData = {
                survey_id: surveyData.id,
                answers: answers,
                submitted_at: new Date().toISOString()
            };

            if (onSubmit) {
                await onSubmit(responseData);
            } else {
                console.log('Survey response:', responseData);
                alert('Cảm ơn bạn đã tham gia khảo sát!');
                onClose();
            }
        } catch (error) {
            console.error('Error submitting survey:', error);
            alert('Có lỗi xảy ra khi gửi khảo sát. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderQuestionInput = (question) => {
        const currentAnswer = answers[question.id] || '';

        switch (question.question_type) {
            case 'multiple_choice':
                return (
                    <div className="taker-options">
                        {question.options?.map((option, index) => (
                            <label key={index} className="taker-option">
                                <input
                                    type="radio"
                                    name={`question_${question.id}`}
                                    value={option.option_text}
                                    checked={currentAnswer === option.option_text}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    className="option-radio"
                                />
                                <span className="option-text">{option.option_text}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'open_ended':
                return (
                    <textarea
                        value={currentAnswer}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Nhập câu trả lời của bạn..."
                        rows={4}
                        className="taker-textarea"
                    />
                );

            case 'rating':
                return (
                    <div className="taker-rating">
                        <div className="rating-scale">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <label key={rating} className="rating-option">
                                    <input
                                        type="radio"
                                        name={`question_${question.id}`}
                                        value={rating}
                                        checked={currentAnswer === rating.toString()}
                                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                        className="rating-radio"
                                    />
                                    <div className="rating-content">
                                        <span className="star">⭐</span>
                                        <span className="rating-number">{rating}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="rating-labels">
                            <span className="rating-label">Rất không hài lòng</span>
                            <span className="rating-label">Rất hài lòng</span>
                        </div>
                    </div>
                );

            case 'boolean':
                return (
                    <div className="taker-boolean">
                        <label className="boolean-option">
                            <input
                                type="radio"
                                name={`question_${question.id}`}
                                value="yes"
                                checked={currentAnswer === 'yes'}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                className="boolean-radio"
                            />
                            <span className="boolean-text">✅ Có</span>
                        </label>
                        <label className="boolean-option">
                            <input
                                type="radio"
                                name={`question_${question.id}`}
                                value="no"
                                checked={currentAnswer === 'no'}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                className="boolean-radio"
                            />
                            <span className="boolean-text">❌ Không</span>
                        </label>
                    </div>
                );

            default:
                return <div className="unsupported-question">Loại câu hỏi không được hỗ trợ</div>;
        }
    };

    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    if (!currentQuestion) {
        return (
            <div className="survey-taker-overlay">
                <div className="survey-taker-modal">
                    <div className="taker-empty">
                        <div className="empty-icon">📝</div>
                        <h3>Khảo sát chưa có câu hỏi</h3>
                        <p>Không có câu hỏi nào để hiển thị</p>
                        <button className="btn-primary" onClick={onClose}>
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="survey-taker-overlay">
            <div className="survey-taker-modal">
                <div className="taker-header">
                    <div className="taker-title-section">
                        <h2 className="taker-survey-title">
                            {surveyData.title || 'Khảo sát chưa có tiêu đề'}
                        </h2>
                        {surveyData.description && (
                            <p className="taker-survey-description">
                                {surveyData.description}
                            </p>
                        )}
                    </div>
                    <button className="taker-close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="taker-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="progress-text">
                        Câu hỏi {currentQuestionIndex + 1} / {questions.length}
                    </div>
                </div>

                <div className="taker-content">
                    <div className="taker-question-card">
                        <div className="question-header">
                            <h3 className="question-text">
                                {currentQuestion.question_text || 'Câu hỏi chưa có nội dung'}
                            </h3>
                            {currentQuestion.is_required !== false && (
                                <span className="required-indicator">* Bắt buộc</span>
                            )}
                        </div>

                        <div className="question-input">
                            {renderQuestionInput(currentQuestion)}
                        </div>
                    </div>
                </div>

                <div className="taker-footer">
                    <div className="taker-navigation">
                        <button
                            className="btn-nav"
                            onClick={handlePrevious}
                            disabled={currentQuestionIndex === 0}
                        >
                            ← Trước
                        </button>

                        <div className="question-dots">
                            {questions.map((_, index) => (
                                <button
                                    key={index}
                                    className={`dot ${index === currentQuestionIndex ? 'active' : ''} ${answers[questions[index].id] ? 'answered' : ''
                                        }`}
                                    onClick={() => setCurrentQuestionIndex(index)}
                                    title={`Câu hỏi ${index + 1}`}
                                />
                            ))}
                        </div>

                        {currentQuestionIndex === questions.length - 1 ? (
                            <button
                                className="btn-submit"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? '⏳ Đang gửi...' : '✅ Gửi khảo sát'}
                            </button>
                        ) : (
                            <button
                                className="btn-nav"
                                onClick={handleNext}
                                disabled={currentQuestion.is_required !== false && !answers[currentQuestion.id]}
                            >
                                Sau →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SurveyTaker;
