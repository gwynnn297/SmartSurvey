#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Di chuyển vector từ MySQL (ai_embed.vec_json) sang ChromaDB (PersistentClient).
Chạy nhiều lần vẫn idempotent nhờ upsert theo id "survey_id:answer_id".
"""

import os, json, math
import pymysql
from dotenv import load_dotenv
import chromadb

load_dotenv()

# === MySQL (đọc env tương tự app) ===
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "smartsurvey")
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "")

# === ChromaDB ===
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "survey_answers")
BATCH = int(os.getenv("MIGRATE_BATCH", "1000"))

def conn():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS,
        database=DB_NAME, charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )

def main():
    client = chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    try:
        col = chroma_client.get_collection(name=CHROMA_COLLECTION)
    except Exception:
        col = chroma_client.create_collection(
            name=CHROMA_COLLECTION,
            metadata={"hnsw:space": "cosine"}
        )

    total = 0
    with conn() as con:
        with con.cursor() as cur:
            # Đếm tổng
            cur.execute("SELECT COUNT(*) AS n FROM ai_embed")
            n = int(cur.fetchone()["n"] or 0)
            print(f"[migrate] total rows in ai_embed = {n}")
            if n == 0:
                return

            pages = math.ceil(n / BATCH)
            offset = 0
            for p in range(pages):
                cur.execute(
                    "SELECT survey_id, answer_id, text_norm, vec_json FROM ai_embed ORDER BY answer_id ASC LIMIT %s OFFSET %s",
                    (BATCH, offset)
                )
                rows = cur.fetchall() or []
                offset += len(rows)

                ids, embs, metas, docs = [], [], [], []
                for r in rows:
                    try:
                        vec = json.loads(r["vec_json"] or "[]")
                        if not isinstance(vec, list) or not vec:
                            continue
                    except Exception:
                        continue

                    survey_id = int(r["survey_id"])
                    answer_id = int(r["answer_id"])
                    cid = f"{survey_id}:{answer_id}"

                    ids.append(cid)
                    embs.append([float(x) for x in vec])
                    metas.append({
                        "survey_id": survey_id,
                        "answer_id": answer_id,
                    })
                    docs.append(r.get("text_norm") or "")

                if ids:
                    try:
                        col.upsert(ids=ids, embeddings=embs, metadatas=metas, documents=docs)
                        total += len(ids)
                    except Exception as e:
                        print(f"[migrate] upsert error batch: {e}")

                print(f"[migrate] page {p+1}/{pages} migrated={total}")

    print(f"[migrate] DONE. Total migrated: {total}")

if __name__ == "__main__":
    main()
