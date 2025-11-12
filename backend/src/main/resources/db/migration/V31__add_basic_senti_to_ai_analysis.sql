-- Add BASIC_SENTI to analysis_type enum in ai_analysis table
-- Safe for MySQL: redefine ENUM with the new value appended

ALTER TABLE ai_analysis
    MODIFY COLUMN analysis_type ENUM('SUMMARY','INSIGHT','SENTIMENT','BASIC_SENTI') NOT NULL;


