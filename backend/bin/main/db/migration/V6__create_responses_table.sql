-- Tạo bảng responses
CREATE TABLE IF NOT EXISTS responses (
    response_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    survey_id BIGINT NOT NULL,
    user_id BIGINT,
    request_token VARCHAR(128) NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_survey_response (survey_id),
    UNIQUE INDEX ux_responses_request_token (request_token),
    FOREIGN KEY (survey_id) REFERENCES surveys(survey_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);