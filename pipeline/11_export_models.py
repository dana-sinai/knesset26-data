"""Step 11: export the small classifiers as JSON, so the site itself (in the browser) can classify any bill text.

Each model = TF-IDF over character n-grams (2-5, within words, like scikit-learn's analyzer="char_wb") + a linear
classifier (LinearSVC). The file holds the vocabulary, the idf weights and the class weights (rounded to integers),
plus a "temperature" that turns scores into probabilities (fitted on held-out bills). The site reproduces exactly the
same arithmetic in src/lib/classify.js. Retrained on every daily run from all labels, so new labels are picked up.

Models:
  topic      — policy topic (labels: public/data/topics/bill_topics.json + reviewed extras)
  mechanism  — what the bill does       (labels: pipeline/input/bill_essence.tsv, if present)
  who        — who it mainly affects    (labels: pipeline/input/bill_essence.tsv, if present)
Writes public/data/models/{topic,mechanism,who}.json and prints held-out accuracy.
"""
import json, os, re
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.model_selection import GroupShuffleSplit

OUT = "public/data/models"
os.makedirs(OUT, exist_ok=True)
MAX_FEATURES = 12000


def norm(s):  # same as step 10 (and src/lib/classify.js)
    s = str(s)
    s = re.sub(r',?\s*התש[֐-׿"\'״׳]*\s*[-–]?\s*\d{4}', "", s)
    s = re.sub(r"\(תיקון מס['׳]?\s*\d+\)", "", s)
    s = re.sub(r"\(מס['׳]\s*\d+\)", "", s)
    return re.sub(r"\s+", " ", s).strip(" ,.")


def fit_temperature(scores, y_idx):
    best, bt = 1e9, 1.0
    for t in np.geomspace(0.05, 5, 60):
        z = scores / t
        z = z - z.max(axis=1, keepdims=True)
        lp = z - np.log(np.exp(z).sum(axis=1, keepdims=True))
        nll = -lp[np.arange(len(y_idx)), y_idx].mean()
        if nll < best:
            best, bt = nll, t
    return float(bt)


