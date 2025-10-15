# train_phobert_sentiment.py
# Fine-tune PhoBERT (NEG/NEU/POS) an toàn phiên bản, có class weights, early stopping, và collator dự phòng.

import os, sys, json, random, argparse
from datetime import datetime
from pathlib import Path
from inspect import signature

import numpy as np
import pandas as pd
import torch
from transformers.modeling_outputs import SequenceClassifierOutput
from datasets import Dataset, DatasetDict
from transformers import (
    AutoConfig, AutoTokenizer, AutoModelForSequenceClassification,
    DataCollatorWithPadding, TrainingArguments, Trainer, EarlyStoppingCallback
)
from sklearn.metrics import f1_score, accuracy_score, precision_recall_fscore_support
import transformers as tf

# ===== Labels =====
ID2LABEL = {0: "negative", 1: "neutral", 2: "positive"}
LABEL2ID = {v: k for k, v in ID2LABEL.items()}

def now_tag(): return datetime.now().strftime("%Y%m%d-%H%M")

def make_outdir(base_out: str | None) -> Path:
    out = Path(base_out) if base_out else Path("./checkpoints") / f"phobert-out-{now_tag()}"
    out.mkdir(parents=True, exist_ok=True); return out

def read_csv_smart(path: str) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8-sig")

def normalize_label_col(df: pd.DataFrame, label_col="label") -> pd.DataFrame:
    df = df.copy()
    mapping = {
        "0":"negative","1":"neutral","2":"positive",
        "neg":"negative","negative":"negative",
        "neu":"neutral","neutral":"neutral",
        "pos":"positive","positive":"positive",
    }
    df[label_col] = df[label_col].astype(str).str.strip().str.lower().map(mapping)
    if not df[label_col].isin(LABEL2ID.keys()).all():
        bad = df.loc[~df[label_col].isin(LABEL2ID.keys()), label_col].unique().tolist()
        raise ValueError(f"Label lạ: {bad}. Hợp lệ: {list(LABEL2ID.keys())}")
    return df

def to_hf(ds_train: pd.DataFrame, ds_val: pd.DataFrame, tok, max_len: int):
    # tạo Dataset từ pandas và chỉ giữ text/label trước khi tokenize
    def _mk(ds_pd):
        ds = Dataset.from_pandas(ds_pd.reset_index(drop=True))
        cols = [c for c in ds.column_names if c not in ["text","label"]]
        if cols: ds = ds.remove_columns(cols)
        return ds

    dtrain = _mk(ds_train)
    dval   = _mk(ds_val)

    # tokenize + GHI RÕ label vào output để không bị drop
    def preprocess(batch):
        enc = tok(batch["text"], truncation=True, max_length=max_len, padding=False)
        enc["label"] = batch["label"]
        enc["text"]  = batch["text"]  # GIỮ text để collator có thể fallback tokenize
        return enc

    dtrain = dtrain.map(preprocess, batched=True)
    dval   = dval.map(preprocess, batched=True)

    # đảm bảo có đủ cột cần thiết
    needed = ["label","text"]
    for name, ds in [("train", dtrain), ("validation", dval)]:
        for key in needed:
            if key not in ds.column_names:
                raise RuntimeError(f"Dataset '{name}' thiếu cột '{key}' sau tokenize.")
    return DatasetDict({"train": dtrain, "validation": dval})

def get_class_weights(labels: list[int]) -> torch.Tensor:
    counts = np.bincount(labels, minlength=3); total = counts.sum()
    w = total / (3.0 * np.clip(counts, 1, None)); w = w / w.mean()
    return torch.tensor(w, dtype=torch.float)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = logits.argmax(-1)
    macro_f1 = f1_score(labels, preds, average="macro")
    acc = accuracy_score(labels, preds)
    _, _, f1_each, _ = precision_recall_fscore_support(labels, preds, average=None, labels=[0,1,2])
    return {"accuracy":acc, "macro_f1":macro_f1, "f1_neg":f1_each[0], "f1_neu":f1_each[1], "f1_pos":f1_each[2]}

