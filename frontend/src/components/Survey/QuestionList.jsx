import React from 'react';
import QuestionForm from './QuestionForm';
import './QuestionList.css';
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

// Sortable Question Item Component
const SortableQuestionItem = ({ question, index, updateQuestion, deleteQuestion }) => {
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="question-item-wrapper sortable-item"
            {...attributes}
        >
            <div className="question-number">
                {index + 1}
            </div>

            {/* Drag Handle */}
            <div className="drag-handle" {...listeners}>
                <span>⋮⋮</span>
            </div>

            <QuestionForm
                question={question}
                onChange={(updatedQuestion) => updateQuestion(index, updatedQuestion)}
                onDelete={() => deleteQuestion(index)}
            />
        </div>
    );
};

const QuestionList = ({ questions = [], onChangeQuestions }) => {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = questions.findIndex(question => question.id === active.id);
            const newIndex = questions.findIndex(question => question.id === over.id);

            const newQuestions = arrayMove(questions, oldIndex, newIndex);
            onChangeQuestions(newQuestions);
        }
    };
    const addQuestion = () => {
        const newQuestion = {
            id: Date.now(), // Temporary ID
            question_text: '', // Người dùng sẽ nhập thủ công
            question_type: 'multiple_choice',
            is_required: true,
            options: [
                { option_text: '' },
                { option_text: '' }
            ]
        };
        onChangeQuestions([...questions, newQuestion]);
    };

    const updateQuestion = (index, updatedQuestion) => {
        const newQuestions = [...questions];
        newQuestions[index] = updatedQuestion;
        onChangeQuestions(newQuestions);
    };

    const deleteQuestion = (index) => {
        if (questions.length > 0) {
            const newQuestions = questions.filter((_, i) => i !== index);
            onChangeQuestions(newQuestions);
        }
    };

    return (
        <div className="questions-container">
            <div className="questions-header">
                <div className="questions-title">
                    📝 Danh sách câu hỏi
                    <span className="questions-count">{questions.length} câu hỏi</span>
                </div>
                <button
                    type="button"
                    onClick={addQuestion}
                    className="add-question-btn"
                >
                    <span>+</span> Thêm câu hỏi
                </button>
            </div>

            {questions.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">
                        📝
                    </div>
                    <h3 className="empty-title">
                        Chưa có câu hỏi nào
                    </h3>
                    <p className="empty-description">
                        Thêm câu hỏi đầu tiên để bắt đầu tạo khảo sát. <strong>Bạn sẽ nhập nội dung câu hỏi thủ công</strong> - không có câu hỏi tự động.
                    </p>
                    <div className="empty-hint">
                        <p>💡 <strong>Hướng dẫn tạo câu hỏi thủ công:</strong></p>
                        <ul>
                            <li>Nhập nội dung câu hỏi vào ô trống</li>
                            <li>Chọn loại câu hỏi (trắc nghiệm, tự luận, đánh giá, có/không)</li>
                            <li>Thêm các lựa chọn cho câu hỏi trắc nghiệm</li>
                            <li>Kéo thả để sắp xếp thứ tự câu hỏi</li>
                        </ul>
                    </div>
                    <button
                        type="button"
                        onClick={addQuestion}
                        className="empty-add-btn"
                    >
                        <span>+</span> Thêm câu hỏi đầu tiên
                    </button>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={questions.map(q => q.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="questions-list">
                            {questions.map((question, index) => (
                                <SortableQuestionItem
                                    key={question.id || index}
                                    question={question}
                                    index={index}
                                    updateQuestion={updateQuestion}
                                    deleteQuestion={deleteQuestion}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {questions.length > 0 && (
                <div className="add-more-section">
                    <button
                        type="button"
                        onClick={addQuestion}
                        className="add-more-btn"
                    >
                        <span>+</span> Thêm câu hỏi khác
                    </button>
                </div>
            )}
        </div>
    );
};

export default QuestionList;
