-- V42: Add TEAM_DELETED to notifications.type ENUM
-- This migration adds support for notification when a team is deleted

ALTER TABLE notifications 
MODIFY COLUMN type ENUM(
    'TEAM_MEMBER_ADDED',
    'TEAM_MEMBER_ROLE_CHANGED',
    'TEAM_MEMBER_REMOVED',
    'TEAM_MEMBER_LEFT',
    'TEAM_CREATED',
    'TEAM_INVITATION',
    'TEAM_INVITATION_REJECTED',
    'TEAM_DELETED',
    'SURVEY_SHARED',
    'SURVEY_PERMISSION_CHANGED',
    'NEW_RESPONSE',
    'SURVEY_PUBLISHED'
) NOT NULL;

