-- V12: Add display_order column for drag-and-drop ordering
ALTER TABLE questions ADD COLUMN display_order INT NOT NULL DEFAULT 0;

-- Backfill display_order as 1..N per survey using window function and a derived table
UPDATE questions q
JOIN (
    SELECT question_id,
           ROW_NUMBER() OVER (PARTITION BY survey_id ORDER BY question_id) AS rn
    FROM questions
) x ON q.question_id = x.question_id
SET q.display_order = x.rn;

-- Index to optimize sorting by survey
CREATE INDEX idx_questions_survey_display_order ON questions(survey_id, display_order);