# ===== Collator an toàn: nếu batch có input_ids -> pad; nếu không -> tokenize từ text ngay tại đây
class SafeCollator:
    def __init__(self, tokenizer, max_len):
        self.tok = tokenizer
        self.max_len = max_len
        self.fallback = DataCollatorWithPadding(tokenizer=tokenizer)

    def __call__(self, features):
        # Chuẩn hoá 'labels' -> 'label'
        for f in features:
            if "labels" in f and "label" not in f:
                f["label"] = f.pop("labels")

        # Nếu đã có encodings -> pad bình thường, NHƯNG bỏ 'text' (string) để tránh lỗi tensor
        if "input_ids" in features[0]:
            cleaned = []
            for f in features:
                g = dict(f)
                g.pop("text", None)   # <-- quan trọng: bỏ chuỗi text
                cleaned.append(g)
            return self.fallback(cleaned)

        # Fallback: tokenize từ 'text' nếu chưa có encodings
        if "text" in features[0]:
            texts = [f["text"] for f in features]
            enc = self.tok(
                texts,
                truncation=True,
                max_length=self.max_len,
                padding=True,
                return_tensors="pt",
            )
            labels = torch.tensor([int(f["label"]) for f in features], dtype=torch.long)
            enc["labels"] = labels
            return enc

        # Trường hợp xấu nhất: không có cả 'input_ids' lẫn 'text'
        have = list(features[0].keys())
        raise ValueError(
            f"Batch lacks both 'input_ids' and 'text'. Keys present: {have}. "
            f"Hãy bật remove_unused_columns=False trong TrainingArguments."
        )

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=str, default="train.csv")
    parser.add_argument("--dev",   type=str, default="dev.csv")
    parser.add_argument("--ckpt",  type=str, default=os.environ.get("BASE_MODEL","vinai/phobert-base"))
    parser.add_argument("--outdir",type=str, default=os.environ.get("OUT_DIR", None))
    parser.add_argument("--epochs",type=int, default=int(os.environ.get("EPOCHS",4)))
    parser.add_argument("--batch_size",type=int, default=int(os.environ.get("BATCH",16)))
    parser.add_argument("--lr",    type=float, default=float(os.environ.get("LR",2e-5)))
    parser.add_argument("--max_len",type=int, default=int(os.environ.get("MAX_LEN",128)))
    parser.add_argument("--seed",  type=int, default=int(os.environ.get("SEED",42)))
    parser.add_argument("--patience", type=int, default=2)
    args = parser.parse_args()

    print("[INFO] transformers version:", tf.__version__)
    print("[INFO] python exe:", sys.executable)

    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)

    outdir = make_outdir(args.outdir); print(f"[INFO] Output dir: {outdir}")

    if not Path(args.train).exists() or not Path(args.dev).exists():
        print(f"❌ Không tìm thấy {args.train} / {args.dev}"); sys.exit(1)

    df_tr = normalize_label_col(read_csv_smart(args.train)); df_tr["label"]=df_tr["label"].map(LABEL2ID).astype(int)
    df_dv = normalize_label_col(read_csv_smart(args.dev));   df_dv["label"]=df_dv["label"].map(LABEL2ID).astype(int)

    print(f"[INFO] Loading base: {args.ckpt}")
    config = AutoConfig.from_pretrained(args.ckpt, num_labels=3, id2label=ID2LABEL, label2id=LABEL2ID)
    tok = AutoTokenizer.from_pretrained(args.ckpt, use_fast=False)
    model = AutoModelForSequenceClassification.from_pretrained(args.ckpt, config=config)

    cls_w = get_class_weights(df_tr["label"].tolist()); print("[INFO] Class weights:", cls_w.tolist())

    # gắn loss có weights
    orig_forward = model.forward
    def forward_with_weights(**kwargs):
        # Lấy labels từ 'labels' hoặc 'label'
        labels = kwargs.get("labels", kwargs.get("label", None))

        # Chỉ giữ các khóa mà model RobertaForSequenceClassification hiểu
        allow_keys = (
            "input_ids", "attention_mask", "token_type_ids",
            "position_ids", "head_mask", "inputs_embeds"
        )
        call_kwargs = {k: v for k, v in kwargs.items() if k in allow_keys}

        # KHÔNG truyền labels vào orig_forward để tránh model tự tính loss
        outputs = orig_forward(**call_kwargs)  # -> logits,...

        # Tự tính loss với class weights (nếu có labels)
        if labels is not None:
            if isinstance(labels, torch.Tensor):
                target = labels
            else:
                target = torch.tensor(labels, dtype=torch.long, device=outputs.logits.device)
            loss_fct = torch.nn.CrossEntropyLoss(weight=cls_w.to(outputs.logits.device))
            loss = loss_fct(outputs.logits, target)
        else:
            loss = None

        # Trả về output đúng kiểu
        return SequenceClassifierOutput(
            loss=loss,
            logits=outputs.logits,
            hidden_states=getattr(outputs, "hidden_states", None),
            attentions=getattr(outputs, "attentions", None),
    )
    model.forward = forward_with_weights

    # dataset + collator
    dsd = to_hf(df_tr[["text","label"]], df_dv[["text","label"]], tok, args.max_len)
    collator = SafeCollator(tokenizer=tok, max_len=args.max_len)

    # --- TrainingArguments: tương thích ngược ---
    sig = signature(TrainingArguments.__init__)
    def supports(argname: str) -> bool: return argname in sig.parameters

    ta_kwargs = dict(
        output_dir=str(outdir),
        learning_rate=args.lr,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        logging_steps=50,
        seed=args.seed,
        report_to="none",
    )
    if supports("fp16"): ta_kwargs["fp16"] = torch.cuda.is_available()

    if supports("evaluation_strategy"):
        ta_kwargs.update(
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="macro_f1",
            greater_is_better=True,
            warmup_ratio=0.1,
            weight_decay=0.01,
            logging_first_step=True,
        )
    else:
        if supports("evaluate_during_training"):
            ta_kwargs["evaluate_during_training"] = True
        ta_kwargs.update(save_steps=500, logging_first_step=True)
    if supports("remove_unused_columns"):
        ta_kwargs["remove_unused_columns"] = False
    train_args = TrainingArguments(**ta_kwargs)
    callbacks = [EarlyStoppingCallback(early_stopping_patience=args.patience)] if supports("evaluation_strategy") else []

    trainer = Trainer(
        model=model,
        args=train_args,
        train_dataset=dsd["train"],
        eval_dataset=dsd["validation"],
        tokenizer=tok,                # warning deprecate, vẫn OK
        data_collator=collator,       # collator an toàn
        compute_metrics=compute_metrics,
        callbacks=callbacks,
    )

    trainer.train()

    # save
    trainer.model.config.id2label = ID2LABEL
    trainer.model.config.label2id = LABEL2ID
    trainer.save_model(outdir); tok.save_pretrained(outdir)

    metrics = trainer.evaluate(dsd["validation"])
    with open(outdir / "meta.json", "w", encoding="utf-8") as f:
        json.dump({
            "time": datetime.now().isoformat(),
            "base_ckpt": args.ckpt,
            "outdir": str(outdir),
            "train_rows": int(len(df_tr)),
            "dev_rows": int(len(df_dv)),
            "params": {"epochs":args.epochs,"batch_size":args.batch_size,"lr":args.lr,"max_len":args.max_len,"seed":args.seed,"early_stop_patience":args.patience},
            "class_weights": [float(x) for x in cls_w.tolist()],
            "metrics_dev": metrics,
            "id2label": ID2LABEL, "label2id": LABEL2ID
        }, f, ensure_ascii=False, indent=2)

    print("\n[INFO] Saved to:", outdir)
    print("[INFO] id2label:", ID2LABEL)

if __name__ == "__main__":
    main()
