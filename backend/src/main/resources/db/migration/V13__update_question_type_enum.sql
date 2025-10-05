-- Update question_type enum to support boolean_ (with underscore)
-- This fixes inconsistency between migration file and Java enum

-- First, update any existing 'boolean' values to 'boolean_'
UPDATE questions SET question_type = 'boolean_' WHERE question_type = 'boolean';

-- Then modify the enum to include 'boolean_' instead of 'boolean'
ALTER TABLE questions MODIFY COLUMN question_type ENUM('multiple_choice','open_ended','rating','boolean_') NOT NULL;