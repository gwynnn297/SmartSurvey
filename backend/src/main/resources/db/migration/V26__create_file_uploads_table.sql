-- Create file_uploads table for storing uploaded files information
CREATE TABLE IF NOT EXISTS file_uploads (
    file_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    answer_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_answer_id (answer_id),
    INDEX idx_file_name (file_name),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (answer_id) REFERENCES answers(answer_id) ON DELETE CASCADE
);