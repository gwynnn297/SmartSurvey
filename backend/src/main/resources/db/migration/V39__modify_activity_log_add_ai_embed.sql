-- V39: Modify activity_log columns, add answer_value to answers, create ai_embed table
-- This migration:
-- 1. Modifies activity_log.action_type to VARCHAR(32) and target_table to VARCHAR(64)
-- 2. Adds/modifies answer_value column in answers table (DECIMAL(10,2))
-- 3. Creates ai_embed table for AI embeddings
-- 4. Creates index on ai_embed.survey_id

-- ============================================================
-- 1. Modify activity_log table columns
-- ============================================================
ALTER TABLE activity_log
  MODIFY action_type VARCHAR(32) NOT NULL,
  MODIFY target_table VARCHAR(64) NOT NULL;

-- ============================================================
-- 2. Add answer_value column to answers table (if not exists)
-- ============================================================
ALTER TABLE answers
MODIFY COLUMN answer_value DECIMAL(10,2) NULL;

-- ============================================================
-- 3. Create ai_embed table for AI embeddings
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_embed (
    embed_id BIGINT NOT NULL AUTO_INCREMENT,
    survey_id BIGINT NOT NULL,
    answer_id BIGINT NOT NULL,
    text_norm TEXT NOT NULL,
    text_hash CHAR(64) NOT NULL,
    vec_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (embed_id),
    INDEX idx_ai_embed_answer_id (answer_id),
    INDEX idx_ai_embed_text_hash (text_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. Create index on ai_embed.survey_id (if not exists)
-- ============================================================
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'ai_embed' 
AND INDEX_NAME = 'ix_ai_embeds_s';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX ix_ai_embeds_s ON ai_embed(survey_id)',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

