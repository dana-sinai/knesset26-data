"""Step 2: parliamentary record for every elected MK who served before (Knesset 20-25).

Sources (official Knesset OData tables, via the oKnesset mirror production.oknesset.org,
plus the ZeAlenu/knesset-data mirror on Hugging Face for lookup tables):
  kns_persontoposition, kns_plenumvote, kns_plenumvoteresult, kns_bill, kns_billinitiator,
  KNS_Status, KNS_KnessetDates
Outputs (public/data/):
  parliament.json            per PersonID: terms, factions, gov roles, Knesset roles, committees, vote stats
  votes/meta_k{N}.json       vote headers per Knesset (id, date, title, subject, totals, accepted)
  votes/mk_{PersonID}.json   that MK's votes: [[vote_id, code]] code 1=for 2=against 3=abstain 4=present
  bills/mk_{PersonID}.json   bills the MK initiated (K20-25)
"""
import os, json, glob
import pandas as pd
import numpy as np

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, "..", "public", "data")
for d in ("", "votes", "bills"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
RAW = f"{ROOT}/raw"
KMIN = 20

def hf(table):
    rows = []
    for f in sorted(glob.glob(f"{RAW}/hf/data/{table}/*.jsonl")):
        rows += [json.loads(l) for l in open(f)]
    return pd.DataFrame(rows)

roster = pd.read_csv(f"{ROOT}/work/roster_matched.csv")
pids = set(int(p) for p in roster.PersonID.dropna())

# ---------- Knesset term dates
kd = hf("KNS_KnessetDates")
kd["Start"] = pd.to_datetime(kd.PlenumStart.str[:10])
kd["Finish"] = pd.to_datetime(kd.PlenumFinish.str[:10], errors="coerce")
kterm = kd.groupby("KnessetNum").agg(start=("Start", "min"), finish=("Finish", "max")).reset_index()
kterm.loc[kterm.KnessetNum == 25, "finish"] = pd.Timestamp("2026-07-31")

def knesset_of(dates):
    k = pd.Series(np.nan, index=dates.index)
    for _, r in kterm.iterrows():
        k[(dates >= r.start) & ((dates <= r.finish) | pd.isna(r.finish))] = r.KnessetNum
    return k

# ---------- positions
p2p = pd.read_csv(f"{RAW}/ok/kns_persontoposition.csv", low_memory=False)
p2p = p2p[p2p.PersonID.isin(pids)].copy()
p2p["start"] = p2p.StartDate.str[:10]
p2p["finish"] = p2p.FinishDate.str[:10]
pos_names = hf("KNS_Position").set_index("Id").Description.to_dict()
GOV = {31, 39, 40, 45, 50, 51, 57, 59, 65, 73}
KNESSET_ROLES = {29, 30, 48, 70, 71, 122, 123, 130, 131}
CMT = {41: "chair", 42: "member", 66: "member", 67: "alternate"}

parl = {}
for pid, g in p2p.groupby("PersonID"):
    terms = sorted(set(int(k) for k in g[g.PositionID.isin([43, 61])].KnessetNum.dropna()))
    rec = dict(terms=terms, factions=[], gov_roles=[], knesset_roles=[], committees=[])
    for _, r in g.sort_values("start").iterrows():
        base = dict(knesset=None if pd.isna(r.KnessetNum) else int(r.KnessetNum), start=r.start,
                    finish=None if pd.isna(r.finish) else r.finish)
        if r.PositionID == 54 and pd.notna(r.FactionName):
            rec["factions"].append(dict(base, faction=str(r.FactionName).strip(), faction_id=r.FactionID))
        elif r.PositionID in GOV:
            title = pos_names.get(r.PositionID, "")
            if pd.notna(r.GovMinistryName):
                title = f"{title} – {r.GovMinistryName}" if r.PositionID not in (45,) else title
            if pd.notna(r.DutyDesc):
                title = str(r.DutyDesc)
            rec["gov_roles"].append(dict(base, role=title, ministry=None if pd.isna(r.GovMinistryName) else r.GovMinistryName,
                                         government=None if pd.isna(r.GovernmentNum) else int(r.GovernmentNum)))
        elif r.PositionID in KNESSET_ROLES:
            rec["knesset_roles"].append(dict(base, role=pos_names.get(r.PositionID, str(r.PositionID))))
        elif r.PositionID in CMT and pd.notna(r.CommitteeName):
            rec["committees"].append(dict(base, committee=str(r.CommitteeName).strip(),
                                          committee_id=None if pd.isna(r.CommitteeID) else int(r.CommitteeID),
                                          role=CMT[r.PositionID]))
    parl[int(pid)] = rec

# serving intervals (for attendance denominators)
serve = p2p[p2p.PositionID.isin([43, 61])][["PersonID", "KnessetNum", "start", "finish"]].copy()
serve["s"] = pd.to_datetime(serve.start)
serve["f"] = pd.to_datetime(serve.finish).fillna(pd.Timestamp("2026-07-31"))
fac = p2p[p2p.PositionID == 54][["PersonID", "FactionName", "start", "finish"]].copy()
fac["s"] = pd.to_datetime(fac.start)
fac["f"] = pd.to_datetime(fac.finish).fillna(pd.Timestamp("2026-07-31"))

# ---------- votes
votes = pd.read_csv(f"{RAW}/ok/kns_plenumvote.csv", low_memory=False)
votes["dt"] = pd.to_datetime(votes.VoteDateTime.str[:19])
votes["knesset"] = knesset_of(votes.dt)
votes = votes[votes.knesset >= KMIN].copy()

res = pd.read_parquet(f"{RAW}/ok/plenumvoteresult.parquet") if os.path.exists(f"{RAW}/ok/plenumvoteresult.parquet") \
    else pd.read_csv(f"{RAW}/ok/kns_plenumvoteresult.csv", usecols=["MkId", "VoteID", "VoteDate", "ResultCode", "ResultDesc"])
res = res[res.VoteID.isin(votes.Id)].copy()
code = {"בעד": 1, "נגד": 2, "נמנע": 3, "נוכח": 4, "הצביע": 4}
res["c"] = res.ResultDesc.map(code).fillna(4).astype(int)
tot = res.pivot_table(index="VoteID", columns="c", values="MkId", aggfunc="count", fill_value=0)
votes = votes.join(tot, on="Id")
for c in (1, 2, 3):
    if c not in votes:
        votes[c] = 0

for k, g in votes.groupby("knesset"):
    meta = [[int(r.Id), r.VoteDateTime[:16], str(r.VoteTitle or ""), str(r.VoteSubject or ""),
             int(r[1]), int(r[2]), int(r[3]), int(r.ItemID) if pd.notna(r.ItemID) else None,
             bool(r.IsNoConfidenceInGov) if str(r.IsNoConfidenceInGov) in ("True", "False", "1", "0") else False]
            for _, r in g.sort_values("dt").iterrows()]
    json.dump(dict(fields=["id", "datetime", "title", "subject", "for", "against", "abstain", "item_id", "no_confidence"],
                   votes=meta), open(f"{OUT}/votes/meta_k{int(k)}.json", "w"), ensure_ascii=False, separators=(",", ":"))

# faction majority per vote (party-line conformity): assign each voter to faction at vote time
vd = votes.set_index("Id").dt
res["dt"] = res.VoteID.map(vd)
allfac = pd.read_csv(f"{RAW}/ok/kns_persontoposition.csv", low_memory=False)
allfac = allfac[(allfac.PositionID == 54) & (allfac.KnessetNum >= KMIN)][["PersonID", "FactionName", "StartDate", "FinishDate"]].copy()
allfac["s"] = pd.to_datetime(allfac.StartDate.str[:10])
allfac["f"] = pd.to_datetime(allfac.FinishDate.str[:10]).fillna(pd.Timestamp("2026-07-31"))
m = res[res.c.isin([1, 2, 3])].merge(allfac, left_on="MkId", right_on="PersonID", how="left")
m = m[(m.dt >= m.s) & (m.dt <= m.f + pd.Timedelta(days=1))]
m = m.drop_duplicates(["VoteID", "MkId"])
maj = (m.groupby(["VoteID", "FactionName", "c"]).size().rename("n").reset_index()
       .sort_values("n", ascending=False).drop_duplicates(["VoteID", "FactionName"]))
maj = maj.rename(columns={"c": "faction_c", "n": "faction_n"})
m = m.merge(maj, on=["VoteID", "FactionName"], how="left")
fsize = m.groupby(["VoteID", "FactionName"]).size().rename("fsize")
m = m.join(fsize, on=["VoteID", "FactionName"])
m["with_faction"] = np.where(m.fsize >= 2, m.c == m.faction_c, np.nan)

vk = votes.set_index("Id").knesset
for pid in pids:
    mine = res[res.MkId == pid]
    if mine.empty:
        continue
    json.dump([[int(a), int(b)] for a, b in zip(mine.VoteID, mine.c)],
              open(f"{OUT}/votes/mk_{pid}.json", "w"), separators=(",", ":"))
    stats = {}
    mm = m[m.MkId == pid]
    for k in sorted(set(mine.VoteID.map(vk).dropna().astype(int))):
        sv = serve[(serve.PersonID == pid) & (serve.KnessetNum == k)]
        held = votes[(votes.knesset == k)]
        mask = np.zeros(len(held), bool)
        for _, s in sv.iterrows():
            mask |= ((held.dt >= s.s) & (held.dt <= s.f + pd.Timedelta(days=1))).values
        eligible = int(mask.sum())
        mk_k = mine[mine.VoteID.map(vk) == k]
        cast = int(mk_k.c.isin([1, 2, 3]).sum())
        wf = mm[mm.VoteID.map(vk) == k].with_faction.dropna()
        stats[str(k)] = dict(votes_held_while_serving=eligible, votes_recorded=int(len(mk_k)), votes_cast=cast,
                             for_=int((mk_k.c == 1).sum()), against=int((mk_k.c == 2).sum()), abstain=int((mk_k.c == 3).sum()),
                             participation=round(cast / eligible, 3) if eligible else None,
                             with_faction_rate=round(float(wf.mean()), 4) if len(wf) else None,
                             with_faction_n=int(len(wf)))
    parl.setdefault(pid, dict(terms=[], factions=[], gov_roles=[], knesset_roles=[], committees=[]))["vote_stats"] = stats

# ---------- bills
bills = pd.read_csv(f"{RAW}/ok/kns_bill.csv", low_memory=False)
bills = bills[bills.KnessetNum >= KMIN]
status = hf("KNS_Status").set_index("Id").Desc.to_dict() if "Desc" in hf("KNS_Status").columns else {}
bi = pd.read_csv(f"{RAW}/ok/kns_billinitiator.csv")
bi = bi[bi.PersonID.isin(pids) & bi.BillID.isin(bills.BillID)]
b = bi.merge(bills, on="BillID")
for pid, g in b.groupby("PersonID"):
    lst = []
    for _, r in g.sort_values(["KnessetNum", "BillID"]).iterrows():
        lst.append(dict(bill_id=int(r.BillID), knesset=int(r.KnessetNum), name=str(r.Name),
                        type=str(r.SubTypeDesc) if pd.notna(r.SubTypeDesc) else None,
                        private_number=None if pd.isna(r.PrivateNumber) else int(r.PrivateNumber),
                        status=status.get(int(r.StatusID), None) if pd.notna(r.StatusID) else None,
                        status_id=None if pd.isna(r.StatusID) else int(r.StatusID),
                        publication_date=None if pd.isna(r.PublicationDate) else str(r.PublicationDate)[:10],
                        is_initiator=bool(r.IsInitiator), ordinal=None if pd.isna(r.Ordinal) else int(r.Ordinal)))
    json.dump(lst, open(f"{OUT}/bills/mk_{int(pid)}.json", "w"), ensure_ascii=False, separators=(",", ":"))
    c = g[g.IsInitiator == True]
    parl.setdefault(int(pid), {})["bill_stats"] = {
        str(k): dict(initiated=int((c.KnessetNum == k).sum()), cosponsored=int(((g.KnessetNum == k) & (g.IsInitiator != True)).sum()),
                     passed=int(((c.KnessetNum == k) & (c.StatusID == 118)).sum()))
        for k in sorted(g.KnessetNum.unique().astype(int))}

json.dump(parl, open(f"{OUT}/parliament.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("MKs with records:", len(parl), "| votes K20+:", len(votes), "| per-MK vote files:", len(glob.glob(f"{OUT}/votes/mk_*.json")),
      "| bill files:", len(glob.glob(f"{OUT}/bills/mk_*.json")))
