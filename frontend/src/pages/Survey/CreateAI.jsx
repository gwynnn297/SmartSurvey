import React, { useEffect, useMemo, useState } from 'react';
import HeaderComponent from "../../components/HeaderComponent";
import { surveyService } from '../../services/surveyService';
import { aiSurveyApi } from '../../api/aiSurveyApi';
import './CreateAI.css';

export default function CreateAI() {
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
    const [aiResult, setAiResult] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await surveyService.getCategories();
                const list = res?.data || res || [];
                setCategories(list);
            } catch (e) {
                setCategories([
                    { id: 1, name: 'Khách hàng' },
                    { id: 2, name: 'Nhân viên' },
                    { id: 3, name: 'Sản phẩm' },
                    { id: 4, name: 'Dịch vụ' }
                ]);
            }
        })();
    }, []);

    const steps = useMemo(() => ([
        { key: 1, label: 'Nhập ngữ cảnh' },
        { key: 2, label: 'AI tạo câu hỏi' },
        { key: 3, label: 'Chỉnh sửa khảo sát' }
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

    const onSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = { ...form };
            const result = await aiSurveyApi.generateSurvey(payload);
            setAiResult(result);
        } catch (e) {
            alert('Không thể tạo gợi ý. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-ai-page">
            <HeaderComponent showUserInfo={true} />

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
                            placeholder="Ví dụ: Khảo sát Hài lòng Khách hàng Q4 2024"
                        />
                        {errors.title && <div className="ai-error">{errors.title}</div>}
                    </div>

                    <div className="ai-form-row">
                        <label>Chủ đề khảo sát</label>
                        <select
                            value={form.category_id}
                            onChange={(e) => handleChange('category_id', e.target.value)}
                        >
                            <option value="">Chọn chủ đề…</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        {errors.category_id && <div className="ai-error">{errors.category_id}</div>}
                    </div>

                    <div className="ai-form-row">
                        <label>Mô tả ngắn</label>
                        <input
                            value={form.short_description}
                            onChange={(e) => handleChange('short_description', e.target.value)}
                            placeholder="Mô tả ngắn gọn về mục đích khảo sát"
                        />
                    </div>

                    <div className="ai-form-grid">
                        <div className="ai-form-row">
                            <label>Hết hạn</label>
                            <input type="date" value={form.deadline_date} onChange={(e) => handleChange('deadline_date', e.target.value)} />
                        </div>
                        <div className="ai-form-row">
                            <label>&nbsp;</label>
                            <input type="time" value={form.deadline_time} onChange={(e) => handleChange('deadline_time', e.target.value)} />
                        </div>
                    </div>

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
        </div>
    );
}