import os
import pandas as pd

BASE_DIR = "ai-research/data/data"
OUT_FILE = "ai-research/data/uit_vsfc_sentiment.csv"

# Map số sang nhãn chữ
LABEL_MAP = {"0": "negative", "1": "neutral", "2": "positive"}

def load_split(split_dir):
    """Load one split (train/dev/test) và trả về DataFrame text + label"""
    sents_path = os.path.join(split_dir, "sents.txt")
    labels_path = os.path.join(split_dir, "sentiments.txt")

    with open(sents_path, encoding="utf-8") as f:
        texts = [line.strip() for line in f]

    with open(labels_path, encoding="utf-8") as f:
        labels = [LABEL_MAP[line.strip()] for line in f]

    assert len(texts) == len(labels), f"Mismatch in {split_dir}: {len(texts)} vs {len(labels)}"
    return pd.DataFrame({"text": texts, "label": labels})

def main():
    all_dfs = []
    for split in ["train", "dev", "test"]:
        split_dir = os.path.join(BASE_DIR, split)
        df = load_split(split_dir)
        df["split"] = split
        all_dfs.append(df)

    full_df = pd.concat(all_dfs, ignore_index=True)
    full_df.to_csv(OUT_FILE, index=False, encoding="utf-8")
    print(f"✅ Saved {len(full_df)} samples to {OUT_FILE}")

if __name__ == "__main__":
    main()
