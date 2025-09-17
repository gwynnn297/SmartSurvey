import React, { useState } from 'react';
import './SurveyViewer.css';
import SurveyTaker from './SurveyTaker';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Question Item for Viewer
const SortableQuestionViewer = ({ question, index, onUpdateQuestion }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: question.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        question_text: question.question_text || '',
        question_type: question.question_type || 'multiple_choice',
        is_required: question.is_required !== false
    });

    const handleSave = () => {
        onUpdateQuestion(index, { ...question, ...editData });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditData({
            question_text: question.question_text || '',
            question_type: question.question_type || 'multiple_choice',
            is_required: question.is_required !== false
        });
        setIsEditing(false);
    };

    const renderQuestionDisplay = () => {
        switch (question.question_type) {
            case 'multiple_choice':
                return (
                    <div className="viewer-options">
                        {question.options?.map((option, optIndex) => (
                            <label key={optIndex} className="viewer-option">
                                <input type="radio" name={`viewer_${question.id}`} disabled />
                                <span className="option-text">
                                    {option.option_text || `Lựa chọn ${optIndex + 1}`}
                                </span>
                            </label>
                        )) || (
                                <div className="viewer-placeholder">Chưa có lựa chọn nào</div>
                            )}
                    </div>
                );

            case 'open_ended':
                return (
                    <textarea
                        placeholder="Nhập câu trả lời của bạn..."
                        disabled
                        rows={4}
                        className="viewer-textarea"
                    />
                );

            case 'rating':
                return (
                    <div className="viewer-rating">
                        <div className="rating-scale">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <label key={star} className="rating-option">
                                    <input type="radio" name={`rating_${question.id}`} disabled />
                                    <span className="star">⭐</span>
                                    <span className="rating-number">{star}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                );

            case 'boolean':
                return (
                    <div className="viewer-boolean">
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
                return <div className="viewer-placeholder">Loại câu hỏi không được hỗ trợ</div>;
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="viewer-question-item"
            {...attributes}
        >
            <div className="question-number">
                {index + 1}
            </div>

            {/* Drag Handle */}
            <div className="drag-handle" {...listeners}>
                <span>⋮⋮</span>
            </div>

            <div className="question-content">
                {isEditing ? (
                    <div className="edit-mode">
                        <textarea
                            value={editData.question_text}
                            onChange={(e) => setEditData({ ...editData, question_text: e.target.value })}
                            className="edit-textarea"
                            rows={3}
                            placeholder="Nhập nội dung câu hỏi..."
                        />
                        <select
                            value={editData.question_type}
                            onChange={(e) => setEditData({ ...editData, question_type: e.target.value })}
                            className="edit-select"
                        >
                            <option value="multiple_choice">🔘 Trắc nghiệm</option>
                            <option value="open_ended">📝 Tự luận</option>
                            <option value="rating">⭐ Đánh giá</option>
                            <option value="boolean">✅ Có/Không</option>
                        </select>
                        <div className="edit-actions">
                            <button className="btn-save" onClick={handleSave}>
                                💾 Lưu
                            </button>
                            <button className="btn-cancel" onClick={handleCancel}>
                                ❌ Hủy
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="display-mode">
                        <div className="question-header">
                            <h3 className="question-text">{question.question_text || 'Câu hỏi chưa có nội dung'}</h3>
                            <div className="question-meta">
                                <span className="question-type-badge">
                                    {question.question_type === 'multiple_choice' && '🔘 Trắc nghiệm'}
                                    {question.question_type === 'open_ended' && '📝 Tự luận'}
                                    {question.question_type === 'rating' && '⭐ Đánh giá'}
                                    {question.question_type === 'boolean' && '✅ Có/Không'}
                                </span>
                                {question.is_required && <span className="required-badge">* Bắt buộc</span>}
                            </div>
                        </div>

                        <div className="question-input">
                            {renderQuestionDisplay()}
                        </div>

                        <div className="question-actions">
                            <button className="btn-edit" onClick={() => setIsEditing(true)}>
                                ✏️ Chỉnh sửa
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const SurveyViewer = ({ surveyData, questions = [], onClose, onUpdateQuestions, onSaveChanges }) => {
    const [localQuestions, setLocalQuestions] = useState(questions);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isTakerMode, setIsTakerMode] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = localQuestions.findIndex(question => question.id === active.id);
            const newIndex = localQuestions.findIndex(question => question.id === over.id);

            const newQuestions = arrayMove(localQuestions, oldIndex, newIndex);
            setLocalQuestions(newQuestions);
            setHasChanges(true);
        }
    };

    const handleUpdateQuestion = (index, updatedQuestion) => {
        const newQuestions = [...localQuestions];
        newQuestions[index] = updatedQuestion;
        setLocalQuestions(newQuestions);
        setHasChanges(true);
    };

    const handleSubmitSurvey = async (responseData) => {
        try {
            console.log('Survey response submitted:', responseData);
            alert('Cảm ơn bạn đã tham gia khảo sát!');
            setIsTakerMode(false);
        } catch (error) {
            console.error('Error submitting survey:', error);
            alert('Có lỗi xảy ra khi gửi khảo sát. Vui lòng thử lại.');
        }
    };

    const handleSaveChanges = async () => {
        if (!hasChanges) {
            alert('Không có thay đổi nào để lưu.');
            return;
        }

        setIsSaving(true);
        try {
            // Call parent's save function if provided
            if (onSaveChanges) {
                await onSaveChanges(localQuestions);
            } else {
                // Fallback: call onUpdateQuestions
                onUpdateQuestions(localQuestions);
            }

            setHasChanges(false);
            alert('Đã lưu thay đổi thành công!');
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Có lỗi xảy ra khi lưu thay đổi. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        if (hasChanges && isEditMode) {
            const confirmClose = window.confirm(
                'Bạn có thay đổi chưa được lưu. Bạn có chắc chắn muốn đóng không? Thay đổi sẽ bị mất.'
            );
            if (!confirmClose) {
                return;
            }
        }
        onClose();
    };

    // Nếu đang ở chế độ làm khảo sát, hiển thị SurveyTaker
    if (isTakerMode) {
        return (
            <SurveyTaker
                surveyData={surveyData}
                questions={localQuestions}
                onSubmit={handleSubmitSurvey}
                onClose={() => setIsTakerMode(false)}
            />
        );
    }

    return (
        <div className="survey-viewer-overlay" onClick={onClose}>
            <div className="survey-viewer-modal" onClick={(e) => e.stopPropagation()}>
                <div className="viewer-header">
                    <div className="viewer-title-section">
                        <h2 className="viewer-survey-title">
                            {surveyData.title || 'Khảo sát chưa có tiêu đề'}
                        </h2>
                        {surveyData.description && (
                            <p className="viewer-survey-description">
                                {surveyData.description}
                            </p>
                        )}
                        <div className="viewer-meta">
                            <span>📊 {localQuestions.length} câu hỏi</span>
                            <span>•</span>
                            <span>⏱️ Dự kiến hoàn thành: {Math.ceil(localQuestions.length * 0.5)} phút</span>
                            <span>•</span>
                            <span>📝 {surveyData.status === 'active' ? 'Đang hoạt động' : 'Nháp'}</span>
                        </div>
                    </div>
                    <div className="viewer-header-actions">
                        <button
                            className={`mode-toggle ${isTakerMode ? 'active' : ''}`}
                            onClick={() => setIsTakerMode(true)}
                        >
                            📝 Làm khảo sát
                        </button>
                        <button
                            className={`mode-toggle ${isEditMode ? 'active' : ''}`}
                            onClick={() => setIsEditMode(!isEditMode)}
                        >
                            {isEditMode ? '👁️ Xem' : '✏️ Chỉnh sửa'}
                        </button>
                        <button className="viewer-close-btn" onClick={handleClose}>
                            ✕
                        </button>
                    </div>
                </div>

                <div className="viewer-content">
                    {localQuestions.length === 0 ? (
                        <div className="viewer-empty">
                            <div className="empty-icon">📝</div>
                            <h3>Chưa có câu hỏi nào</h3>
                            <p>Thêm câu hỏi để xem khảo sát</p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={localQuestions.map(q => q.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="viewer-questions">
                                    {localQuestions.map((question, index) => (
                                        <SortableQuestionViewer
                                            key={question.id || index}
                                            question={question}
                                            index={index}
                                            onUpdateQuestion={handleUpdateQuestion}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                <div className="viewer-footer">
                    <div className="viewer-actions">
                        <button className="btn-secondary" onClick={handleClose}>
                            Đóng
                        </button>
                        {isEditMode ? (
                            <button
                                className={`btn-primary ${hasChanges ? 'btn-save-changes' : ''}`}
                                onClick={handleSaveChanges}
                                disabled={!hasChanges || isSaving}
                            >
                                {isSaving ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
                            </button>
                        ) : (
                            <button className="btn-primary" disabled>
                                Gửi khảo sát
                            </button>
                        )}
                    </div>
                    {hasChanges && isEditMode && (
                        <div className="unsaved-changes-notice">
                            ⚠️ Bạn có thay đổi chưa được lưu
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SurveyViewer;


