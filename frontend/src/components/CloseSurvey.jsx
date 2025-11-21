import React from "react";
import "./CloseSurvey.css";

const CloseSurvey = ({ isOpen, onClose, survey, statusMeta, onConfirm, isClosingSurvey }) => {
    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (onConfirm) {
            await onConfirm();
        }
    };

    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="settings-modal__header">
                    <div className="settings-modal__icon" aria-hidden="true">
                        🔒
                    </div>
                    <div>
                        <h3>Đóng khảo sát</h3>
                        <p>Ngừng nhận phản hồi mới và ẩn biểu mẫu khỏi người tham gia.</p>
                    </div>
                </div>

                <div className="settings-modal__body">
                    <div className="settings-notice">
                        <strong>Lưu ý:</strong> Khi khảo sát được đóng, liên kết chia sẻ sẽ hiển thị thông báo "Khảo sát đã kết thúc". Bạn có thể mở lại khảo sát bất cứ lúc nào trong trang chỉnh sửa.
                    </div>
                    <div className="settings-summary">
                        <div>
                            <span className="summary-label">Trạng thái hiện tại</span>
                            <span className={`summary-status ${statusMeta?.className || ""}`}>
                                {statusMeta?.label || "Không xác định"}
                            </span>
                        </div>
                        <div>
                            <span className="summary-label">Số câu hỏi</span>
                            <span className="summary-value">{survey?.totalQuestions || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="settings-modal__actions">
                    <button
                        className="btn-secondary"
                        type="button"
                        onClick={onClose}
                        disabled={isClosingSurvey}
                    >
                        Hủy
                    </button>
                    <button
                        className="btn-danger"
                        type="button"
                        onClick={handleConfirm}
                        disabled={isClosingSurvey}
                    >
                        {isClosingSurvey ? "Đang đóng..." : "Đóng khảo sát"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseSurvey;
