-- V22: Update question type enum for advanced types
-- Remove multiple_choice_multi and finalize advanced question types

ALTER TABLE questions MODIFY COLUMN question_type ENUM(
    'multiple_choice',
    'open_ended', 
    'rating',
    'boolean_',
    'single_choice',
    'matrix',
    'ranking',
    'file_upload',
    'date_time'
);