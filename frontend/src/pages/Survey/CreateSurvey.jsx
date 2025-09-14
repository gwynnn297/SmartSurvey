import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import QuestionList from '../../components/Survey/QuestionList';
import PreviewSurvey from '../../components/Survey/PreviewSurvey';
import { surveyService } from '../../services/surveyService';
import './CreateSurvey.css';

const CreateSurvey = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [showPreview, setShowPreview] = useState(false);

    // Survey form data
    const [surveyData, setSurveyData] = useState({
        title: '',
        description: '',
        category_id: '',
        status: 'draft'
    });

    // Questions data
    const [questions, setQuestions] = useState([]);

    // Form errors
    const [errors, setErrors] = useState({});

    // Load categories on component mount
    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const response = await surveyService.getCategories();
            setCategories(response.data || response || []);
        } catch (error) {
            console.error('Error loading categories:', error);
            // Mock categories nếu API chưa có
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
        setSurveyData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
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

        // Validate each question
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
            const surveyPayload = {
                ...surveyData,
                status: 'draft'
            };

            const savedSurvey = await surveyService.createSurvey(surveyPayload);

            // Save questions if any
            if (questions.length > 0 && savedSurvey.survey_id) {
                for (const question of questions) {
                    await surveyService.addQuestion(savedSurvey.survey_id, {
                        question_text: question.question_text,
                        question_type: question.question_type,
                        is_required: question.is_required
                    });
                }
            }

            // Lưu khảo sát vào localStorage để hiển thị trong dashboard
            const existingSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
            const newSurvey = {
                id: savedSurvey.survey_id || Date.now(),
                title: surveyData.title,
                description: surveyData.description,
                status: 'draft',
                createdAt: new Date().toISOString(),
                responses: 0,
                questionsCount: questions.length,
                questions: questions // Lưu câu hỏi thực sự
            };
            existingSurveys.unshift(newSurvey);
            localStorage.setItem('userSurveys', JSON.stringify(existingSurveys));

            alert('Lưu nháp thành công!');
            navigate('/dashboard');
        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Có lỗi xảy ra khi lưu nháp. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const previewSurvey = () => {
        if (!validateForm()) return;
        setShowPreview(true);
    };

    const publishSurvey = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const surveyPayload = {
                ...surveyData,
                status: 'active'
            };

            const savedSurvey = await surveyService.createSurvey(surveyPayload);

            // Save questions if any
            if (questions.length > 0 && savedSurvey.survey_id) {
                for (const question of questions) {
                    await surveyService.addQuestion(savedSurvey.survey_id, {
                        question_text: question.question_text,
                        question_type: question.question_type,
                        is_required: question.is_required
                    });
                }
            }

            // Lưu khảo sát vào localStorage để hiển thị trong dashboard
            const existingSurveys = JSON.parse(localStorage.getItem('userSurveys') || '[]');
            const newSurvey = {
                id: savedSurvey.survey_id || Date.now(),
                title: surveyData.title,
                description: surveyData.description,
                status: 'active',
                createdAt: new Date().toISOString(),
                responses: 0,
                questionsCount: questions.length,
                questions: questions // Lưu câu hỏi thực sự
            };
            existingSurveys.unshift(newSurvey);
            localStorage.setItem('userSurveys', JSON.stringify(existingSurveys));

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
        <div className="create-survey-container">
            <MainLayout>
                <div className="max-w-5xl mx-auto">
                    <div className="survey-header fade-in">
                        <h1>Tạo khảo sát thủ công</h1>
                        <p>Tạo khảo sát chi tiết với các câu hỏi tùy chỉnh</p>
                    </div>

                    <div className="survey-form-container slide-up">
                        {/* Survey Information Form */}
                        <div className="form-section">
                            <h2 className="section-title">📋 Thông tin khảo sát</h2>

                            <div className="form-group">
                                <label className="form-label">
                                    Tiêu đề khảo sát *
                                </label>
                                <input
                                    type="text"
                                    value={surveyData.title}
                                    onChange={(e) => handleSurveyDataChange('title', e.target.value)}
                                    placeholder="Nhập tiêu đề khảo sát..."
                                    className={`form-input ${errors.title ? 'error' : ''}`}
                                />
                                {errors.title && (
                                    <div className="error-message">{errors.title}</div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Mô tả khảo sát
                                </label>
                                <textarea
                                    value={surveyData.description}
                                    onChange={(e) => handleSurveyDataChange('description', e.target.value)}
                                    placeholder="Nhập mô tả khảo sát..."
                                    rows={4}
                                    className="form-input form-textarea"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Danh mục
                                </label>
                                <select
                                    value={surveyData.category_id}
                                    onChange={(e) => handleSurveyDataChange('category_id', e.target.value)}
                                    className="form-input form-select"
                                >
                                    <option value="">Chọn danh mục...</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Questions Section */}
                        <div className="questions-section">
                            <div className="questions-header">
                                <div className="questions-title">
                                    📝 Danh sách câu hỏi
                                    <span className="questions-count">{questions.length} câu hỏi</span>
                                </div>
                                <div className="questions-subtitle">
                                    💡 <strong>Tạo câu hỏi thủ công:</strong> Bạn sẽ nhập từng câu hỏi và câu trả lời một cách thủ công. Không có câu hỏi tự động.
                                </div>
                            </div>

                            <QuestionList
                                questions={questions}
                                onChangeQuestions={setQuestions}
                            />

                            {errors.questions && (
                                <div className="error-message">{errors.questions}</div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="action-buttons">
                            <div className="action-buttons-left">
                                <button
                                    type="button"
                                    onClick={() => navigate('/dashboard')}
                                    className="btn btn-cancel"
                                >
                                    <span>←</span> Hủy
                                </button>
                            </div>

                            <div className="action-buttons-right">
                                <button
                                    type="button"
                                    onClick={previewSurvey}
                                    disabled={loading}
                                    className="btn btn-preview"
                                >
                                    <span>👁️</span> Xem trước
                                </button>

                                <button
                                    type="button"
                                    onClick={saveAsDraft}
                                    disabled={loading}
                                    className={`btn btn-draft ${loading ? 'loading' : ''}`}
                                >
                                    <span>💾</span> {loading ? 'Đang lưu...' : 'Lưu nháp'}
                                </button>

                                <button
                                    type="button"
                                    onClick={publishSurvey}
                                    disabled={loading}
                                    className={`btn btn-publish ${loading ? 'loading' : ''}`}
                                >
                                    <span>🚀</span> {loading ? 'Đang xuất bản...' : 'Xuất bản'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </MainLayout>

            {/* Preview Modal */}
            {showPreview && (
                <PreviewSurvey
                    surveyData={surveyData}
                    questions={questions}
                    onClose={() => setShowPreview(false)}
                />
            )}
        </div>
    );
};

export default CreateSurvey;
