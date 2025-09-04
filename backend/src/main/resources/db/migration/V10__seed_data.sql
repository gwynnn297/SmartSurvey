-- Seed data cho Sprint 1
-- 5 categories mẫu
INSERT INTO categories (category_name) VALUES
('Khảo sát khách hàng'),
('Khảo sát nhân viên'),
('Khảo sát học viên'),
('Khảo sát sản phẩm'),
('Khảo sát dịch vụ');

-- 3 users mẫu (password: 123456)
INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES
('admin@smartsurvey.com', '$2a$10$8K3vZ9cQwJcQyXN7JcJcQeJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJc', 'Administrator', 'admin', true),
('creator@smartsurvey.com', '$2a$10$8K3vZ9cQwJcQyXN7JcJcQeJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJc', 'Survey Creator', 'creator', true),
('respondent@smartsurvey.com', '$2a$10$8K3vZ9cQwJcQyXN7JcJcQeJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJcJc', 'Survey Respondent', 'respondent', true);