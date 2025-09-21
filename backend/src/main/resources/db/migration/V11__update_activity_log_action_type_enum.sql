-- Thêm các action type mới cho Option vào enum của activity_log
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
    'chat_ai'
) NOT NULL;