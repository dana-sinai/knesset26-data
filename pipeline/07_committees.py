"""Committee activity for returning MKs.

Inputs (oKnesset mirror of the Knesset open data):
  raw/ok/mk_individual.csv              mk_individual_id <-> PersonID
  raw/ok/mk_individual_committees.csv   membership periods (committee, role, start, finish, knesset)
  raw/ok/cmt_sessions_att.csv           every committee session, with topics / bills on the agenda and the MKs
                                        listed as attending in the published protocol (attended_mk_individual_ids)
Outputs:
  public/data/committees/summary.json   per PersonID: per Knesset, per committee — role, sessions held while a member
                                        (with a published protocol), sessions attended; plus sessions attended elsewhere
  public/data/committees/mk_{pid}.json  sessions the MK attended: [date, knesset, committee, topic, url]
Notes:
  * Attendance comes from the protocol's attendee list. Sessions without a parsed protocol are excluded from both
    the numerator and the denominator.
  * Committees do not publish named votes, so there is no per-MK committee voting record.
"""
import ast, json, os
import pandas as pd

RAW = "pipeline/raw/ok"
OUT = "public/data/committees"
os.makedirs(OUT, exist_ok=True)

mks = json.load(open("public/data/mks.json"))
pids = {int(m["person_id"]) for m in mks if m.get("person_id")}

ind = pd.read_csv(f"{RAW}/mk_individual.csv", usecols=["mk_individual_id", "PersonID"])
ind2pid = dict(zip(ind.mk_individual_id.astype(int), ind.PersonID.astype(int)))
want_ind = {i for i, p in ind2pid.items() if p in pids}

mem = pd.read_csv(f"{RAW}/mk_individual_committees.csv")
mem = mem[mem.mk_individual_id.isin(want_ind)].copy()
mem["pid"] = mem.mk_individual_id.map(ind2pid)
mem["start"] = pd.to_datetime(mem.start_date, errors="coerce")
mem["finish"] = pd.to_datetime(mem.finish_date, errors="coerce").fillna(pd.Timestamp("2100-01-01"))

cols = ["CommitteeSessionID", "KnessetNum", "CommitteeID", "committee_name", "StartDate", "TypeDesc",
        "SessionUrl", "topics", "bill_names", "attended_mk_individual_ids"]
s = pd.read_csv(f"{RAW}/cmt_sessions_att.csv", usecols=cols, low_memory=False)
s["date"] = pd.to_datetime(s.StartDate, errors="coerce")


def parse_list(x):
    if not isinstance(x, str) or not x.startswith("["):
        return []
    try:
        return ast.literal_eval(x)
    except Exception:
        return []


s["att"] = s.attended_mk_individual_ids.map(parse_list)
s = s[s.att.map(len) > 0].copy()  # only sessions whose protocol lists attendees
print("sessions with attendance:", len(s), "Knessets:", sorted(s.KnessetNum.dropna().unique().astype(int)))


def topic_of(r):
    t = parse_list(r.topics) or parse_list(r.bill_names)
    t = [str(x).strip() for x in t if str(x).strip()]
    if not t:
        return ""
    head = t[0][:160]
    return head + (f" (+{len(t) - 1} נושאים)" if len(t) > 1 else "")


# ---- sessions each MK attended
ex = s[["CommitteeSessionID", "KnessetNum", "CommitteeID", "committee_name", "date", "SessionUrl", "topics", "bill_names", "att"]].explode("att")
ex = ex[ex.att.isin(want_ind)].copy()
ex["pid"] = ex.att.astype(int).map(ind2pid)
ex["topic"] = ex.apply(topic_of, axis=1)

for pid, g in ex.groupby("pid"):
    g = g.sort_values("date", ascending=False)
    rows = [[d.strftime("%Y-%m-%d") if pd.notna(d) else "", int(k) if pd.notna(k) else None, c, t, u if isinstance(u, str) else ""]
            for d, k, c, t, u in zip(g.date, g.KnessetNum, g.committee_name, g.topic, g.SessionUrl)]
    json.dump(rows, open(f"{OUT}/mk_{pid}.json", "w"), ensure_ascii=False, separators=(",", ":"))

# ---- membership × attendance
by_cmt = {cid: g for cid, g in s.groupby("CommitteeID")}
summary = {}
for r in mem.itertuples():
    g = by_cmt.get(r.committee_id)
    held = att = 0
    if g is not None:
        w = g[(g.date >= r.start) & (g.date <= r.finish)]
        held = len(w)
        att = int(w.att.map(lambda a: r.mk_individual_id in a).sum())
    k = str(int(r.knesset)) if pd.notna(r.knesset) else "?"
    rec = summary.setdefault(str(r.pid), {}).setdefault(k, {"committees": {}, "attended_total": 0})
    c = rec["committees"].setdefault(r.committee_name, {"role": r.position_name, "held": 0, "attended": 0,
                                                       "from": str(r.start_date)[:10], "to": "" if pd.isna(r.finish_date) else str(r.finish_date)[:10]})
    if "יו" in str(r.position_name):
        c["role"] = r.position_name
    c["held"] += held
    c["attended"] += att

tot = ex.groupby(["pid", "KnessetNum"]).size()
for (pid, k), n in tot.items():
    summary.setdefault(str(pid), {}).setdefault(str(int(k)), {"committees": {}, "attended_total": 0})["attended_total"] = int(n)

json.dump(summary, open(f"{OUT}/summary.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("MKs with committee data:", len(summary), "| per-MK session files:", ex.pid.nunique())
