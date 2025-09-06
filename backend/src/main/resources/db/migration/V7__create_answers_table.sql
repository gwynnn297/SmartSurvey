-- Tạo bảng answers
CREATE TABLE IF NOT EXISTS answers (
    answer_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    response_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    option_id BIGINT NULL,
    answer_text LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_response (response_id),
    INDEX idx_question (question_id),
    INDEX idx_option_id (option_id),
    INDEX idx_answers_question_response (question_id, response_id),
    FOREIGN KEY (response_id) REFERENCES responses(response_id),
    FOREIGN KEY (question_id) REFERENCES questions(question_id),
    FOREIGN KEY (option_id) REFERENCES options(option_id) ON DELETE SET NULL
);
