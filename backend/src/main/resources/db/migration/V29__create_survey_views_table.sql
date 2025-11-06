-- Create survey_views table to track viewership
-- MySQL-compatible DDL
CREATE TABLE IF NOT EXISTS survey_views (
    view_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    survey_id BIGINT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(500),
    session_id VARCHAR(100),
    viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_unique_view BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_survey_view_survey FOREIGN KEY (survey_id)
        REFERENCES surveys(survey_id) ON DELETE CASCADE
);

CREATE INDEX idx_survey_view_survey_id ON survey_views (survey_id);
CREATE INDEX idx_survey_view_ip_address ON survey_views (ip_address);
CREATE INDEX idx_survey_view_session_id ON survey_views (session_id);

