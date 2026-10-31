"""Step 13 (monthly, GitHub Actions): fine-tune the Hebrew BERT model DictaBERT on all topic labels.

Saves the model to pipeline/models/bert-topic (kept in the GitHub Actions cache, not in git). The daily step 10 then
averages its probabilities with the small TF-IDF + SVM model's for each new bill. Held-out test (same split as the
experiment in pipeline/experiments/): SVM alone 86.1%, DictaBERT 89.5%, the average 89.6% — and 96.3% correct on the
80% of bills where the average is at least 70% sure (SVM alone: 95.4% on 70%). Runs on CPU, about 40 minutes.
"""
import json, os, re, time
import numpy as np
import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE = os.environ.get("BERT", "dicta-il/dictabert")
EPOCHS = int(os.environ.get("EPOCHS", 3))
OUT = "pipeline/models/bert-topic"
torch.set_num_threads(os.cpu_count() or 2)
src = open("pipeline/10_classify_new.py").read()
exec(src[src.index("def norm"):src.index("def read_tsv")])

bt = json.load(open("public/data/topics/bill_topics.json"))
b = pd.read_csv("pipeline/work/bills_to_classify.csv")
rows = [(norm(n), bt.get(str(i), [None])[0]) for n, i in zip(b.Name, b.BillID)]
# labels added later by review / visitors (never the model's own guesses)
for line in open("pipeline/input/bill_topics_extra.tsv", encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if len(p) >= 4 and not (len(p) > 4 and p[4].startswith("model:")):
        rows.append((norm(p[3]), p[1]))
df = pd.DataFrame(rows, columns=["x", "y"]).dropna().drop_duplicates("x", keep="last")
vc = df.y.value_counts(); df = df[df.y.isin(vc[vc >= 8].index)].reset_index(drop=True)
classes = sorted(df.y.unique()); y = np.array([classes.index(c) for c in df.y])

tok = AutoTokenizer.from_pretrained(BASE)
model = AutoModelForSequenceClassification.from_pretrained(BASE, num_labels=len(classes))
enc = lambda t: tok(list(t), padding=True, truncation=True, max_length=48, return_tensors="pt")
opt = torch.optim.AdamW(model.parameters(), lr=4e-5, weight_decay=0.01)
steps = EPOCHS * int(np.ceil(len(df) / 32)); sched = torch.optim.lr_scheduler.LinearLR(opt, 1.0, 0.0, total_iters=steps)
rng = np.random.default_rng(0); t0 = time.time()
for ep in range(EPOCHS):
    model.train()
    for idx in np.array_split(rng.permutation(len(df)), int(np.ceil(len(df) / 32))):
        out = model(**enc(df.x[idx]), labels=torch.tensor(y[idx]))
        out.loss.backward(); opt.step(); sched.step(); opt.zero_grad()
    print(f"epoch {ep + 1}/{EPOCHS} done, {time.time() - t0:.0f}s", flush=True)
os.makedirs(OUT, exist_ok=True)
model.half().save_pretrained(OUT); tok.save_pretrained(OUT)
json.dump(dict(classes=classes, base=BASE, epochs=EPOCHS, n_train=int(len(df)), trained=time.strftime("%Y-%m-%d")),
          open(f"{OUT}/classes.json", "w"))
print(f"model bert-topic: {len(df)} labelled titles, {len(classes)} classes, saved to {OUT}")
