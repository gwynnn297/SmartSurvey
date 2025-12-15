-- V45: Add 'ai_query_error' and 'ai_eval' to activity_log.action_type enum
-- Giá trị 'ai_query_error' được sử dụng để log các lỗi khi query AI
-- Giá trị 'ai_eval' được sử dụng để log các đánh giá/evaluation của AI

ALTER TABLE activity_log 
MODIFY COLUMN action_type ENUM(
    'login',
    'logout',
    'create_survey',
    'edit_survey',
    'delete_survey',
    'add_question',
    'edit_question', 
    'delete_question',
    'add_option',
    'edit_option',
    'delete_option',
    'submit_response',
    'ai_generate',
    'ai_refresh_one',
    'ai_refresh_all',
    'chat_ai',
    'ai_query',
    'ai_query_error',
    'ai_eval'
) NOT NULL;

