"""Step 1: parse the elected-MK roster and match each name to a Knesset PersonID.

Inputs : pipeline/input/roster_cec.txt, pipeline/raw/ok/mk_individual.csv,
         pipeline/raw/ok/kns_persontoposition.csv
Output : pipeline/work/roster_matched.csv (+ printed list of ambiguous/unmatched names)
Manual overrides live in pipeline/input/person_overrides.csv (name_he,PersonID or 'NEW').
"""
import re, json, os
import pandas as pd

ROOT = os.path.dirname(__file__)
os.makedirs(f"{ROOT}/work", exist_ok=True)

def norm(s):
    s = str(s).replace("׳", "'").replace("`", "'").replace("״", '"')
    s = re.sub(r"[-–־]", " ", s)
    s = s.replace("'", "").replace('"', "")
    return re.sub(r"\s+", " ", s).strip()

# --- roster
rows = []
for line in open(f"{ROOT}/input/roster_cec.txt", encoding="utf-8"):
    m = re.match(r"^(.+?) \((\d+)\): (.+)$", line.strip())
    if not m:
        continue
    party, seats, rest = m.group(1), int(m.group(2)), m.group(3)
    for item in rest.split("|"):
        pos, name = item.strip().split(" ", 1)
        rows.append(dict(party_he=party, party_seats=seats, list_position=int(pos), name_he=name.strip()))
roster = pd.DataFrame(rows)
assert len(roster) == 120, len(roster)

# --- people
mk = pd.read_csv(f"{ROOT}/raw/ok/mk_individual.csv")
p2p = pd.read_csv(f"{ROOT}/raw/ok/kns_persontoposition.csv", low_memory=False)
mk_terms = (p2p[p2p.PositionID.isin([43, 61])].dropna(subset=["KnessetNum"])
            .groupby("PersonID").KnessetNum.apply(lambda s: sorted(set(int(x) for x in s))))

cands = []
for _, r in mk.iterrows():
    names = {f"{r.FirstName} {r.LastName}"}
    try:
        names |= set(json.loads(r.altnames))
    except Exception:
        pass
    for n in names:
        cands.append((int(r.PersonID), norm(n)))

def score(roster_name, cand):
    rt = norm(roster_name).split()
    ct = cand.split()
    if not ct:
        return 0
    # all candidate tokens must appear in roster name (roster often has middle names)
    if all(t in rt for t in ct):
        return len(ct)
    return 0

out = []
for _, r in roster.iterrows():
    best = {}
    for pid, cn in cands:
        s = score(r.name_he, cn)
        if s >= 2:
            best[pid] = max(best.get(pid, 0), s)
    # prefer people who served recently
    ranked = sorted(best, key=lambda pid: (best[pid], max(mk_terms.get(pid, [0]))), reverse=True)
    recent = [pid for pid in ranked if max(mk_terms.get(pid, [0])) >= 18]
    out.append(dict(**r, candidates=";".join(map(str, ranked[:5])),
                    PersonID=recent[0] if len(recent) == 1 else (ranked[0] if len(ranked) == 1 else None),
                    n_recent=len(recent)))
df = pd.DataFrame(out)

ov_path = f"{ROOT}/input/person_overrides.csv"
if os.path.exists(ov_path):
    ov = pd.read_csv(ov_path, dtype=str)
    for _, o in ov.iterrows():
        df.loc[df.name_he == o.name_he, "PersonID"] = None if o.PersonID == "NEW" else int(o.PersonID)
        df.loc[df.name_he == o.name_he, "override"] = o.PersonID

df["prior_terms"] = df.PersonID.map(lambda p: mk_terms.get(int(p), []) if pd.notna(p) else [])
df.to_csv(f"{ROOT}/work/roster_matched.csv", index=False)
names = mk.set_index("PersonID")
for _, r in df.iterrows():
    c = r.candidates.split(";") if r.candidates else []
    if (pd.isna(r.PersonID) and c) or r.n_recent > 1:
        desc = [f"{p}:{names.loc[int(p)].FirstName} {names.loc[int(p)].LastName} {mk_terms.get(int(p), [])}" for p in c]
        print("CHECK", r.party_he, r.list_position, r.name_he, "->", r.PersonID, desc)
print("matched:", df.PersonID.notna().sum(), "of", len(df))
