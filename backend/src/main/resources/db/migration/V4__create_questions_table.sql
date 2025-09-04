-- Tạo bảng questions
CREATE TABLE IF NOT EXISTS questions (
    question_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    survey_id BIGINT NOT NULL,
    question_text LONGTEXT,
    question_type ENUM('multiple_choice','open_ended','rating','boolean') NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_survey (survey_id),
    FOREIGN KEY (survey_id) REFERENCES surveys(survey_id)
);