-- Migration V25: Remove matrix question type from enum
-- This migration removes the matrix question type that was cleaned up from code

ALTER TABLE questions MODIFY COLUMN question_type ENUM(
    'multiple_choice',
    'single_choice', 
    'open_ended',
    'rating',
    'boolean_',
    'ranking',
    'file_upload',
    'date_time'
);