"""Step 9: what MKs and parties do in practice, by topic (run after 02, 05, 08).

Inputs
  work/bills_to_classify.csv          BillID, KnessetNum, Name, norm (bills voted on since K16 or initiated by a current MK)
  work/topics/names.json + out_*.tsv  topic per normalised bill name (AI-assisted classification of titles, spot-checked)
  input/bill_topics_extra.tsv         topics for bills added later (BillID, primary, secondary) — written by the daily job
  input/vote_meaning.json             optional: vote_id -> one factual line "בעד = …" (what a yes vote does)
  public/data/votes/meta_k*.json      plenum vote headers (item_id = BillID for bill votes)
  public/data/votes/mk_{pid}.json     each returning MK's votes
  public/data/bills/mk_{pid}.json     bills each MK initiated
Outputs (public/data/topics/)
  topics.json        topic codes, Hebrew labels, counts, definitions
  bill_topics.json   BillID -> [primary, secondary]
  mk_{pid}.json      initiated-by-topic, contested whole-bill votes by topic, agreement with today's parties
  party_{id}.json    the same, aggregated over the party's returning members
  clusters.json      per topic: 2-D map of returning MKs from their votes alone (no party input), clusters,
                     each cluster's party make-up, and the bills that most separate the clusters
Definitions
  whole-bill vote    a plenum vote on a bill as a whole (preliminary / first reading, or final approval);
                     votes on clauses, reservations and procedure are excluded
  contested          at least 20 MKs voted for/against and each side had at least 25% of them
  agreement          share of contested whole-bill votes in which the MK voted like the majority of today's
                     party members who voted (the MK themself excluded)
"""
import glob, json, os, re
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

D = "public/data"
OUT = f"{D}/topics"
os.makedirs(OUT, exist_ok=True)

TOPICS = {
    "security": "ביטחון וצבא", "foreign": "יחסי חוץ", "justice": "מערכת המשפט", "criminal": "פלילים, משטרה ואכיפה",
    "religion": "דת ומדינה", "governance": "משילות, בחירות וכנסת", "economy": "כלכלה, מסים ותקציב",
    "consumer": "צרכנות", "welfare": "רווחה וביטחון סוציאלי", "labor": "עבודה ותעסוקה", "housing": "דיור, תכנון ומקרקעין",
    "health": "בריאות", "education": "חינוך והשכלה גבוהה", "environment": "סביבה, אנרגיה ומים",
    "transport": "תחבורה ובטיחות בדרכים", "arab": "החברה הערבית", "settlement": "יהודה ושומרון והתיישבות",
    "rights": "זכויות אדם ושוויון", "immigration": "עלייה, הגירה ואזרחות", "heritage": "הנצחה, מורשת ותרבות",
    "local": "שלטון מקומי", "media": "תקשורת", "agriculture": "חקלאות", "other": "אחר",
}

# ---------------- bill -> topic
names = {x["id"]: x["name"] for x in json.load(open("pipeline/work/topics/names.json"))}
topic_of_name = {}
for f in sorted(glob.glob("pipeline/work/topics/out_[0-9].tsv")):
    for line in open(f, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) < 2 or not p[0].strip().isdigit() or int(p[0]) not in names:
            continue
        prim = p[1].strip() if p[1].strip() in TOPICS else "other"
        sec = p[2].strip() if len(p) > 2 and p[2].strip() in TOPICS and p[2].strip() != prim else None
        topic_of_name[names[int(p[0])]] = [prim, sec]
