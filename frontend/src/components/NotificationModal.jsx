import React, { useEffect, useState, useRef } from 'react';
import './NotificationModal.css';

const NotificationModal = ({ type = 'success', message, onClose, duration = 3000 }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const progressIntervalRef = useRef(null);
    const startTimeRef = useRef(Date.now());

    const handleClose = () => {
        setIsExiting(true);
        // Clear progress interval
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        // Đợi animation hoàn thành trước khi gọi onClose
        setTimeout(() => {
            setIsVisible(false);
            if (onClose) {
                onClose();
            }
        }, 300); // Thời gian animation fade out
    };

    useEffect(() => {
        // Tự động đóng sau duration (mặc định 3 giây)
        const timer = setTimeout(() => {
            handleClose();
        }, duration);

        // Cập nhật progress bar mỗi 50ms
        const updateInterval = 50;
        progressIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const remaining = Math.max(0, duration - elapsed);
            const newProgress = (remaining / duration) * 100;
            setProgress(newProgress);

            if (newProgress <= 0) {
                clearInterval(progressIntervalRef.current);
            }
        }, updateInterval);

        return () => {
            clearTimeout(timer);
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration]);

    if (!isVisible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <i className="fa-solid fa-circle-check"></i>;
            case 'error':
                return <i className="fa-solid fa-circle-xmark"></i>;
            case 'warning':
                return <i className="fa-solid fa-triangle-exclamation"></i>;
            case 'info':
                return <i className="fa-solid fa-circle-info"></i>;
            default:
                return <i className="fa-solid fa-circle-check"></i>;
        }
    };

    return (
        <div className={`notification-modal ${type} ${isExiting ? 'exiting' : ''}`}>
            <div className="notification-progress-bar">
                <div
                    className="notification-progress-fill"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <div className="notification-icon">
                {getIcon()}
            </div>
            <div className="notification-content">
                <p className="notification-message">{message}</p>
            </div>
            <button
                className="notification-close"
                onClick={handleClose}
                aria-label="Đóng thông báo"
            >
                <i className="fa-solid fa-xmark"></i>
            </button>
        </div>
    );
};

export default NotificationModal;

