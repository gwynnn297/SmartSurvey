-- Create normalized table for multiple choice selections
CREATE TABLE answer_selected_options (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    answer_id BIGINT NOT NULL,
    option_id BIGINT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (answer_id) REFERENCES answers(answer_id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES options(option_id) ON DELETE CASCADE,
    
    -- Prevent duplicate selections for same answer
    UNIQUE KEY unique_answer_option (answer_id, option_id),
    
    -- Indexes for performance
    INDEX idx_answer_id (answer_id),
    INDEX idx_option_id (option_id)
);