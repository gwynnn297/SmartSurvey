# check_db.py
from sqlalchemy import create_engine, text
from settings import settings

engine = create_engine(settings.DB_URL, future=True)

def count_valid_texts(survey_id: int, question_id: int | None = None):
    sql = """
    SELECT COUNT(*) AS c
    FROM answers a
    JOIN responses r ON r.response_id = a.response_id
    WHERE r.survey_id = :sid
      AND LENGTH(TRIM(COALESCE(a.answer_text, ''))) > 0
    """
    params = {"sid": survey_id}
    if question_id is not None:
        sql += " AND a.question_id = :qid"
        params["qid"] = question_id
    with engine.connect() as conn:
        return conn.execute(text(sql), params).scalar_one()

if __name__ == "__main__":
    print("DB_URL:", settings.DB_URL)
    print("valid texts (survey=1):", count_valid_texts(1))
