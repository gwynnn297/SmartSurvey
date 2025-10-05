-- Add number_of_questions column to surveys table
ALTER TABLE surveys 
ADD COLUMN number_of_questions INT NOT NULL DEFAULT 5 
COMMENT 'Số lượng câu hỏi được yêu cầu tạo (3-20)';

-- Add constraint to ensure valid range
ALTER TABLE surveys 
ADD CONSTRAINT chk_number_of_questions 
CHECK (number_of_questions >= 3 AND number_of_questions <= 20);