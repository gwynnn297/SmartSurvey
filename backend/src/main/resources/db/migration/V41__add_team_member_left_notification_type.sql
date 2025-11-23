-- V41: Add TEAM_MEMBER_LEFT to notifications.type ENUM
-- This migration adds support for notification when a team member leaves the team

ALTER TABLE notifications 
MODIFY COLUMN type ENUM(
    'TEAM_MEMBER_ADDED',
    'TEAM_MEMBER_ROLE_CHANGED',
    'TEAM_MEMBER_REMOVED',
    'TEAM_MEMBER_LEFT',
    'TEAM_CREATED',
    'TEAM_INVITATION',
    'TEAM_INVITATION_REJECTED',
    'SURVEY_SHARED',
    'SURVEY_PERMISSION_CHANGED',
    'NEW_RESPONSE',
    'SURVEY_PUBLISHED'
) NOT NULL;




