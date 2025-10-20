-- Truncate bảng ai_sentiment để xóa tất cả dữ liệu
-- CẢNH BÁO: Lệnh này sẽ xóa TẤT CẢ dữ liệu trong bảng ai_sentiment

TRUNCATE TABLE ai_sentiment;

-- Kiểm tra kết quả
SELECT COUNT(*) as total_records FROM ai_sentiment;
