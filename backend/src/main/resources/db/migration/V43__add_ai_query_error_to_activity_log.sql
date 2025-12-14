-- V43: Add 'ai_query_error' to activity_log action_type
-- This value is used by AI service (Python) to log AI query errors

ALTER TABLE activity_log 
MODIFY COLUMN action_type VARCHAR(50) NOT NULL;
