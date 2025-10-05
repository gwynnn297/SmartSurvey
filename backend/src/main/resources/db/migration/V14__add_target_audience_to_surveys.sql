-- Add target_audience column to surveys table
ALTER TABLE surveys 
ADD COLUMN target_audience VARCHAR(200) NULL 
COMMENT 'Đối tượng mục tiêu của khảo sát (ví dụ: nhân viên, khách hàng, sinh viên)';