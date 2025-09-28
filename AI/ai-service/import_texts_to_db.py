# import_texts_to_db.py
import argparse
from pathlib import Path
from typing import Optional, List, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from db import SessionLocal, Response, Answer  # dùng models ở db.py

TEXT_CANDIDATES = ["answer_text", "text", "content", "value_text", "comment"]

def load_csv(path: str) -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Không tìm thấy CSV: {p}")
    df = pd.read_csv(p, keep_default_na=False)
    df.columns = [c.strip() for c in df.columns]
    return df

def pick_text_col(df: pd.DataFrame, override: Optional[str]) -> str:
    if override:
        if override not in df.columns:
            raise ValueError(f"--text-col={override} không có trong CSV. Có: {list(df.columns)}")
        return override
    for c in TEXT_CANDIDATES:
        if c in df.columns:
            return c
    for c in df.columns:
        if df[c].dtype == "object":
            return c
    raise ValueError("Không tìm được cột văn bản. Hãy dùng --text-col để chỉ định.")

def chunk_iterable(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i+size]

def rows_to_tuples(
    df: pd.DataFrame,
    text_col: str,
    survey_col: Optional[str],
    question_col: Optional[str],
    default_survey_id: Optional[int],
    default_question_id: Optional[int],
) -> List[Tuple[int, int, str]]:
    out = []
    for row in df.itertuples(index=False):
        # survey_id
        if survey_col and hasattr(row, survey_col):
            s_id = int(getattr(row, survey_col))
        else:
            if default_survey_id is None:
                raise ValueError("CSV không có survey_id và bạn chưa truyền --survey-id mặc định.")
            s_id = int(default_survey_id)
        # question_id
        if question_col and hasattr(row, question_col):
            q_id = int(getattr(row, question_col))
        else:
            q_id = int(default_question_id or 1)
        # text
        t = getattr(row, text_col)
        t = (str(t) if t is not None else "").strip()
        if not t:
            continue
        out.append((s_id, q_id, t))
    return out

def import_texts(
    csv_path: str,
    survey_col: Optional[str],
    question_col: Optional[str],
    text_col_override: Optional[str],
    default_survey_id: Optional[int],
    default_question_id: Optional[int],
    batch_size: int = 200,
) -> int:
    df = pd.read_csv(csv_path)
    text_col = pick_text_col(df, text_col_override)

    rows = rows_to_tuples(
        df,
        text_col=text_col,
        survey_col=survey_col if survey_col in df.columns else None,
        question_col=question_col if question_col in df.columns else None,
        default_survey_id=default_survey_id,
        default_question_id=default_question_id,
    )
    if not rows:
        print("⚠️ CSV không có dòng văn bản hợp lệ.")
        return 0

    db: Session = SessionLocal()
    inserted = 0
    try:
        for chunk in chunk_iterable(rows, batch_size):
            # 1) tạo responses
            responses = [Response(survey_id=sid) for (sid, _, _) in chunk]
            db.add_all(responses)
            db.flush()  # có response_id

            # 2) tạo answers
            answers = []
            for resp, (sid, qid, txt) in zip(responses, chunk):
                answers.append(
                    Answer(
                        response_id=resp.response_id,
                        question_id=qid,
                        option_id=None,
                        answer_text=txt,
                    )
                )
            db.add_all(answers)
            db.commit()

            inserted += len(answers)
            print(f"… inserted {inserted}/{len(rows)}")
        print(f"✅ Hoàn tất. Inserted {inserted} rows từ {csv_path}.")
        return inserted
    finally:
        db.close()

def main():
    ap = argparse.ArgumentParser(description="Import nhiều dòng text từ CSV vào DB (responses + answers).")
    ap.add_argument("--file", "-f", required=True, help="Đường dẫn CSV.")
    ap.add_argument("--survey-col", default="survey_id", help="Tên cột survey_id trong CSV (mặc định: survey_id).")
    ap.add_argument("--question-col", default="question_id", help="Tên cột question_id trong CSV (mặc định: question_id).")
    ap.add_argument("--text-col", help="Tên cột text (nếu CSV không dùng answer_text/text/content).")
    ap.add_argument("--survey-id", type=int, help="Fallback survey_id nếu CSV KHÔNG có cột survey_id.")
    ap.add_argument("--question-id", type=int, default=1, help="Fallback question_id nếu CSV KHÔNG có cột question_id. Mặc định 1.")
    ap.add_argument("--batch-size", type=int, default=200, help="Kích thước batch (mặc định 200).")
    args = ap.parse_args()

    import_texts(
        csv_path=args.file,
        survey_col=args.survey_col,
        question_col=args.question_col,
        text_col_override=args.text_col,
        default_survey_id=args.survey_id,
        default_question_id=args.question_id,
        batch_size=args.batch_size,
    )

if __name__ == "__main__":
    main()
