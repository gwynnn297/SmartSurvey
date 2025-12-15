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