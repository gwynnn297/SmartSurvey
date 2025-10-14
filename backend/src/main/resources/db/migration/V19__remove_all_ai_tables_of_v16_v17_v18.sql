
-- Migration V19: Xóa các bảng AI từ V16, V17, V18
DROP TABLE IF EXISTS `ai_inference`;
DROP TABLE IF EXISTS `ai_training_samples`;
DROP TABLE IF EXISTS `ai_calib_items`;
DROP TABLE IF EXISTS `ai_models`;


