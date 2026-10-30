"""Compare topic classifiers on the same held-out split (by distinct bill name).
usage: python3 exp_models.py classic | embed <hf-model-id> | eval <hf-model-id>
Embeddings are cached in pipeline/work/emb/ so a long model can run in the background."""
import json, os, sys, time
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

W = "pipeline/work"
bt = json.load(open("public/data/topics/bill_topics.json"))
b = pd.read_csv(f"{W}/bills_to_classify.csv")
b["y"] = b.BillID.astype(str).map(lambda x: bt[x][0])
B = b.drop_duplicates("norm").reset_index(drop=True)
texts = [str(x) for x in B.norm]
y = np.array(list(B.y))
idx = np.arange(len(B))
tr, te = train_test_split(idx, test_size=0.2, random_state=1)


def report(name, P, classes):
    pred = classes[P.argmax(1)]
    conf = P.max(1)
    out = [name]
    for th in (0.0, 0.7, 0.8):
        m = conf >= th
        out.append(f"conf>={th}: covers {m.mean():.0%} acc {(pred[m] == y[te][m]).mean():.1%}")
    print(" | ".join(out), flush=True)


mode = sys.argv[1]
if mode == "classic":
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.svm import LinearSVC
    from sklearn.calibration import CalibratedClassifierCV
    from scipy.sparse import hstack
    t = [texts[i] for i in tr]; s = [texts[i] for i in te]
    for nm, vecs in [("char 2-5", [TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True)]),
                     ("char 2-5 + words 1-2", [TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True),
                                               TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=1, sublinear_tf=True)])]:
        Xt = hstack([v.fit_transform(t) for v in vecs]).tocsr(); Xs = hstack([v.transform(s) for v in vecs]).tocsr()
        for C in (0.3, 1.0):
            clf = CalibratedClassifierCV(LinearSVC(C=C), cv=3).fit(Xt, y[tr])
            report(f"SVM {nm} C={C}", clf.predict_proba(Xs), clf.classes_)
elif mode == "embed":
    from sentence_transformers import SentenceTransformer
    model_id = sys.argv[2]
    os.makedirs(f"{W}/emb", exist_ok=True)
    f = f"{W}/emb/{model_id.replace('/', '__')}.npy"
    m = SentenceTransformer(model_id, device="cpu")
    prefix = "query: " if "e5" in model_id else ""
    done = np.load(f) if os.path.exists(f) else np.zeros((0, m.get_sentence_embedding_dimension()), dtype=np.float32)
    t0 = time.time()
    while len(done) < len(texts):
        chunk = texts[len(done):len(done) + 256]
        e = m.encode([prefix + x for x in chunk], batch_size=64, normalize_embeddings=True)
        done = np.vstack([done, e.astype(np.float32)])
        np.save(f, done)
        print(f"{len(done)}/{len(texts)} {time.time() - t0:.0f}s", flush=True)
elif mode == "eval":
    model_id = sys.argv[2]
    E = np.load(f"{W}/emb/{model_id.replace('/', '__')}.npy")
    clf = LogisticRegression(C=10, max_iter=3000).fit(E[tr], y[tr])
    report(f"embed {model_id} + LR", clf.predict_proba(E[te]), clf.classes_)
