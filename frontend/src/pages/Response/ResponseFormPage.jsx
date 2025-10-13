import React, { useState } from "react";
import MainLayout from '../../layouts/MainLayout';
import "./ResponseFormPage.css";
import { responseService } from '../../services/responseService';
import logoSmartSurvey from '../../assets/logoSmartSurvey.png';

const ResponseFormPage = ({ survey, mode = 'respondent', isView: isViewProp }) => {
  const [responses, setResponses] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const isView = typeof isViewProp === 'boolean' ? isViewProp : mode === 'view';

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
    // Debug: Log question data to see what we're getting
    // console.log('Question data:', {
    //   id: q.id,
    //   type: q.type,
    //   choice_type: q.choice_type,
    //   options: q.options
    // });

    switch (q.type) {
      case "multiple-choice-single":
        // Radio: chọn một
        return (q.options || []).map((opt, i) => (
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
        // Checkbox: chọn nhiều
        return (q.options || []).map((opt, i) => (
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
            {(q.scale || []).map((num) => (
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
        console.log('Unknown question type:', q.type);
        return <div>Unknown question type: {q.type}</div>;
    }
  };

  return (
    <MainLayout>
      <div className="response-container" style={{ background: "radial-gradient(130% 140% at 10% 10%, rgba(59, 130, 246, 0.32), transparent 55%), radial-gradient(120% 120% at 90% 20%, rgba(139, 92, 246, 0.35), transparent 45%), linear-gradient(135deg, #eef2ff 0%, #f8fafc 40%, #eef2ff 100%)" }}>
        <div className="survey-card">
          {!success ? (
            <form onSubmit={handleSubmit}>
              <div className="survey-header">
              <img className="logo-smart-survey" src={logoSmartSurvey} alt="logoSmartSurvey" />
                <h1>{survey.title}</h1>
                <p>{survey.description}</p>
              </div>

              {survey.questions.map((q) => (
                <div
                  key={q.id}
                  className={`question-card ${errors[q.id] ? "error" : ""
                    }`}
                >
                  <h3>
                    {q.text}{" "}
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