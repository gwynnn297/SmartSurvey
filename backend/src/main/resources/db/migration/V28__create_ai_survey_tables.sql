-- V28: Create AI survey tables for industry, rules, and generation history

-- 1. Create ai_survey_industry table
CREATE TABLE ai_survey_industry (
    industry_id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    focus_json JSON,
    tags_json JSON,
    lang VARCHAR(8) DEFAULT 'vi',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    templates JSON,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (industry_id),
    UNIQUE KEY uk_ai_survey_industry_code (code)
);

-- 2. Create ai_survey_rule table
CREATE TABLE ai_survey_rule (
    rule_id BIGINT NOT NULL AUTO_INCREMENT,
    industry_code VARCHAR(64) NOT NULL,
    rule_type ENUM('BLOCK', 'LEADING') NOT NULL,
    pattern VARCHAR(512) NOT NULL,
    note VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    lang VARCHAR(8) DEFAULT 'vi',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (rule_id),
    KEY idx_ai_survey_rule_industry_code (industry_code)
);

-- 3. Create ai_survey_gen_history table
CREATE TABLE ai_survey_gen_history (
    gen_id BIGINT NOT NULL AUTO_INCREMENT,
    survey_id BIGINT,
    topic VARCHAR(512) NOT NULL,
    industry VARCHAR(64) NOT NULL,
    language VARCHAR(8) NOT NULL DEFAULT 'vi',
    n INT NOT NULL,
    source ENUM('gemini', 'fallback') NOT NULL,
    payload JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (gen_id),
    KEY idx_ai_survey_gen_history_survey_id (survey_id),
    KEY idx_ai_survey_gen_history_industry (industry)
);

-- Add foreign key constraint for survey_id (optional)
-- ALTER TABLE ai_survey_gen_history 
-- ADD CONSTRAINT fk_ai_survey_gen_history_survey_id 
-- FOREIGN KEY (survey_id) REFERENCES surveys(survey_id) ON DELETE SET NULL;
