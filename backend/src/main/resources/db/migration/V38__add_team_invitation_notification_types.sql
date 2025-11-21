-- V38: Add TEAM_INVITATION and TEAM_INVITATION_REJECTED to notifications.type ENUM
-- This migration adds support for team invitation notifications

-- MySQL doesn't support ALTER ENUM directly, so we need to:
-- 1. Modify the column to allow new values
-- 2. Or recreate the ENUM with new values

-- Method: ALTER TABLE to modify ENUM
ALTER TABLE notifications 
MODIFY COLUMN type ENUM(
    'TEAM_MEMBER_ADDED',
    'TEAM_MEMBER_ROLE_CHANGED',
    'TEAM_MEMBER_REMOVED',
    'TEAM_CREATED',
    'TEAM_INVITATION',
    'TEAM_INVITATION_REJECTED',
    'SURVEY_SHARED',
    'SURVEY_PERMISSION_CHANGED',
    'NEW_RESPONSE',
    'SURVEY_PUBLISHED'
) NOT NULL;













