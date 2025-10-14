-- V15: Update AI inference confidence thresholds
-- Tự động xử lý các kết quả AI inference dựa trên confidence score

-- 5.1 Khóa các ca rất tự tin (confidence >= 0.90)
-- Tự động chấp nhận kết quả với confidence cao
UPDATE ai_inference i
SET i.final_label = i.pred_label,
    i.status      = 'corrected',
    i.meta_json   = JSON_SET(COALESCE(i.meta_json,'{}'),'$.auto', JSON_OBJECT('conf', i.pred_conf,'thr',0.90))
WHERE i.final_label IS NULL
  AND i.pred_conf >= 0.90
  AND i.status IN ('ok','cached');

-- 5.2 Đánh dấu ca mờ để review (confidence 0.35-0.65)
-- Các trường hợp không chắc chắn cần review thủ công
UPDATE ai_inference
SET status = 'needs_review'
WHERE final_label IS NULL
  AND pred_conf BETWEEN 0.35 AND 0.65
  AND status IN ('ok','cached');