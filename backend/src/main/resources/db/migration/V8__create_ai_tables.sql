-- Tạo các bảng AI analysis
CREATE TABLE IF NOT EXISTS ai_analysis (
    analysis_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    survey_id BIGINT NOT NULL,
    analysis_data LONGTEXT NOT NULL,
    analysis_type ENUM('SUMMARY','INSIGHT','SENTIMENT') DEFAULT 'SUMMARY',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_survey_analysis (survey_id),
    INDEX idx_ai_analysis_survey_created (survey_id, created_at),
    FOREIGN KEY (survey_id) REFERENCES surveys(survey_id)
);
CREATE TABLE IF NOT EXISTS ai_sentiment (
    sentiment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    survey_id BIGINT NOT NULL,
    total_responses INT NOT NULL DEFAULT 0,
    positive_percent DECIMAL(5,2) DEFAULT 0.0,
    neutral_percent DECIMAL(5,2) DEFAULT 0.0,
    negative_percent DECIMAL(5,2) DEFAULT 0.0,
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_survey_sentiment (survey_id),
    FOREIGN KEY (survey_id) REFERENCES surveys(survey_id)
);

CREATE TABLE IF NOT EXISTS ai_chat_logs (
    chat_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    survey_id BIGINT NOT NULL,
    user_id BIGINT,
    question_text LONGTEXT NOT NULL,
    ai_response LONGTEXT NOT NULL,
    context JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_survey_chat (survey_id),
    INDEX idx_user_chat (user_id),
    FOREIGN KEY (survey_id) REFERENCES surveys(survey_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS ai_generation_history (
    generation_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    survey_id BIGINT NOT NULL,
    question_id BIGINT NULL,
    generation_type ENUM('single_refresh','full_refresh') NOT NULL,
    ai_prompt LONGTEXT,
    ai_response LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_gen_survey (survey_id),
    FOREIGN KEY (survey_id) REFERENCES surveys(survey_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE SET NULL
);