-- V27: Thêm lại cột duration_seconds để lưu thời gian làm survey
ALTER TABLE responses
  ADD COLUMN duration_seconds INT NULL AFTER submitted_at;
