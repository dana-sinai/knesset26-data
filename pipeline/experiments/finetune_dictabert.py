"""Experiment: does a fine-tuned Hebrew BERT (DictaBERT) beat the small TF-IDF + SVM topic model?

Same data and the same held-out split as pipeline/11_export_models.py (20% of distinct normalised titles,
random_state=0). Prints accuracy overall and on confident predictions for both models.
Runs on CPU (GitHub Actions); takes about half an hour.
"""
import json, os, re, sys, time
import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import GroupShuffleSplit
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL = os.environ.get("BERT", "dicta-il/dictabert")
EPOCHS = int(os.environ.get("EPOCHS", 3))
torch.set_num_threads(os.cpu_count() or 2)
src = open("pipeline/11_export_models.py").read()
exec(src[src.index("def norm"):src.index("def fit_temperature")])

bt = json.load(open("public/data/topics/bill_topics.json"))
b = pd.read_csv("pipeline/work/bills_to_classify.csv")
df = pd.DataFrame({"x": [norm(n) for n in b.Name], "y": [bt.get(str(i), [None])[0] for i in b.BillID]}).dropna()
vc = df.y.value_counts(); df = df[df.y.isin(vc[vc >= 8].index)].drop_duplicates("x", keep="last").reset_index(drop=True)
tr, te = next(GroupShuffleSplit(1, test_size=0.2, random_state=0).split(df.x, df.y, groups=df.x))
classes = sorted(df.y.unique()); ci = {c: i for i, c in enumerate(classes)}
y = np.array([ci[c] for c in df.y])

def report(name, P):
    pred, conf = P.argmax(1), P.max(1)
    ok = pred == y[te]
    m = conf >= 0.7
    line = f"{name}: accuracy {ok.mean():.3f} | confident(>=0.7) {ok[m].mean():.3f} on {m.mean():.0%} of bills"
    print(line); print(f"::notice::{line}")
    return P

# baseline: the site's model (calibrated for probabilities)
v = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True, max_features=12000)
A = v.fit_transform(df.x[tr])
svm = CalibratedClassifierCV(LinearSVC(C=0.5), cv=3).fit(A, y[tr])
Ps = np.zeros((len(te), len(classes))); Ps[:, svm.classes_] = svm.predict_proba(v.transform(df.x[te]))
report("TF-IDF+SVM (site)", Ps)

tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSequenceClassification.from_pretrained(MODEL, num_labels=len(classes))
def enc(texts): return tok(list(texts), padding=True, truncation=True, max_length=48, return_tensors="pt")
opt = torch.optim.AdamW(model.parameters(), lr=4e-5, weight_decay=0.01)
steps = EPOCHS * int(np.ceil(len(tr) / 32)); sched = torch.optim.lr_scheduler.LinearLR(opt, 1.0, 0.0, total_iters=steps)
rng = np.random.default_rng(0); t0 = time.time()
for ep in range(EPOCHS):
    model.train(); order = rng.permutation(tr)
    for i in range(0, len(order), 32):
        idx = order[i:i + 32]
        out = model(**enc(df.x[idx]), labels=torch.tensor(y[idx]))
        out.loss.backward(); opt.step(); sched.step(); opt.zero_grad()
    print(f"epoch {ep + 1} done, {time.time() - t0:.0f}s", flush=True)
model.eval(); Pb = []
with torch.no_grad():
    for i in range(0, len(te), 128):
        Pb.append(torch.softmax(model(**enc(df.x[te[i:i + 128]])).logits, -1).numpy())
Pb = np.vstack(Pb)
report(f"{MODEL} fine-tuned ({EPOCHS} epochs)", Pb)
report("average of both", (Pb + Ps) / 2)
