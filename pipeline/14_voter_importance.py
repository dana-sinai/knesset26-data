"""Step 14 (run when public/data/voter_profile.json changes): how much each CBS characteristic explains of the differences
between local authorities in each list's share of the vote — relative importance (LMG / Shapley decomposition of R²).

Why not regression coefficients: many characteristics overlap (education, wage, the CBS index; children, median age), and
a coefficient "with all the others held constant" can then be large, small or even flip sign for reasons of overlap alone.
LMG averages, over every order of adding the characteristics to the model, how much R² grows when each one is added.
Shared variance is split between the characteristics that share it, and the parts add up to the model's R².
The four origin groups (Europe/Asia/Africa/America) enter as one item ("family origin"), since they are parts of one whole.
Weighted least squares, weights = valid votes. Characteristics missing for more than 10% of the authorities in a sector are
left out of that sector's model. Turnout is not used (it is part of the vote itself).

Writes voter_profile.json["importance"][sector][party] = {r2, n, items: [[key, share, r2_alone, r_alone]]}: share = its
part of R² in the full model; r2_alone = R² of that item by itself; r_alone = weighted correlation of a single
characteristic with the vote share (direction), None for the origin group.
"""
import json, itertools
from math import factorial
import numpy as np

P = "public/data/voter_profile.json"
d = json.load(open(P, encoding="utf-8"))
ORIGIN = ["c_africa", "c_asia", "c_europe", "c_america"]
VARS = [k for k in d["vars"] if k != "t26"]
SECTORS = list(d["sectors"]) + ["all"]
MIN_SHARE = 0.01  # of the vote, in the sector
out = {}


def wcorr(x, y, w):
    mx, my = np.average(x, weights=w), np.average(y, weights=w)
    return float((w * (x - mx) * (y - my)).sum() / np.sqrt((w * (x - mx) ** 2).sum() * (w * (y - my) ** 2).sum()))


for sec in SECTORS:
    rows = [r for r in d["rows"] if sec == "all" or r["g"] == sec]
    keys = [k for k in VARS if sum(r["x"].get(k) is None for r in rows) <= len(rows) * 0.1]
    rows = [r for r in rows if all(r["x"].get(k) is not None for k in keys)]
    if len(rows) < 15:
        continue
    items = [[k] for k in keys if k not in ORIGIN]
    orig = [k for k in keys if k in ORIGIN]
    if orig:
        items.append(orig)
    names = ["origin" if it == orig else it[0] for it in items]
    w = np.array([r["v"] for r in rows], float)
    X = {k: np.array([r["x"][k] for r in rows], float) for k in keys}
    tot = w.sum()
    parties = {p for r in rows for p in r["s"]}
    out[sec] = {}
    for p in sorted(parties):
        y = np.array([r["s"].get(p) or 0 for r in rows], float)
        if (w * y).sum() / tot / 100 < MIN_SHARE:
            continue
        ym = np.average(y, weights=w)
        sst = (w * (y - ym) ** 2).sum()
        W = np.sqrt(w)
        cache = {}

        def r2(S):
            S = frozenset(S)
            if S not in cache:
                if not S:
                    cache[S] = 0.0
                else:
                    cols = [k for i in S for k in items[i]]
                    A = np.c_[np.ones(len(y)), np.array([X[k] for k in cols]).T]
                    b = np.linalg.lstsq(A * W[:, None], y * W, rcond=None)[0]
                    cache[S] = 1 - float((w * (y - A @ b) ** 2).sum() / sst)
            return cache[S]

        n = len(items)
        fact = [factorial(i) for i in range(n + 1)]
        share = []
        for i in range(n):
            others = [j for j in range(n) if j != i]
            s = 0.0
            for k in range(n):
                wk = fact[k] * fact[n - k - 1] / fact[n]
                for S in itertools.combinations(others, k):
                    s += wk * (r2(set(S) | {i}) - r2(S))
            share.append(s)
        full = r2(range(n))
        res = sorted(([names[i], round(share[i], 4), round(r2({i}), 4), None if names[i] == "origin" else round(wcorr(X[names[i]], y, w), 3)]
                      for i in range(n)), key=lambda t: -t[1])
        out[sec][p] = dict(r2=round(full, 4), n=len(rows), items=res)
        print(sec, p, f"R2={full:.2f}", [(a, round(b, 2), round(c, 2)) for a, b, c, _ in res[:4]])

d["importance"] = out
d["importance_vars"] = {"origin": "מוצא משפחתי (אירופה, אסיה, אפריקה, אמריקה)"}
json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
