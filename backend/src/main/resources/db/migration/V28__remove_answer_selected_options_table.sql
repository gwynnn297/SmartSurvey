-- V28: Remove unused answer_selected_options table
-- This table was created for normalized multiple choice storage but is no longer used
-- Multiple choice answers now use multiple Answer records with option_id

-- Drop the deprecated answer_selected_options table
DROP TABLE IF EXISTS answer_selected_options;