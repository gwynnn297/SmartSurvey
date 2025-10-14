-- V16: Create AI-related tables for sentiment analysis and model management

-- 1) Bảng lưu kết quả inference
CREATE TABLE IF NOT EXISTS `ai_inference` (
  `inference_id` BIGINT NOT NULL AUTO_INCREMENT,
  `survey_id`    BIGINT DEFAULT NULL,
  `question_id`  BIGINT DEFAULT NULL,
  `answer_id`    BIGINT DEFAULT NULL,
  `raw_text`     LONGTEXT NOT NULL,
  `norm_text`    LONGTEXT NOT NULL,
  `text_hash`    VARCHAR(64) NOT NULL,
  `embed`        BLOB,
  `source`       ENUM('model','knn','cache','cache-final') NOT NULL DEFAULT 'model',
  `pred_label`   TINYINT NOT NULL,
  `pred_conf`    FLOAT   NOT NULL,
  `final_label`  TINYINT DEFAULT NULL,
  `status`       ENUM('ok','corrected','cached','error','needs_review','auto') NOT NULL DEFAULT 'ok',
  `meta_json`    JSON DEFAULT NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`inference_id`),
  UNIQUE KEY `uk_text_hash` (`text_hash`),
  UNIQUE KEY `uq_ai_inf_survey_answer` (`survey_id`,`answer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_survey` (`survey_id`),
  KEY `idx_pred`   (`pred_label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2) Bảng chứa mẫu dùng để train
CREATE TABLE IF NOT EXISTS `ai_training_samples` (
  `sample_id`  BIGINT NOT NULL AUTO_INCREMENT,
  `text`       LONGTEXT NOT NULL,
  `norm_text`  LONGTEXT NOT NULL,
  `text_hash`  VARCHAR(64) NOT NULL,
  `label`      TINYINT NOT NULL,
  `embed`      BLOB,
  `source`     ENUM('review','import','weak') NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sample_id`),
  UNIQUE KEY `text_hash` (`text_hash`),
  KEY `idx_label` (`label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3) Bảng item để hiệu chỉnh/calibration
CREATE TABLE IF NOT EXISTS `ai_calib_items` (
  `item_id`    BIGINT NOT NULL AUTO_INCREMENT,
  `text`       LONGTEXT NOT NULL,
  `norm_text`  LONGTEXT NOT NULL,
  `label`      TINYINT  NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4) Bảng quản lý các model/checkpoint
CREATE TABLE IF NOT EXISTS `ai_models` (
  `model_id`    BIGINT NOT NULL AUTO_INCREMENT,
  `version_tag` VARCHAR(100) NOT NULL,
  `ckpt_path`   TEXT NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active`   TINYINT(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`model_id`),
  UNIQUE KEY `uk_version` (`version_tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;