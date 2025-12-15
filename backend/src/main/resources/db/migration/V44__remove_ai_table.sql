-- V43: Remove specific AI tables
-- This migration removes only specific AI-related tables:
-- - ai_survey_industry, ai_survey_rule (from V28)
-- - ai_models, ai_training_samples, ai_calib_items (from V20)
-- - ai_embed (from V39)
--
-- Tables kept (NOT dropped):
-- - ai_analysis, ai_sentiment, ai_chat_logs, ai_generation_history (from V8)
-- - ai_inference (from V20)
-- - ai_survey_gen_history (from V28)

-- Drop tables from V28 (ai_survey_industry, ai_survey_rule)
DROP TABLE IF EXISTS ai_survey_industry;
DROP TABLE IF EXISTS ai_survey_rule;

-- Drop tables from V20 (ai_models, ai_training_samples, ai_calib_items)
DROP TABLE IF EXISTS ai_models;
DROP TABLE IF EXISTS ai_training_samples;
DROP TABLE IF EXISTS ai_calib_items;

-- Drop ai_embed table from V39
DROP TABLE IF EXISTS ai_embed;


