-- V27: Clean up question_config column that is not used
-- Remove question_config column from questions table as it's not actually used in the application
-- This prevents teammates from getting confused about unused database fields

-- Remove question_config column as it's defined in entity but not used
ALTER TABLE questions DROP COLUMN question_config;

-- Add comment to clarify multiple choice storage logic
-- Multiple choice answers are now stored as multiple Answer records with option_id
-- The answer_selected_options table is deprecated but kept for backward compatibility
ALTER TABLE answer_selected_options COMMENT = 'DEPRECATED: Multiple choice now uses multiple Answer records with option_id. Kept for backward compatibility.';