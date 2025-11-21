-- Remove constraint chk_number_of_questions to allow any number of questions
-- This allows surveys to have any number of questions (0, 1, 2, 3, ...) during creation/editing
-- The original constraint (>= 3) was too restrictive for manual question creation
-- Removing constraint allows maximum flexibility

-- Drop existing constraint (MySQL syntax)
-- Check if constraint exists before dropping (to avoid errors if already dropped)
SET @constraint_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'surveys'
    AND CONSTRAINT_NAME = 'chk_number_of_questions'
    AND CONSTRAINT_TYPE = 'CHECK'
);

SET @sql = IF(@constraint_exists > 0,
    'ALTER TABLE surveys DROP CHECK chk_number_of_questions',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;













