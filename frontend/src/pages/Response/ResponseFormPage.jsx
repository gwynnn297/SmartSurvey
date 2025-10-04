import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from '../../layouts/MainLayout';
import "./ResponseFormPage.css";
import { responseService } from '../../services/responseService';

const ResponseFormPage = ({ survey, mode = 'respondent', isView: isViewProp }) => {
  const navigate = useNavigate();
  const [responses, setResponses] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const isView = typeof isViewProp === 'boolean' ? isViewProp : mode === 'view';
  const isPreview = survey?.id === 'ai-preview' || survey?.id === 'preview';

  // Handle input change
  const handleChange = (questionId, value, multiple = false) => {
    setResponses((prev) => {
      if (multiple) {
        const current = prev[questionId] || [];
        return {
          ...prev,
          [questionId]: current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value],
        };
      }
      return { ...prev, [questionId]: value };
    });
  };

  // Validate required questions
  const validateForm = () => {
    const newErrors = {};
    survey.questions.forEach((q) => {
      if (q.is_required) {
        if (
          !responses[q.id] ||
          (Array.isArray(responses[q.id]) && responses[q.id].length === 0) ||
          (typeof responses[q.id] === "string" && responses[q.id].trim() === "")
        ) {
          newErrors[q.id] = "Câu hỏi này là bắt buộc";
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isCreator = user?.role === 'creator';
    setLoading(true);

    try {
      if (isCreator) {
        // 👉 Người tạo survey: chỉ xem thử, không gọi API
        await new Promise((res) => setTimeout(res, 1000)); // fake loading
        setSuccess(true);
      } else {
        // 👉 Người tham gia thực sự: gọi API thật
        const apiResult = await responseService.submitResponses(
          survey.id,
          responses,
          survey
        );
        console.log("Submitting response result:", apiResult);
        setSuccess(true);
      }
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Render question
  const renderQuestion = (q) => {
    switch (q.type) {
      case "multiple-choice-single":
        return q.options.map((opt, i) => (
          <label key={i} className="option-label">
            <input
              type="radio"
              name={`question_${q.id}`}
              value={opt}
              checked={responses[q.id] === opt}
              onChange={() => handleChange(q.id, opt)}
            />
            <span>{opt}</span>
          </label>
        ));

      case "multiple-choice-multiple":
        return q.options.map((opt, i) => (
          <label key={i} className="option-label">
            <input
              type="checkbox"
              name={`question_${q.id}`}
              value={opt}
              checked={responses[q.id]?.includes(opt) || false}
              onChange={() => handleChange(q.id, opt, true)}
            />
            <span>{opt}</span>
          </label>
        ));

      case "open-text":
        return (
          <textarea
            rows="4"
            placeholder="Nhập câu trả lời..."
            value={responses[q.id] || ""}
            onChange={(e) => handleChange(q.id, e.target.value)}
          />
        );

      case "rating-scale":
        return (
          <div className="rating-scale">
            {q.scale.map((num) => (
              <label key={num} className="rating-circle">
                <input
                  type="radio"
                  name={`question_${q.id}`}
                  value={num}
                  checked={responses[q.id] === num.toString()}
                  onChange={() => handleChange(q.id, num.toString())}
                />
                <div>{num}</div>
              </label>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="response-container">
        <div className="survey-card">
          {!success ? (
            <form onSubmit={handleSubmit}>
              <div className="survey-header">
                {isPreview && (
                  <div className="preview-header">
                    <button
                      type="button"
                      className="btn-close-preview"
                      onClick={() => navigate('/create-ai')}
                      title="Quay lại chỉnh sửa"
                    >
                      <i className="fa-solid fa-arrow-left"></i>
                      Quay lại chỉnh sửa
                    </button>
                    <div className="preview-badge">
                      <i className="fa-regular fa-eye"></i>
                      Xem trước
                    </div>
                  </div>
                )}
                <h1>{survey.title}</h1>
                <p>{survey.description}</p>
              </div>

              {survey.questions.map((q, index) => (
                <div
                  key={q.id}
                  className={`question-card ${errors[q.id] ? "error" : ""
                    }`}
                >
                  <h3>
                    <span className="question-number">Câu {index + 1}:</span> {q.text}{" "}
                    {q.is_required && <span className="required">*</span>}
                  </h3>
                  {renderQuestion(q)}
                  {errors[q.id] && (
                    <p className="error-message">{errors[q.id]}</p>
                  )}
                </div>
              ))}

              <div className="form-footer">
                <button type="submit" disabled={loading}>
                  {loading ? "Đang gửi..." : "Gửi phản hồi"}
                </button>
                <p className="note">
                  Phản hồi của bạn sẽ được bảo mật và chỉ dùng để cải thiện dịch vụ
                </p>
              </div>
            </form>
          ) : (
            <div className="success-modal">
              <div className="checkmark">✔</div>
              <h2>Cảm ơn bạn đã hoàn thành khảo sát!</h2>
              <p>Phản hồi của bạn đã được ghi lại thành công.</p>
              <button onClick={() => setSuccess(false)}>Đóng</button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ResponseFormPage;