bills = pd.read_csv("pipeline/work/bills_to_classify.csv")
bill_topic = {int(r.BillID): topic_of_name.get(r.norm, ["other", None]) for r in bills.itertuples()}
bill_name = {int(r.BillID): str(r.Name) for r in bills.itertuples()}
extra = "pipeline/input/bill_topics_extra.tsv"
if os.path.exists(extra):
    for line in open(extra, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 2 and p[0].isdigit() and p[1] in TOPICS:
            bill_topic[int(p[0])] = [p[1], p[2] if len(p) > 2 and p[2] in TOPICS else None]
            if len(p) > 3 and p[3]:
                bill_name.setdefault(int(p[0]), p[3])
# bills that appeared since the classification (new votes or new bills by current MKs) -> list for the daily job
kb = pd.read_csv("pipeline/raw/ok/kns_bill.csv", usecols=["BillID", "KnessetNum", "Name"], low_memory=False)
kb_name = dict(zip(kb.BillID.astype(int), kb.Name.astype(str)))
seen_items = set()
for f in glob.glob(f"{D}/votes/meta_k*.json"):
    seen_items |= {int(v[7]) for v in json.load(open(f))["votes"] if v[7] is not None}
for f in glob.glob(f"{D}/bills/mk_*.json"):
    seen_items |= {int(b["bill_id"]) for b in json.load(open(f))}
new_bills = sorted(b for b in seen_items if b in kb_name and b not in bill_topic)
with open("pipeline/work/new_bills_unclassified.tsv", "w", encoding="utf-8") as fh:
    for b in new_bills:
        fh.write(f"{b}\t{kb_name[b]}\n")
        bill_name[b] = kb_name[b]
print("new bills waiting for a topic:", len(new_bills))
json.dump(bill_topic, open(f"{OUT}/bill_topics.json", "w"), separators=(",", ":"))
meaning = json.load(open("pipeline/input/vote_meaning.json")) if os.path.exists("pipeline/input/vote_meaning.json") else {}
json.dump(meaning, open(f"{OUT}/vote_meaning.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("bills with topic:", len(bill_topic), "| unclassified names:", sum(1 for n in set(bills.norm) if n not in topic_of_name))

# ---------------- whole-bill votes
WHOLE = re.compile(r"^(אישור החוק|קריאה שלישית|להעביר את הצעת החוק לוועדה.*|קריאה ראשונה|קריאה טרומית|)$")
rows = []
for f in glob.glob(f"{D}/votes/meta_k*.json"):
    k = int(re.search(r"meta_k(\d+)", f).group(1))
    for v in json.load(open(f))["votes"]:
        vid, dt, title, subject, fo, ag, ab, item = v[:8]
        if item is None or int(item) not in bill_topic:
            continue
        if not WHOLE.match((subject or "").strip()):
            continue
        sj = (subject or "").strip()
        stage = "final" if sj in ("אישור החוק", "קריאה שלישית") else ("whole" if sj == "" else "early")
        rows.append(dict(vid=vid, k=k, dt=dt[:10], bill=int(item), stage=stage, f=fo, a=ag, ab=ab))
V = pd.DataFrame(rows)
V["n"] = V.f + V.a
V["contested"] = (V.n >= 20) & (V.a / V.n.clip(lower=1) >= 0.25) & (V.f / V.n.clip(lower=1) >= 0.25)
V["topic"] = V.bill.map(lambda b: bill_topic[b][0])
V["topic2"] = V.bill.map(lambda b: bill_topic[b][1])
C = V[V.contested].copy()
C.to_csv("pipeline/work/contested_votes.csv", index=False)
print("whole-bill votes:", len(V), "| contested:", len(C), "| by stage:", C.stage.value_counts().to_dict())

# ---------------- MKs
mks = json.load(open(f"{D}/mks.json"))
parties = {p["id"]: p for p in json.load(open(f"{D}/parties.json"))}
ret = [m for m in mks if m.get("person_id") and os.path.exists(f"{D}/votes/mk_{m['person_id']}.json")]
pid_party = {int(m["person_id"]): m["party"] for m in ret}
vote_of = {}  # pid -> {vid: code}
for m in ret:
    pid = int(m["person_id"])
    vote_of[pid] = {a: b for a, b in json.load(open(f"{D}/votes/mk_{pid}.json")) if b in (1, 2, 3)}

cvids = set(C.vid)
M = pd.DataFrame([(pid, vid, c) for pid, d in vote_of.items() for vid, c in d.items() if vid in cvids],
                 columns=["pid", "vid", "c"])
M["party"] = M.pid.map(pid_party)
cnt = M[M.c.isin([1, 2])].groupby(["vid", "party", "c"]).size().unstack(fill_value=0)
cnt = cnt.reindex(columns=[1, 2], fill_value=0)
cnt_d = {key: (int(r[1]), int(r[2])) for key, r in cnt.iterrows()}


def party_majority(vid, party, exclude_code=None):
    fa = cnt_d.get((vid, party))
    if not fa:
        return None
    f_, a_ = fa
    if exclude_code == 1:
        f_ -= 1
    elif exclude_code == 2:
        a_ -= 1
    if f_ + a_ < 1 or f_ == a_:
        return None
    return 1 if f_ > a_ else 2


Cidx = C.set_index("vid")
agree = {}
for pid in vote_of:
    mine = M[(M.pid == pid) & M.c.isin([1, 2])]
    res = {}
    for party in parties:
        hit = tot = 0
        for vid, c in zip(mine.vid, mine.c):
            maj = party_majority(vid, party, exclude_code=c if pid_party[pid] == party else None)
            if maj is None:
                continue
            tot += 1
            hit += maj == c
        if tot >= 30:
            res[party] = dict(rate=round(hit / tot, 3), n=tot)
    agree[pid] = res

# ---------------- per-MK and per-party files
init_topics = {}
for m in mks:
    if not m.get("person_id"):
        continue
    pid = int(m["person_id"])
    f = f"{D}/bills/mk_{pid}.json"
    c = Counter()
    if os.path.exists(f):
        for b in json.load(open(f)):
            if b.get("is_initiator"):
                c[bill_topic.get(b["bill_id"], ["other"])[0]] += 1
    init_topics[pid] = c

Crows = list(C.itertuples())


def vote_list(pid):
    d = vote_of.get(pid, {})
    out = defaultdict(list)
    for r in Crows:
        code = d.get(r.vid)
        if code in (1, 2, 3):
            out[r.topic].append([r.vid, r.k, r.dt, bill_name.get(r.bill, ""), r.stage, code, int(r.f), int(r.a), meaning.get(str(r.vid)), int(r.bill)])
    for t in out:
        out[t].sort(key=lambda x: x[2], reverse=True)
    return out


for m in mks:
    if not m.get("person_id"):
        continue
    pid = int(m["person_id"])
    if pid not in vote_of and not init_topics.get(pid):
        continue
    vl = vote_list(pid)
    json.dump(dict(initiated=dict(init_topics.get(pid, {})),
                   votes={t: dict(for_=sum(1 for x in v if x[5] == 1), against=sum(1 for x in v if x[5] == 2),
                                  abstain=sum(1 for x in v if x[5] == 3), list=v) for t, v in vl.items()},
                   agreement=agree.get(pid, {})),
              open(f"{OUT}/mk_{pid}.json", "w"), ensure_ascii=False, separators=(",", ":"))

for party in parties:
    members = [int(m["person_id"]) for m in mks if m["party"] == party and m.get("person_id")]
    voters = [p for p in members if p in vote_of]
    ini = Counter()
    for p in members:
        ini.update(init_topics.get(p, {}))
    by_topic = defaultdict(list)
    for (vid, pty), (f_, a_) in cnt_d.items():
        if pty != party or vid not in Cidx.index:
            continue
        r = Cidx.loc[vid]
        by_topic[r["topic"]].append([int(vid), int(r["k"]), r["dt"], bill_name.get(int(r["bill"]), ""), r["stage"], f_, a_, int(r["f"]), int(r["a"]), meaning.get(str(vid)), int(r["bill"])])
    for t in by_topic:
        by_topic[t].sort(key=lambda x: x[2], reverse=True)
    json.dump(dict(members_with_record=len(voters), initiated=dict(ini), votes=by_topic),
              open(f"{OUT}/party_{party}.json", "w"), ensure_ascii=False, separators=(",", ":"))


# ---------------- clusters per topic (votes only; party is added afterwards, for reading)
def mds2(dist):
    n = dist.shape[0]
    J = np.eye(n) - np.ones((n, n)) / n
    B = -0.5 * J @ (dist ** 2) @ J
    w, v = np.linalg.eigh(B)
    idx = np.argsort(w)[::-1][:2]
    return v[:, idx] * np.sqrt(np.maximum(w[idx], 0))


def cluster_topic(vids, min_votes=15, min_shared=10):
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score
    sub = M[M.vid.isin(vids)]
    piv = sub.pivot_table(index="pid", columns="vid", values="c", aggfunc="first")
    piv = piv.map(lambda c: 1.0 if c == 1 else (-1.0 if c == 2 else np.nan))
    piv = piv[piv.notna().sum(axis=1) >= min_votes]
    if len(piv) < 8:
        return None
    X = piv.values
    n = len(piv)
    obs = ~np.isnan(X)
    Xf = np.nan_to_num(X)
    shared = obs.astype(int) @ obs.astype(int).T
    same = ((Xf[:, None, :] == Xf[None, :, :]) & obs[:, None, :] & obs[None, :, :]).sum(axis=2)
    with np.errstate(invalid="ignore", divide="ignore"):
        dist = np.where(shared >= min_shared, 1 - same / shared, 0.5)
    np.fill_diagonal(dist, 0)
    xy = mds2(dist)
    best, lab = -1, np.zeros(n, int)
    for kk in (2, 3, 4):
        if n <= kk:
            continue
        l = AgglomerativeClustering(n_clusters=kk, metric="precomputed", linkage="average").fit_predict(dist)
        if len(set(l)) < 2:
            continue
        s = silhouette_score(dist, l, metric="precomputed")
        if s > best + 0.02:
            best, lab = s, l
    order = {c: i for i, (c, _) in enumerate(Counter(lab).most_common())}
    lab = np.array([order[c] for c in lab])
    pids = list(piv.index)
    clusters = []
    for c in sorted(set(lab)):
        mem = [pids[i] for i in range(n) if lab[i] == c]
        comp = Counter(pid_party[p] for p in mem)
        clusters.append(dict(id=int(c), size=len(mem), parties=[[p, k] for p, k in comp.most_common()]))
    sig = []
    if len(set(lab)) >= 2:
        share, nvot = {}, {}
        for c in set(lab):
            rows_ = piv.iloc[[i for i in range(n) if lab[i] == c]]
            nvot[c] = rows_.notna().sum()
            share[c] = ((rows_ == 1).sum() / nvot[c].replace(0, np.nan))
        for vid in piv.columns:
            vals = [share[c].get(vid) for c in sorted(share)]
            # only bills on which every cluster had at least 5 voters (otherwise one or two people decide the share)
            if any(pd.isna(x) for x in vals) or min(int(nvot[c].get(vid, 0)) for c in share) < 5:
                continue
            r = Cidx.loc[vid]
            sig.append((max(vals) - min(vals), int(vid), int(r["k"]), r["dt"], bill_name.get(int(r["bill"]), ""), r["stage"],
                        [round(float(x), 2) for x in vals], meaning.get(str(vid)), int(r["bill"])))
        sig.sort(key=lambda x: (-round(x[0], 1), -int(x[3][:4])))
        seen, uniq = set(), []
        for x in sig:
            if x[4] in seen:
                continue
            seen.add(x[4])
            uniq.append(x)
        sig = uniq
    return dict(points=[[int(pids[i]), round(float(xy[i, 0]), 3), round(float(xy[i, 1]), 3), int(lab[i]),
                         int(obs[i].sum())] for i in range(n)],
                clusters=clusters, silhouette=round(float(best), 3) if best > -1 else None,
                separating=[list(x[1:]) for x in sig[:12]], n_votes=int(piv.shape[1]))


clusters = {}
for t in TOPICS:
    vids = set(C[(C.topic == t) | (C.topic2 == t)].vid)
    if len(vids) >= 25:
        r = cluster_topic(vids)
        if r:
            clusters[t] = r
clusters["all"] = cluster_topic(set(C.vid), min_votes=40, min_shared=25)
json.dump(clusters, open(f"{OUT}/clusters.json", "w"), ensure_ascii=False, separators=(",", ":"))

tc = Counter(t for t, _ in bill_topic.values())
vc = C.topic.value_counts().to_dict()
json.dump(dict(labels=TOPICS, bills=dict(tc), contested_votes={k: int(v) for k, v in vc.items()},
               definitions=dict(contested="לפחות 20 מצביעים בעד ונגד, ולפחות רבע מהם בכל צד",
                                whole_bill="הצבעה על הצעת חוק בשלמותה (קריאה טרומית, קריאה ראשונה או אישור סופי) – לא על סעיפים או הסתייגויות",
                                agreement="חלק ההצבעות השנויות במחלוקת שבהן הצביע/ה כמו רוב חברי המפלגה (בהרכבה הנוכחי) שהצביעו בהן")),
          open(f"{OUT}/topics.json", "w"), ensure_ascii=False)
print("topics with clusters:", list(clusters))

# ---------------- add the per-MK topic numbers to mks.json, so the list page can filter on them
for m in mks:
    pid = int(m["person_id"]) if m.get("person_id") else None
    m["initiated_topics"] = dict(init_topics.get(pid, {})) if pid else {}
    m["agreement"] = {p: v["rate"] for p, v in agree.get(pid, {}).items()} if pid else {}
json.dump(mks, open(f"{D}/mks.json", "w"), ensure_ascii=False)
print("mks.json: added initiated_topics and agreement")

# ---------------- official law summaries (KNS_Bill.SummaryLaw, written by the Knesset) for the bills on the site
kbs = pd.read_csv("pipeline/raw/ok/kns_bill.csv", usecols=["BillID", "SummaryLaw"], low_memory=False)
kbs = kbs[kbs.SummaryLaw.notna() & kbs.BillID.isin(list(bill_topic))]
json.dump({int(b): str(s).strip() for b, s in zip(kbs.BillID, kbs.SummaryLaw)},
          open(f"{OUT}/bill_summary.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("official law summaries:", len(kbs))
