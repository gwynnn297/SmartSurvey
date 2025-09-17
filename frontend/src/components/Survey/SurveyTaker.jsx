import React, { useState } from 'react';

const SurveyTaker = ({ surveyData, questions = [], onSubmit, onClose }) => {
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const payload = {
                surveyId: surveyData?.id || surveyData?.survey_id,
                answers: Object.entries(answers).map(([questionId, value]) => ({
                    questionId,
                    value
                }))
            };
            await onSubmit?.(payload);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="survey-viewer-overlay" onClick={onClose}>
            <div className="survey-viewer-modal" onClick={(e) => e.stopPropagation()}>
                <div className="viewer-header">
                    <div className="viewer-title-section">
                        <h2 className="viewer-survey-title">
                            {surveyData?.title || 'Làm khảo sát'}
                        </h2>
                        {surveyData?.description && (
                            <p className="viewer-survey-description">{surveyData.description}</p>
                        )}
                        <div className="viewer-meta">
                            <span>📊 {questions.length} câu hỏi</span>
                        </div>
                    </div>
                    <div className="viewer-header-actions">
                        <button className="viewer-close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="viewer-content">
                    {questions.length === 0 ? (
                        <div className="viewer-empty">
                            <div className="empty-icon">📝</div>
                            <h3>Chưa có câu hỏi nào</h3>
                        </div>
                    ) : (
                        <div className="viewer-questions">
                            {questions.map((q, idx) => (
                                <div key={q.id || idx} className="viewer-question-item">
                                    <div className="question-number">{idx + 1}</div>
                                    <div className="question-content display-mode">
                                        <div className="question-header">
                                            <h3 className="question-text">{q.question_text || 'Câu hỏi'}</h3>
                                            <div className="question-meta">
                                                {q.is_required && <span className="required-badge">* Bắt buộc</span>}
                                            </div>
                                        </div>

                                        <div className="question-input">
                                            {q.question_type === 'multiple_choice' && (
                                                <div className="viewer-options">
                                                    {(q.options || []).map((opt, oIdx) => (
                                                        <label key={oIdx} className="viewer-option">
                                                            <input
                                                                type="radio"
                                                                name={`q_${q.id}`}
                                                                value={opt.option_text}
                                                                checked={answers[q.id] === opt.option_text}
                                                                onChange={(e) => handleChange(q.id, e.target.value)}
                                                            />
                                                            <span className="option-text">{opt.option_text || `Lựa chọn ${oIdx + 1}`}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            {q.question_type === 'open_ended' && (
                                                <textarea
                                                    rows={4}
                                                    className="viewer-textarea"
                                                    value={answers[q.id] || ''}
                                                    onChange={(e) => handleChange(q.id, e.target.value)}
                                                />
                                            )}

                                            {q.question_type === 'rating' && (
                                                <div className="viewer-rating">
                                                    <div className="rating-scale">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <label key={star} className="rating-option">
                                                                <input
                                                                    type="radio"
                                                                    name={`q_${q.id}`}
                                                                    value={star}
                                                                    checked={String(answers[q.id]) === String(star)}
                                                                    onChange={(e) => handleChange(q.id, e.target.value)}
                                                                />
                                                                <span className="star">⭐</span>
                                                                <span className="rating-number">{star}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {q.question_type === 'boolean' && (
                                                <div className="viewer-boolean">
                                                    <label className="boolean-option">
                                                        <input
                                                            type="radio"
                                                            name={`q_${q.id}`}
                                                            value="yes"
                                                            checked={answers[q.id] === 'yes'}
                                                            onChange={(e) => handleChange(q.id, e.target.value)}
                                                        />
                                                        <span>✅ Có</span>
                                                    </label>
                                                    <label className="boolean-option">
                                                        <input
                                                            type="radio"
                                                            name={`q_${q.id}`}
                                                            value="no"
                                                            checked={answers[q.id] === 'no'}
                                                            onChange={(e) => handleChange(q.id, e.target.value)}
                                                        />
                                                        <span>❌ Không</span>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="viewer-footer">
                        <div className="viewer-actions">
                            <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
                            <button type="submit" className="btn-primary" disabled={submitting}>
                                {submitting ? '⏳ Đang gửi...' : 'Gửi khảo sát'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SurveyTaker;


