-- V24: Update for normalized storage support
-- Keep existing columns but enhance system for normalized approach

-- This migration ensures the system works with the updated ResponseService
-- while maintaining backward compatibility

-- No changes needed - the Answer entity still supports both approaches:
-- 1. Legacy: option_id + selected_options columns  
-- 2. New: answer_selected_options table (already exists from V23)

-- The ResponseService has been updated to:
-- 1. Store single choice as both option_id and in answer_selected_options
-- 2. Store multiple choice only in answer_selected_options  
-- 3. Read from answer_selected_options table first, fallback to legacy columns

-- This allows for gradual migration and testing without breaking existing data