"""Step 10: small local model for new bills (runs inside the daily build, no AI service needed).

* Topic: a TF-IDF (character n-grams) + linear SVM classifier, retrained on every run (about 3 seconds) from all
  bills labelled so far — the original ~21,000 plus any labelled later by review (not its own guesses), so it keeps
  learning, and there is no saved model file to break when the sandbox reinstalls its packages.
  Held-out check (by distinct bill name): 87% agreement overall; 95.6% on the 73% of bills where the model's
  confidence is >= 0.7. Only those confident predictions are written; the rest stay in
  work/new_bills_unclassified.tsv for the daily task to label by hand.
* "בעד =" line: when the title states the amendment's purpose — "(תיקון - <purpose>)" — that purpose is the line,
  word for word. Anything else is left in work/new_meaning_needed.tsv for the daily task.
Writes to input/bill_topics_extra.tsv and input/bill_meaning.tsv (append), and prints what it did.
"""
import json, os, re
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV

THRESHOLD = 0.7
W = "pipeline/work"
I = "pipeline/input"


def norm(s):
    s = str(s)
    s = re.sub(r',?\s*התש[֐-׿"\'״׳]*\s*[-–]?\s*\d{4}', "", s)
    s = re.sub(r"\(תיקון מס['׳]?\s*\d+\)", "", s)
    s = re.sub(r"\(מס['׳]\s*\d+\)", "", s)
    return re.sub(r"\s+", " ", s).strip(" ,.")


def read_tsv(path):
    if not os.path.exists(path):
        return []
    return [l.rstrip("\n").split("\t") for l in open(path, encoding="utf-8") if l.strip()]


# ---------------- topics
new = read_tsv(f"{W}/new_bills_unclassified.tsv")
added_t = 0
if new:
    bt = json.load(open("public/data/topics/bill_topics.json"))
    b = pd.read_csv(f"{W}/bills_to_classify.csv")
    b["y"] = b.BillID.astype(str).map(lambda x: bt.get(x, ["other"])[0])
    # also learn from bills labelled since then by review — but never from the model's own guesses
    extra = [r for r in read_tsv(f"{I}/bill_topics_extra.tsv") if len(r) >= 4 and not (len(r) > 4 and r[4].startswith("model:"))]
    if extra:
        b = pd.concat([b[["norm", "y"]], pd.DataFrame({"norm": [norm(r[3]) for r in extra], "y": [r[1] for r in extra]})])
    b = b.drop_duplicates("norm", keep="last")
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True)
    X = vec.fit_transform(list(b.norm.astype(str)))
    clf = CalibratedClassifierCV(LinearSVC(C=0.5), cv=3).fit(X, list(b.y))
    P = clf.predict_proba(vec.transform([norm(r[1]) for r in new]))
    keep = []
    with open(f"{I}/bill_topics_extra.tsv", "a", encoding="utf-8") as fh:
        for r, p in zip(new, P):
            j = int(np.argmax(p))
            if p[j] >= THRESHOLD:
                fh.write(f"{r[0]}\t{clf.classes_[j]}\t\t{r[1]}\tmodel:{p[j]:.2f}\n")
                added_t += 1
            else:
                keep.append(r)
    with open(f"{W}/new_bills_unclassified.tsv", "w", encoding="utf-8") as fh:
        for r in keep:
            fh.write("\t".join(r[:2]) + "\n")
print(f"topics by local model: {added_t} of {len(new)} (rest left for review)")

# ---------------- "בעד =" from the amendment purpose stated in the title
need = read_tsv(f"{W}/new_meaning_needed.tsv")
added_m, keep = 0, []
PURPOSE = re.compile(r"\(תיקון\s*[-–]\s*([^()]+?)\)")
with open(f"{I}/bill_meaning.tsv", "a", encoding="utf-8") as fh:
    for r in need:
        m = PURPOSE.search(r[1] if len(r) > 1 else "")
        if m and len(m.group(1).split()) >= 2:
            fh.write(f"{r[0]}\t{m.group(1).strip()}\n")
            added_m += 1
        else:
            keep.append(r)
with open(f"{W}/new_meaning_needed.tsv", "w", encoding="utf-8") as fh:
    for r in keep:
        fh.write("\t".join(r[:2]) + "\n")
print(f"'בעד =' lines from titles: {added_m} of {len(need)} (rest left for review)")
if added_t or added_m:
    print("RERUN_09")
