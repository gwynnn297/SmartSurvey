-- Tạo bảng activity_log
CREATE TABLE IF NOT EXISTS activity_log (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL,
    action_type ENUM(
        'login','logout','create_survey','edit_survey','delete_survey',
        'add_question','edit_question','delete_question',
        'submit_response','ai_generate','ai_refresh_one','ai_refresh_all','chat_ai'
    ) NOT NULL,
    target_id BIGINT,
    target_table VARCHAR(50),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_log (user_id),
    INDEX idx_action_type (action_type),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);