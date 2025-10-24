-- Migration V21: Placeholder migration
-- This migration was applied but file was missing locally
-- Adding empty migration to maintain version continuity

-- V21: Add advanced question types support
-- This migration adds support for advanced question types including matrix

ALTER TABLE questions MODIFY COLUMN question_type ENUM(
    'multiple_choice',
    'multiple_choice_multi',
    'open_ended',
    'rating',
    'boolean_',
    'single_choice',
    'matrix',
    'ranking',
    'file_upload',
    'date_time'
);