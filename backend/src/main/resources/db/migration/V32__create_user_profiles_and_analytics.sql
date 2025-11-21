-- V32: Create user_profiles table and analytical structures for AI analysis
-- This migration creates: user_profiles table, answers.answer_value column, responses_ext view, answers_analytical table, and refresh procedure

-- ============================================================
-- 1. Add answer_value column to answers table for analytical processing
-- ============================================================
-- Check if column exists before adding (MySQL doesn't support IF NOT EXISTS for ALTER TABLE)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'answers' 
AND COLUMN_NAME = 'answer_value';

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE answers ADD COLUMN answer_value DECIMAL(9,3) NULL AFTER answer_text',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. Create user_profiles table for demographic data
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id BIGINT PRIMARY KEY,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL,
    age_band ENUM('18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'prefer_not_to_say') NULL,
    region VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_profiles_gender (gender),
    INDEX idx_user_profiles_age_band (age_band),
    INDEX idx_user_profiles_region (region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Create responses_ext view (denormalized respondent data)
-- ============================================================
CREATE OR REPLACE VIEW responses_ext AS
SELECT
    r.response_id,
    r.survey_id,
    r.user_id AS respondent_id,
    r.submitted_at AS created_at,
    up.gender,
    up.age_band,
    up.region
FROM responses r
LEFT JOIN user_profiles up ON up.user_id = r.user_id;

-- ============================================================
-- 4. Create answers_analytical table (partitioned for performance)
-- Note: MySQL does not support FOREIGN KEY constraints with partitioning,
-- so we skip FK constraints to allow partitioning by survey_id
-- ============================================================
CREATE TABLE IF NOT EXISTS answers_analytical (
    survey_id INT NOT NULL,
    answer_id BIGINT NOT NULL,
    response_id BIGINT NOT NULL,
    question_id INT NOT NULL,
    option_id INT NULL,
    answer_text TEXT NULL,
    answer_value DECIMAL(9,3) NULL,
    PRIMARY KEY (survey_id, answer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (survey_id) (
    PARTITION p_lt_1000 VALUES LESS THAN (1000),
    PARTITION p_1000_1999 VALUES LESS THAN (2000),
    PARTITION p_2000_2999 VALUES LESS THAN (3000),
    PARTITION p_3000_3999 VALUES LESS THAN (4000),
    PARTITION p_4000_4999 VALUES LESS THAN (5000),
    PARTITION p_max VALUES LESS THAN MAXVALUE
);
-- Index for common query patterns
-- Note: MySQL < 8.0 doesn't support IF NOT EXISTS for CREATE INDEX
-- Using a workaround with prepared statement to check existence first
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'answers_analytical' 
AND INDEX_NAME = 'ix_ans_anal_resp';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX ix_ans_anal_resp ON answers_analytical (response_id)',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'answers_analytical' 
AND INDEX_NAME = 'ix_ans_anal_qopt';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX ix_ans_anal_qopt ON answers_analytical (question_id, option_id)',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'answers_analytical' 
AND INDEX_NAME = 'ix_ans_anal_survey_question';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX ix_ans_anal_survey_question ON answers_analytical (survey_id, question_id)',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Initial statistics collection
ANALYZE TABLE answers_analytical;

-- ============================================================
-- 5. Create procedure to refresh analytical data
-- ============================================================
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_refresh_answers$$

CREATE PROCEDURE sp_refresh_answers(IN p_survey_id INT)
BEGIN
    /*
     * Upsert dữ liệu vào bảng analytical theo survey
     * This procedure populates the answers_analytical table with data from answers and responses
     * It performs an INSERT ... ON DUPLICATE KEY UPDATE to handle incremental updates
     */
    INSERT INTO answers_analytical
    (
        survey_id, 
        answer_id, 
        response_id, 
        question_id, 
        option_id, 
        answer_text, 
        answer_value
    )
    SELECT
        r.survey_id,
        a.answer_id,
        a.response_id,
        a.question_id,
        a.option_id,
        a.answer_text,
        CASE 
            WHEN a.answer_text IS NULL OR TRIM(a.answer_text) = '' THEN NULL
            ELSE CAST(a.answer_text AS DECIMAL(9,3))
        END AS answer_value
    FROM answers a
    JOIN responses r ON r.response_id = a.response_id
    WHERE r.survey_id = p_survey_id
    ON DUPLICATE KEY UPDATE
        answer_text = a.answer_text,
        answer_value = CASE 
            WHEN a.answer_text IS NULL OR TRIM(a.answer_text) = '' THEN NULL
            ELSE CAST(a.answer_text AS DECIMAL(9,3))
        END;

    -- Update statistics to help optimizer with partition pruning and index usage
    ANALYZE TABLE answers_analytical;
END$$

DELIMITER ;

