"""Final pass over public/data/mks.json (run after 05 and 07).

1. Hebrew: replaces every English profile string with its Hebrew translation from input/translations_he.json
   (an exact-string map; anything not in the map is reported so it can be translated and added).
2. Metrics: adds m.metrics — the numbers the site lets people filter and sort on. All are null for new MKs.
   faction_rate     share of votes cast in which the MK voted like the majority of their faction (weighted by votes)
   participation    votes cast / plenum votes held while serving (all Knessets 20–25 in the data)
   bills_per_k      bills initiated per Knesset served (average over Knessets with data)
   bills_passed     bills initiated that became law (total)
   cmt_rate         committee attendance: sessions attended / sessions held in committees they belonged to
   cmt_per_k        committee sessions attended per Knesset (any committee)
   terms            number of previous Knessets
"""
import json, re

FIX = {  # manual corrections after review
    "IDF Paratroopers Brigade (national service).": 'צה"ל, חטיבת הצנחנים (שירות סדיר).',
}

tr = json.load(open("pipeline/input/translations_he.json"))
tr.update(FIX)
GEN = json.load(open("pipeline/input/translations_he_gendered.json"))  # strings whose Hebrew depends on the MK's gender
mks = json.load(open("public/data/mks.json"))
parl = json.load(open("public/data/parliament.json"))
cmt = json.load(open("public/data/committees/summary.json"))
LAT = re.compile("[A-Za-z]")
missing = set()


def he(s, gender=None):
    if not isinstance(s, str) or not LAT.search(s) or s.startswith("http"):
        return s
    if gender and s in GEN:
        return GEN[s].get(gender) or GEN[s]["male"]
    if s in tr:
        return tr[s]
    missing.add(s)
    return s


for m in mks:
    if m.get("name_he") == "יעקב אשר":  # deputy *mayor* of Bnei Brak (a city, not a council)
        for c in m["career"]:
            if c.get("role") == "Deputy council head":
                c["role"] = "סגן ראש העירייה"
    for e in m["education"]:
        for f in ("degree", "field", "institution"):
            e[f] = he(e.get(f))
    for c in m["career"]:
        for f in ("role", "organization"):
            c[f] = he(c.get(f), m.get("gender"))
    for r in m.get("gov_roles_profile") or []:
        if isinstance(r, dict):
            r["role"] = he(r.get("role"), m.get("gender"))
    for f in ("notes", "family_status", "military_service", "bio_he", "birthplace"):
        m[f] = he(m.get(f), m.get("gender"))
    if m.get("residence"):
        m["residence"]["note"] = he(m["residence"].get("note"))
    m["languages"] = [he(x) for x in (m.get("languages") or [])]
    m["conflicts"] = [he(x) for x in (m.get("conflicts") or [])]

    # ---- metrics
    met = dict(faction_rate=None, participation=None, bills_per_k=None, bills_passed=None,
               cmt_rate=None, cmt_per_k=None, terms=len(m.get("prior_terms") or []))
    p = parl.get(str(m.get("person_id"))) if m.get("person_id") else None
    if p and not m.get("is_new"):
        vs = p.get("vote_stats") or {}
        n_f = sum(v.get("with_faction_n") or 0 for v in vs.values())
        if n_f:
            met["faction_rate"] = round(sum((v.get("with_faction_rate") or 0) * (v.get("with_faction_n") or 0) for v in vs.values()) / n_f, 4)
        held = sum(v.get("votes_held_while_serving") or 0 for v in vs.values())
        if held:
            met["participation"] = round(sum(v.get("votes_cast") or 0 for v in vs.values()) / held, 4)
        bs = p.get("bill_stats") or {}
        ks = [k for k in (m.get("prior_terms") or []) if 20 <= int(k) <= 25]
        if ks:
            met["bills_per_k"] = round(sum((bs.get(str(k)) or {}).get("initiated", 0) for k in ks) / len(ks), 1)
            met["bills_passed"] = sum((bs.get(str(k)) or {}).get("passed", 0) for k in ks)
        cs = cmt.get(str(m["person_id"])) or {}
        h = sum(c["held"] for k in cs.values() for c in k["committees"].values())
        a = sum(c["attended"] for k in cs.values() for c in k["committees"].values())
        if h:
            met["cmt_rate"] = round(a / h, 4)
        kk = [k for k in cs if k != "?" and int(k) in (m.get("prior_terms") or [])]
        if kk:
            met["cmt_per_k"] = round(sum(cs[k]["attended_total"] for k in kk) / len(kk))
    m["metrics"] = met

json.dump(mks, open("public/data/mks.json", "w"), ensure_ascii=False)
print("untranslated strings:", len(missing))
for s in list(missing)[:15]:
    print("  ", s[:120])
