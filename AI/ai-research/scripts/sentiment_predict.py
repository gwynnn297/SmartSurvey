import argparse, json
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TextClassificationPipeline
import torch

LABELS = ["negative", "neutral", "positive"]
label2id = {l:i for i,l in enumerate(LABELS)}
id2label = {i:l for l,i in label2id.items()}

def load_pipe(model_dir):
    tok = AutoTokenizer.from_pretrained(model_dir, use_fast=False)
    mdl = AutoModelForSequenceClassification.from_pretrained(model_dir)
    # bảo đảm id2label/label2id đúng
    mdl.config.id2label = {int(k):v for k,v in getattr(mdl.config, "id2label", id2label).items()}
    mdl.config.label2id = {k:int(v) for k,v in getattr(mdl.config, "label2id", label2id).items()}
    return TextClassificationPipeline(model=mdl, tokenizer=tok, device=0 if torch.cuda.is_available() else -1,
                                      return_all_scores=False, function_to_apply="softmax")

def predict_one(pipe, text: str):
    out = pipe(text)[0]  # {'label': 'positive', 'score': 0.82}
    # Chuẩn hoá nhãn về negative/neutral/positive (nếu config trả LABEL_0 ...)
    label = out["label"]
    if label.startswith("LABEL_"):
        label = id2label[int(label.split("_")[-1])]
    return {"label": label, "score": float(out["score"])}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default="ai-research/checkpoints/phobert-sentiment-baseline")
    ap.add_argument("--text", required=True, help="Vietnamese sentence")
    args = ap.parse_args()
    pipe = load_pipe(args.model_dir)
    res = predict_one(pipe, args.text)
    print(json.dumps(res, ensure_ascii=False))
