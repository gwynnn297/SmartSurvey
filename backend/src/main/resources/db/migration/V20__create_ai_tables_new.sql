-- V16__create_ai_tables.sql
-- Tạo các bảng AI phục vụ inference/training
-- Lưu ý: dùng InnoDB + utf8mb4. JSON yêu cầu MySQL ≥ 5.7 (nếu thấp hơn, đổi JSON -> LONGTEXT).

/* ===========================
   BẢNG: ai_models
   =========================== */
CREATE TABLE IF NOT EXISTS ai_models (
  model_id     BIGINT NOT NULL AUTO_INCREMENT,
  version_tag  VARCHAR(100) NOT NULL,
  ckpt_path    TEXT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active    TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (model_id),
  UNIQUE KEY uq_ai_models_version_tag (version_tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ===========================
   BẢNG: ai_training_samples
   =========================== */
CREATE TABLE IF NOT EXISTS ai_training_samples (
  sample_id   BIGINT NOT NULL AUTO_INCREMENT,
  `text`      LONGTEXT NOT NULL,
  norm_text   LONGTEXT NOT NULL,
  text_hash   VARCHAR(64) NOT NULL,
  label       TINYINT NOT NULL,
  embed       BLOB NULL,
  `source`    ENUM('review','import','weak') NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (sample_id),
  UNIQUE KEY uq_ai_training_samples_text_hash (text_hash),
  KEY idx_ai_training_samples_label (label),
  KEY idx_ai_training_samples_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ===========================
   BẢNG: ai_calib_items
   =========================== */
CREATE TABLE IF NOT EXISTS ai_calib_items (
  item_id     BIGINT NOT NULL AUTO_INCREMENT,
  `text`      LONGTEXT NOT NULL,
  norm_text   LONGTEXT NOT NULL,
  label       TINYINT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  KEY idx_ai_calib_items_label (label),
  KEY idx_ai_calib_items_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ===========================
   BẢNG: ai_inference
   =========================== */
CREATE TABLE IF NOT EXISTS ai_inference (
  inference_id  BIGINT NOT NULL AUTO_INCREMENT,
  survey_id     BIGINT NULL,
  question_id   BIGINT NULL,
  answer_id     BIGINT NULL,
  raw_text      LONGTEXT NOT NULL,
  norm_text     LONGTEXT NOT NULL,
  text_hash     VARCHAR(64) NOT NULL,
  embed         BLOB NULL,
  `source`      ENUM('model','knn','cache','cache-final','ext') NOT NULL DEFAULT 'model',
  pred_label    TINYINT NOT NULL,
  pred_conf     FLOAT NOT NULL,
  final_label   TINYINT NULL,
  `status`      ENUM('ok','corrected','cached','error','needs_review','auto') NOT NULL DEFAULT 'ok',
  meta_json     JSON NULL,
  created_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (inference_id),
  UNIQUE KEY uq_ai_inference_text_hash (text_hash),
  KEY idx_ai_inference_pred_label (pred_label),
  KEY idx_ai_inference_status (status),
  KEY idx_ai_inference_created_at (created_at),
  KEY idx_ai_inference_survey (survey_id),
  KEY idx_ai_inference_question (question_id),
  KEY idx_ai_inference_answer (answer_id),
  CONSTRAINT fk_ai_inference_survey
    FOREIGN KEY (survey_id)  REFERENCES surveys (survey_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_ai_inference_question
    FOREIGN KEY (question_id) REFERENCES questions (question_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_ai_inference_answer
    FOREIGN KEY (answer_id)   REFERENCES answers (answer_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
