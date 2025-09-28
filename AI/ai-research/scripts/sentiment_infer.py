import argparse, csv, sys
import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_NAME = "cardiffnlp/twitter-xlm-roberta-base-sentiment"  # pos/neu/neg
LABELS = ["negative", "neutral", "positive"]

def load_model():
    tok = AutoTokenizer.from_pretrained(MODEL_NAME)
    mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    mdl.eval()
    return tok, mdl

@torch.no_grad()
def predict(texts, tok, mdl, batch_size=8):
    outs = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        inputs = tok(batch, padding=True, truncation=True, return_tensors="pt")
        logits = mdl(**inputs).logits
        preds = torch.softmax(logits, dim=-1).argmax(dim=-1).tolist()
        outs.extend([LABELS[i] for i in preds])
    return outs

def main(args):
    df = pd.read_csv(args.input)
    if "text" not in df.columns:
        print("CSV must have 'text' column", file=sys.stderr); sys.exit(1)
    tok, mdl = load_model()
    df["pred_label"] = predict(df["text"].astype(str).tolist(), tok, mdl)
    df.to_csv(args.output, index=False, quoting=csv.QUOTE_NONNUMERIC)
    print(f"Saved -> {args.output}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="ai-research/data/predictions.csv")
    main(parser.parse_args())
