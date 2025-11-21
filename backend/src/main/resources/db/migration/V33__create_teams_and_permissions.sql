-- V33: Create teams, team_members, and survey_permissions tables for collaboration
-- This migration enables team collaboration and role-based survey permissions

-- ============================================================
-- 1. Create teams table
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
    team_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    owner_id BIGINT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_owner (owner_id),
    INDEX idx_invite_code (invite_code),
    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Create team_members table
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
    team_member_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    team_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role ENUM('OWNER', 'EDITOR', 'ANALYST', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_team_user (team_id, user_id),
    INDEX idx_user (user_id),
    INDEX idx_team (team_id),
    FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Create survey_permissions table
-- Allows sharing surveys with individual users (with optional team restriction)
-- Chỉ dùng user_id, restricted_team_id sẽ được thêm ở V36
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_permissions (
    permission_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    survey_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    permission ENUM('OWNER', 'EDITOR', 'ANALYST', 'VIEWER') NOT NULL,
    granted_by BIGINT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_survey (survey_id),
    INDEX idx_user (user_id),
    INDEX idx_survey_user (survey_id, user_id),
    FOREIGN KEY (survey_id) REFERENCES surveys(survey_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