def train_export(name, texts, labels, names_he, min_class=8):
    df = pd.DataFrame({"x": texts, "y": labels}).dropna()
    df = df[df.x.str.len() > 0]
    vc = df.y.value_counts()
    df = df[df.y.isin(vc[vc >= min_class].index)].drop_duplicates("x", keep="last")
    vec_kw = dict(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True, max_features=MAX_FEATURES)
    # held-out check (grouped by text) + temperature for probabilities
    tr, te = next(GroupShuffleSplit(1, test_size=0.2, random_state=0).split(df.x, df.y, groups=df.x))
    v = TfidfVectorizer(**vec_kw)
    A = v.fit_transform(df.x.iloc[tr])
    c = LinearSVC(C=0.5).fit(A, df.y.iloc[tr])
    S = c.decision_function(v.transform(df.x.iloc[te]))
    yi = np.array([list(c.classes_).index(t) for t in df.y.iloc[te]])
    acc = float((S.argmax(1) == yi).mean())
    temp = fit_temperature(S, yi)
    # final model on everything
    v = TfidfVectorizer(**vec_kw)
    A = v.fit_transform(df.x)
    c = LinearSVC(C=0.5).fit(A, df.y)
    W = c.coef_
    scale = float(np.abs(W).max() / 127)
    vocab = sorted(v.vocabulary_, key=v.vocabulary_.get)
    json.dump(dict(
        name=name, analyzer="char_wb", ngram=[2, 5], sublinear_tf=True,
        classes=list(c.classes_), labels={k: names_he.get(k, k) for k in c.classes_},
        vocab=vocab, idf=[round(float(x), 4) for x in v.idf_],
        coef=[[int(round(w / scale)) for w in row] for row in W], scale=scale,
        intercept=[round(float(b), 5) for b in c.intercept_], temperature=round(temp, 4),
        n_train=int(len(df)), holdout_accuracy=round(acc, 4),
    ), open(f"{OUT}/{name}.json", "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"model {name}: {len(df)} labelled texts, {len(c.classes_)} classes, held-out accuracy {acc:.3f}")


# ---------------- topic (title only, as the daily classifier)
topics = json.load(open("public/data/topics/topics.json"))["labels"]
bt = json.load(open("public/data/topics/bill_topics.json"))
b = pd.read_csv("pipeline/work/bills_to_classify.csv")
texts = [norm(n) for n in b.Name]
labels = [bt.get(str(i), [None])[0] for i in b.BillID]
train_export("topic", texts, labels, topics)

# ---------------- bills waiting for a topic (model unsure / "other"), with the model's 3 best guesses, for the
# "help us classify" page. They stay without a topic until visitors agree (step 12).
_df = pd.DataFrame({"x": texts, "y": labels}).dropna()
_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True, max_features=MAX_FEATURES)
_clf = LinearSVC(C=0.5).fit(_vec.fit_transform(_df.x), _df.y)
name_of = dict(zip(b.BillID.astype(str), b.Name))
waiting = {}
if os.path.exists("pipeline/work/new_bills_unclassified.tsv"):
    for line in open("pipeline/work/new_bills_unclassified.tsv", encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if p and p[0].strip().isdigit():
            waiting[p[0]] = p[1] if len(p) > 1 else name_of.get(p[0], "")
for k_, v_ in bt.items():
    if v_[0] == "other":
        waiting.setdefault(k_, name_of.get(k_, ""))
crowd_done = set()
if os.path.exists("pipeline/input/bill_topics_extra.tsv"):
    for line in open("pipeline/input/bill_topics_extra.tsv", encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) > 4 and p[4].startswith("crowd:"):
            crowd_done.add(p[0])
# one entry per law name: the same bill is often tabled several times (different Knessets / initiators) —
# a single answer applies to all of them. Each entry carries what helps to decide: the official summary (when the
# Knesset published one), the "בעד =" line, the Knesset number, and links to the bill's page on the Knesset site.
summary = {}
if os.path.exists("pipeline/raw/ok/kns_bill.csv"):
    _kb = pd.read_csv("pipeline/raw/ok/kns_bill.csv", usecols=["BillID", "SummaryLaw"], low_memory=False).dropna()
    summary = {str(int(r.BillID)): re.sub(r"\s+", " ", str(r.SummaryLaw)).strip() for r in _kb.itertuples()}
elif os.path.exists("public/data/topics/bill_summary.json"):
    summary = json.load(open("public/data/topics/bill_summary.json"))
meaning_line = {}
for line in open("pipeline/input/bill_meaning.tsv", encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if len(p) >= 2 and p[0].strip().isdigit() and "ללא פירוט מטרה" not in p[1]:
        meaning_line[p[0].strip()] = p[1].strip()
knesset_of = dict(zip(b.BillID.astype(str), b.KnessetNum))
groups = {}
for k_, nm in waiting.items():
    if k_ in crowd_done or not str(nm).strip():
        continue
    groups.setdefault(norm(nm), []).append(k_)
items = []
for key, ids in groups.items():
    ids = sorted(ids, key=int, reverse=True)
    sc = _clf.decision_function(_vec.transform([key]))[0]
    order = [c for c in _clf.classes_[np.argsort(-sc)] if c != "other"][:3]
    summ = next((summary[i] for i in ids if summary.get(i)), "")
    items.append(dict(bill=int(ids[0]), bills=[int(i) for i in ids], name=str(waiting[ids[0]]), guesses=list(order),
                      knessets=sorted({int(knesset_of[i]) for i in ids if i in knesset_of}),
                      summary=summ[:700], meaning=next((meaning_line[i] for i in ids if i in meaning_line), "")))
json.dump(sorted(items, key=lambda x: -x["bill"]), open("public/data/topics/needs_help.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(f"needs_help.json: {len(items)} law names ({sum(len(x['bills']) for x in items)} bills) waiting for a topic")

# ---------------- mechanism / who (title + "בעד =" line), from the reviewed essence labels
ess_path = "pipeline/input/bill_essence.tsv"
if os.path.exists(ess_path):
    ess = pd.read_csv(ess_path, sep="\t", header=None, names=["bill", "mech1", "mech2", "who1", "who2"], dtype=str).fillna("")
    meaning = {}
    for line in open("pipeline/input/bill_meaning.tsv", encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 2 and p[0].strip().isdigit():
            meaning[p[0].strip()] = "" if "ללא פירוט מטרה" in p[1] else p[1].strip()
    name = dict(zip(b.BillID.astype(str), b.Name))
    # title + the "בעד =" line (what the bill does, in words) — more accurate than the title alone
    ess["text"] = [(norm(name.get(x, "")) + " " + meaning.get(x, "")).strip() for x in ess.bill]
    defs = json.load(open("pipeline/input/essence_labels.json"))
    train_export("mechanism", list(ess.text), list(ess.mech1), defs["mechanism"])
    train_export("who", list(ess.text), list(ess.who1), defs["who"])

    # the reviewed labels themselves, for the site (bill id -> [mechanism, mechanism2, who, who2]) + Hebrew names
    json.dump(dict(labels=defs, bills={r.bill: [r.mech1, r.mech2, r.who1, r.who2] for r in ess.itertuples()}),
              open("public/data/topics/bill_essence.json", "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"bill_essence.json: {len(ess)} bills")
