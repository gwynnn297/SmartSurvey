# ai-service/check_db.py
from db import SessionLocal, AiSentiment, Answer, Response

db = SessionLocal()
try:
    n_ans = (
        db.query(Answer)
          .join(Response, Response.response_id == Answer.response_id)
          .filter(Response.survey_id == 4)
          .filter(Answer.answer_text.isnot(None))
          .filter(Answer.answer_text != "")
          .count()
    )
    print("Text answers for survey 4:", n_ans)

    last = (
        db.query(AiSentiment)
          .filter(AiSentiment.survey_id == 4)
          .order_by(AiSentiment.created_at.desc())
          .first()
    )
    print("Latest ai_sentiment:", bool(last))
finally:
    db.close()
