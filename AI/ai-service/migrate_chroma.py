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
from urllib.parse import urlparse, unquote

load_dotenv()

def _db_params_from_url(url: str) -> dict:
    u = urlparse(url)
    if u.scheme.startswith("sqlite"):
        raise ValueError("DATABASE_URL sqlite không hợp lệ cho pymysql")
    return {
        "host": u.hostname or "127.0.0.1",
        "port": int(u.port or 3306),
        "user": unquote(u.username or "root"),
        "password": unquote(u.password or ""),
        "database": (u.path or "").lstrip("/") or "",
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }

def _get_db_connect_args() -> dict:
    url = os.getenv("DATABASE_URL") or os.getenv("DB_URL")
    if url:
        return _db_params_from_url(url)

    host = os.getenv("DB_HOST") or os.getenv("MYSQL_HOST") or "127.0.0.1"
    port = int(os.getenv("DB_PORT") or os.getenv("MYSQL_PORT") or 3306)
    user = os.getenv("DB_USER") or os.getenv("MYSQL_USER") or "root"
    password = os.getenv("DB_PASS") or os.getenv("MYSQL_PWD") or ""
    database = os.getenv("DB_NAME") or os.getenv("MYSQL_DB") or ""

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "database": database,
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }

# === ChromaDB ===
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "survey_answers")
BATCH = int(os.getenv("MIGRATE_BATCH", "1000"))

def conn():
    return pymysql.connect(**_get_db_connect_args())

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
