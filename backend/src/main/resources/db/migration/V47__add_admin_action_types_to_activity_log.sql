-- V48: Add admin action types to activity_log.action_type enum
-- Thêm các action types cho admin operations: update role, delete, create, activate, deactivate user

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
    'ai_eval',
    'admin_update_user_role',
    'admin_delete_user',
    'admin_create_user',
    'admin_deactivate_user',
    'admin_activate_user'
) NOT NULL;
