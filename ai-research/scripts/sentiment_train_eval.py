import os, argparse, json, numpy as np
from datasets import load_dataset
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    TrainingArguments, Trainer, DataCollatorWithPadding
)
from sklearn.metrics import precision_recall_fscore_support, accuracy_score
import torch, random

LABELS = ["negative", "neutral", "positive"]
label2id = {l: i for i, l in enumerate(LABELS)}
id2label = {i: l for l, i in label2id.items()}


def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def load_and_prepare(csv_path):
    ds = load_dataset("csv", data_files={"train": csv_path})["train"]

    def map_label(row):
        l = str(row["label"]).strip().lower()
        if l not in label2id:
            raise ValueError(f"Label '{row['label']}' not in {LABELS}")
        row["labels"] = label2id[l]
        return row

    # map và xóa cột label gốc
    ds = ds.map(map_label, remove_columns=["label"])

    # chia train/val/test 80/10/10
    ds_split = ds.train_test_split(test_size=0.2, seed=42)
    test_valid = ds_split["test"].train_test_split(test_size=0.5, seed=42)

    return {
        "train": ds_split["train"],
        "validation": test_valid["train"],
        "test": test_valid["test"],
    }



def tokenize_fn(tokenizer):
    def _fn(batch):
        return tokenizer(batch["text"], padding="max_length", truncation=True, max_length=256)
    return _fn



def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels, preds, average="macro", zero_division=0
    )
    acc = accuracy_score(labels, preds)
    return {"precision": precision, "recall": recall, "f1": f1, "accuracy": acc}


def main(args):
    set_seed(42)

    model_name = "vinai/phobert-base"
    tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=False)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name, num_labels=len(LABELS), id2label=id2label, label2id=label2id
    )

    data = load_and_prepare(args.data)

    tokenized = {}
    for split, ds in data.items():
        tokenized[split] = ds.map(tokenize_fn(tokenizer), batched=True)

    collator = DataCollatorWithPadding(tokenizer=tokenizer)

    training_args = TrainingArguments(
        output_dir=args.outdir,
        eval_strategy="epoch",        # ✅ mới
        save_strategy="epoch",
        logging_steps=50,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.lr,
        weight_decay=0.01,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        fp16=torch.cuda.is_available(),
        report_to=[]                  # ✅ mới
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        tokenizer=tokenizer,
        data_collator=collator,
        compute_metrics=compute_metrics
    )

    trainer.train()

    # Evaluate on test
    test_metrics = trainer.evaluate(tokenized["test"])
    print("Test metrics:", test_metrics)

    # Save checkpoint & tokenizer
    trainer.save_model(args.ckpt)
    tokenizer.save_pretrained(args.ckpt)

    # Write eval report (markdown) + raw json
    os.makedirs(os.path.dirname(args.report_md), exist_ok=True)
    with open(args.report_md, "w", encoding="utf-8") as f:
        f.write("# Sentiment Baseline Evaluation\n\n")
        f.write(f"- Model: {model_name}\n")
        f.write(f"- Labels: {LABELS}\n")
        f.write(f"- Test Precision (macro): {test_metrics['eval_precision']:.4f}\n")
        f.write(f"- Test Recall (macro): {test_metrics['eval_recall']:.4f}\n")
        f.write(f"- Test F1 (macro): {test_metrics['eval_f1']:.4f}\n")
        f.write(f"- Test Accuracy: {test_metrics['eval_accuracy']:.4f}\n")

    with open(args.report_json, "w", encoding="utf-8") as f:
        json.dump(test_metrics, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True, help="CSV with 'text,label'")
    p.add_argument("--outdir", default="ai-research/checkpoints/phobert-out")
    p.add_argument("--ckpt", default="ai-research/checkpoints/phobert-sentiment-baseline")
    p.add_argument("--report-md", default="ai-research/reports/sentiment_eval.md")
    p.add_argument("--report-json", default="ai-research/reports/sentiment_eval.json")
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--batch-size", type=int, default=8)
    p.add_argument("--lr", type=float, default=2e-5)
    args = p.parse_args()
    main(args)
