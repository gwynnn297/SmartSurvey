-- V36: Add restricted team binding for user permissions
-- Cho phép ràng buộc quyền của user với một team cụ thể.
-- Khi user rời khỏi team bị ràng buộc, quyền sẽ bị thu hồi (ở tầng logic).

ALTER TABLE survey_permissions
ADD COLUMN restricted_team_id BIGINT NULL AFTER user_id;

ALTER TABLE survey_permissions
ADD INDEX idx_restricted_team_id (restricted_team_id);

ALTER TABLE survey_permissions
ADD CONSTRAINT fk_survey_permissions_restricted_team
    FOREIGN KEY (restricted_team_id) REFERENCES teams(team_id)
    ON DELETE CASCADE;

-- restricted_team_id chỉ hợp lệ khi đây là quyền cấp trực tiếp cho user
ALTER TABLE survey_permissions
ADD CONSTRAINT chk_restricted_team_requires_user
CHECK (restricted_team_id IS NULL OR user_id IS NOT NULL);








