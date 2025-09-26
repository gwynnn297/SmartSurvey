import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderComponent from "../../components/HeaderComponent";
import { surveyService } from '../../services/surveyService';
import { aiSurveyApi } from '../../api/aiSurveyApi';
import MainLayout from '../../layouts/MainLayout';
import './CreateAI.css';

export default function CreateAI() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: '',
        category_id: '',
        short_description: '',
        deadline_date: '',
        deadline_time: '',
        ai_context: ''
    });

    const [errors, setErrors] = useState({});
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [aiResult, setAiResult] = useState(null);

    // AI Processing states
    const [showProcessingModal, setShowProcessingModal] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                setCategoriesLoading(true);
                const res = await surveyService.getCategories();

                // Handle different response structures
                let categoriesList = [];
                if (Array.isArray(res)) {
                    categoriesList = res;
                } else if (res?.data && Array.isArray(res.data)) {
                    categoriesList = res.data;
                } else if (res?.result && Array.isArray(res.result)) {
                    categoriesList = res.result;
                } else {
                    categoriesList = [];
                }

                setCategories(categoriesList);
            } catch (e) {
                console.error('Error loading categories:', e);
                // Fallback categories if API fails
                const fallbackCategories = [
                    { id: 1, name: 'Khách hàng' },
                    { id: 2, name: 'Nhân viên' },
                    { id: 3, name: 'Sản phẩm' },
                    { id: 4, name: 'Dịch vụ' }
                ];
                setCategories(fallbackCategories);
            } finally {
                setCategoriesLoading(false);
            }
        })();
    }, []);


    const steps = useMemo(() => ([
        { key: 1, label: 'Nhập ngữ cảnh' },
        { key: 2, label: 'AI tạo câu hỏi' },
        { key: 3, label: 'Chỉnh sửa khảo sát' }
    ]), []);

    // AI Processing steps
    const aiSteps = useMemo(() => ([
        { key: 1, label: 'Phân tích ngữ cảnh và mục tiêu khảo sát', completed: false },
        { key: 2, label: 'Tạo bộ câu hỏi phù hợp', completed: false },
        { key: 3, label: 'Tối ưu hóa thứ tự và logic câu hỏi', completed: false },
        { key: 4, label: 'Hoàn thiện và chuẩn bị giao diện chỉnh sửa', completed: false }
    ]), []);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const validate = () => {
        const newErrors = {};
        if (!form.title.trim()) newErrors.title = 'Vui lòng nhập tiêu đề';
        if (!form.category_id) newErrors.category_id = 'Vui lòng chọn chủ đề';
        if (!form.ai_context.trim()) newErrors.ai_context = 'Vui lòng nhập ngữ cảnh chi tiết';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Simulate AI processing with animated steps
    const simulateAIProcessing = async () => {
        setCurrentStep(0);
        setProgress(0);

        for (let i = 0; i < aiSteps.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second per step
            setCurrentStep(i + 1);
            setProgress(((i + 1) / aiSteps.length) * 100);
        }
    };

    const onSubmit = async () => {
        if (!validate()) return;

        // Show processing modal
        setShowProcessingModal(true);
        setLoading(true);

        try {
            // Start AI processing simulation
            await simulateAIProcessing();

            // Send data to backend
            const payload = {
                title: form.title,
                description: form.short_description,
                category: form.category_id,
                ai_prompt: form.ai_context
            };

            console.log('🚀 Sending AI survey data to backend:', payload);
            const result = await aiSurveyApi.generateSurvey(payload);
            setAiResult(result);

            // Navigate to survey editor after completion
            setTimeout(() => {
                navigate('/create-survey', {
                    state: {
                        aiGeneratedData: result,
                        surveyInfo: {
                            title: form.title,
                            description: form.short_description,
                            category: form.category_id
                        }
                    }
                });
            }, 2000);

        } catch (e) {
            console.error('❌ AI generation error:', e);
            alert('Không thể tạo gợi ý. Vui lòng thử lại.');
            setShowProcessingModal(false);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelProcessing = () => {
        setShowProcessingModal(false);
        setCurrentStep(0);
        setProgress(0);
    };

    return (
        <>
            <MainLayout>


                <div className="ai-container">
                    <div className="ai-steps">
                        {steps.map((s, idx) => (
                            <div key={s.key} className={`ai-step ${idx === 0 ? 'active' : ''}`}>
                                <span className="ai-step-index">{idx + 1}</span>
                                <span className="ai-step-label">{s.label}</span>
                            </div>
                        ))}
                    </div>

                    <h2 className="ai-title">Tạo khảo sát thông minh với AI</h2>
                    <p className="ai-subtitle">Cung cấp thông tin để AI tạo bộ câu hỏi phù hợp.</p>

                    <div className="ai-form-card">
                        <div className="ai-form-row">
                            <label>Tiêu đề khảo sát <span className="req">*</span></label>
                            <input
                                value={form.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                placeholder="Nhập tiêu đề khảo sát"
                            />
                            {errors.title && <div className="ai-error">{errors.title}</div>}
                        </div>
                        <div className="ai-form-row">
                            <label>Mô tả ngắn</label>
                            <input
                                value={form.short_description}
                                onChange={(e) => handleChange('short_description', e.target.value)}
                                placeholder="Mô tả ngắn gọn về mục đích khảo sát"
                            />
                        </div>
                        <div className="ai-form-row">
                            <label>Chủ đề khảo sát <span className="req">*</span></label>
                            <select
                                value={form.category_id}
                                onChange={(e) => handleChange('category_id', e.target.value)}
                                className={errors.category_id ? 'error' : ''}
                                disabled={categoriesLoading}
                            >
                                <option value="">
                                    {categoriesLoading ? 'Đang tải chủ đề...' : 'Chọn chủ đề…'}
                                </option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            {errors.category_id && <div className="ai-error">{errors.category_id}</div>}
                        </div>



                        {/* <div className="ai-form-grid">
                        <div className="ai-form-row">
                            <label>Hết hạn</label>
                            <input type="date" value={form.deadline_date} onChange={(e) => handleChange('deadline_date', e.target.value)} />
                        </div>
                        <div className="ai-form-row">
                            <label>&nbsp;</label>
                            <input type="time" value={form.deadline_time} onChange={(e) => handleChange('deadline_time', e.target.value)} />
                        </div>
                    </div> */}

                        <div className="ai-form-row">
                            <label>Ngữ cảnh chi tiết cho AI <span className="req">*</span></label>
                            <textarea
                                rows={8}
                                value={form.ai_context}
                                onChange={(e) => handleChange('ai_context', e.target.value)}
                                placeholder={`Hãy mô tả chi tiết:\n- Mục tiêu khảo sát\n- Đối tượng tham gia\n- Thông tin cần thu thập\n- Bối cảnh cụ thể`}
                            />
                            {errors.ai_context && <div className="ai-error">{errors.ai_context}</div>}
                        </div>

                        <div className="ai-actions">
                            <button className="btn-primary" onClick={onSubmit} disabled={loading}>
                                {loading ? 'Đang tạo gợi ý…' : 'Tạo gợi ý bằng AI'}
                            </button>
                        </div>
                    </div>

                    {aiResult && (
                        <div className="ai-result-card">
                            <h3>Kết quả gợi ý</h3>
                            <pre className="ai-result-pre">{JSON.stringify(aiResult, null, 2)}</pre>
                        </div>
                    )}
                </div>

                {/* AI Processing Modal */}
                {showProcessingModal && (
                    <div className="ai-processing-modal">
                        <div className="ai-processing-content">
                            {/* Header with AI icon and title */}
                            <div className="ai-processing-header">
                                <div className="ai-icon">💡</div>
                                <h2>AI đang phân tích và tạo câu hỏi</h2>
                                <p>Đang tạo câu hỏi phù hợp</p>
                            </div>

                            {/* Progress bar */}
                            <div className="ai-progress-container">
                                <div className="ai-progress-bar">
                                    <div
                                        className="ai-progress-fill"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                                <span className="ai-progress-text">{Math.round(progress)}% hoàn thành</span>
                            </div>

                            {/* Survey Information */}
                            <div className="ai-survey-info">
                                <h3>Thông tin khảo sát của bạn:</h3>
                                <div className="ai-survey-details">
                                    <div className="ai-survey-item">
                                        <strong>Tiêu đề:</strong> {form.title}
                                    </div>
                                    <div className="ai-survey-item">
                                        <strong>Chủ đề:</strong> {categories.find(c => c.id == form.category_id)?.name || 'Không xác định'}
                                    </div>
                                    <div className="ai-survey-item">
                                        <strong>Mô tả:</strong> {form.short_description || 'Không có mô tả'}
                                    </div>
                                </div>
                            </div>

                            {/* AI Processing Steps */}
                            <div className="ai-processing-steps">
                                <h3>AI đang thực hiện:</h3>
                                <div className="ai-steps-list">
                                    {aiSteps.map((step, index) => (
                                        <div
                                            key={step.key}
                                            className={`ai-step-item ${currentStep > index ? 'completed' : currentStep === index + 1 ? 'active' : ''}`}
                                        >
                                            <div className="ai-step-icon">
                                                {currentStep > index ? '✅' : currentStep === index + 1 ? '🔄' : (index + 1)}
                                            </div>
                                            <span className="ai-step-label">{step.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cancel button */}
                            <div className="ai-processing-actions">
                                <button
                                    className="ai-cancel-btn"
                                    onClick={handleCancelProcessing}
                                >
                                    Hủy bỏ và quay lại
                                </button>
                            </div>

                            {/* Helpful tips */}
                            <div className="ai-tips">
                                <div className="ai-tips-header">
                                    <span className="ai-tips-icon">💡</span>
                                    <strong>Mẹo hữu ích</strong>
                                </div>
                                <p>Sau khi AI hoàn thành, bạn sẽ có thể:</p>
                                <ul className="ai-tips-list">
                                    <li>Chỉnh sửa nội dung từng câu hỏi</li>
                                    <li>Thay đổi loại câu hỏi (trắc nghiệm, tự luận, v.v.)</li>
                                    <li>Thêm, xóa hoặc sắp xếp lại câu hỏi</li>
                                    <li>Tùy chỉnh các lựa chọn trả lời</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </MainLayout>
        </>
    );
}