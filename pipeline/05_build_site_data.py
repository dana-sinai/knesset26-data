"""Step 5: merge everything into the files the site reads.

Primary sources, in order of authority:
  1. Official Knesset data (PersonID, gender, Knesset terms, roles, committees, votes, bills)  -> step 2
  2. Researched, referenced profiles (education, career, residence, birth, bio)              -> input/profiles_all.json
  3. Hebrew Wikipedia / Wikidata, ONLY to fill gaps, only when the article clearly matches  -> step 4
Conflicts between sources are kept and shown on the MK page.
Outputs: public/data/mks.json, parties.json, meta.json, mks.csv (flat export)
"""
import csv, json, os, re, datetime as dt
import pandas as pd

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, "..", "public", "data")
ELECTION = dt.date(2026, 10, 27)

profiles = {p["name_he"]: p for p in json.load(open(f"{ROOT}/input/profiles_all.json"))}
roster = pd.read_csv(f"{ROOT}/work/roster_matched.csv")
parl = json.load(open(f"{OUT}/parliament.json"))
wd = json.load(open(f"{ROOT}/work/wikidata.json"))
loc = json.load(open(f"{OUT}/localities.json"))
mk_ind = pd.read_csv(f"{ROOT}/raw/ok/mk_individual.csv").set_index("PersonID")
parties = pd.read_csv(f"{ROOT}/input/parties.csv")
party_by_roster = {r.roster_key: r.id for r in parties.itertuples() if isinstance(r.roster_key, str)}

def norm(s):
    s = str(s or "")
    s = s.replace("׳", "'").replace("״", '"').replace("קריית", "קרית")
    s = re.sub(r"\(.*?\)", "", s)
    return re.sub(r"[\s\-–־'\"`]", "", s)

NICK = {"אלי": "אליהו", "רפי": "רפאל", "גבי": "גבריאלה", "חילי": "יחיאל", "דודי": "דוד", "אתי": "חוה",
        "מיקי": "מכלוף", "יאיא": "יאיר", "וליד": "ווליד"}

def wiki_ok(name, rec):
    """Accept a Wikipedia/Wikidata match only if the article title is clearly this person."""
    t = rec.get("title")
    if not t or not rec.get("is_politician_page"):
        return False
    tt = re.sub(r"\(.*?\)", "", t).replace("-", " ").split()
    nt = name.replace("-", " ").split()
    if len(tt) < 2:
        return False
    nset = {norm(x) for x in nt}
    first = NICK.get(tt[0], tt[0])
    last_ok = norm(tt[-1]) in nset or norm(tt[-1]).rstrip("ף") in {x.rstrip("ף") for x in nset}
    first_ok = norm(first) in nset or norm(tt[0]) in nset
    return last_ok and first_ok

# locality lookup
loc_by_norm = {}
for code, l in loc.items():
    loc_by_norm.setdefault(norm(l["name"]), l)
LOC_ALIAS = {"תלאביביפו": "תלאביביפו", "תלאביב": "תלאביביפו", "יפו": "תלאביביפו", "קיסריה": "קיסריה",
             "יקנעם": "יקנעםעילית", "מודיעין": "מודיעיןמכביםרעות", "מודיעיןמכביםרעות": "מודיעיןמכביםרעות",
             "הרצליהפיתוח": "הרצליה", "באקאלע'רביה": "באקהאלגרביה", "באקהאלע'רביה": "באקהאלגרביה",
             "כפרקאסם": "כפרקאסם", "שפרעם": "שפרעם", "גבעתעדה": "בנימינהגבעתעדה", "בנימינה": "בנימינהגבעתעדה",
             "הרצליה": "הרצלייה", "ביתאגיון": "ירושלים",
             "פרדסחנה": "פרדסחנהכרכור", "כרכור": "פרדסחנהכרכור", "קדימה": "קדימהצורן", "אורעקיבא": "אורעקיבא"}

def find_loc(name):
    if not name:
        return None
    n = norm(name)
    n = LOC_ALIAS.get(n, n)
    if n in loc_by_norm:
        return loc_by_norm[n]
    cands = [l for k, l in loc_by_norm.items() if k.startswith(n) or n.startswith(k)]
    cands.sort(key=lambda l: -(l.get("population") or 0))
    return cands[0] if cands else None

def loc_profile(L):
    """Locality-level CBS characteristics attached to an MK's home locality or birthplace (never below locality)."""
    if not L:
        return dict(code=None, lat=None, lon=None)
    keep = ("code", "lat", "lon", "district_he", "population_2024", "socioeconomic_cluster", "periphery_cluster",
            "arab_pct", "haredi_hh_pct", "religiosity_main", "form", "academic_pct", "median_wage")
    d = {k: L.get(k) for k in keep}
    d["district"] = L.get("district_he") or L.get("district")
    return d

def age_at(bd, by):
    if bd and len(bd) >= 10 and bd[5:7] != "00":
        b = dt.date.fromisoformat(bd[:10])
        return ELECTION.year - b.year - ((ELECTION.month, ELECTION.day) < (b.month, b.day)), False
    if by:
        return ELECTION.year - int(by), True
    return None, None

def age_group(a):
    if a is None: return "unknown"
    return "עד 39" if a < 40 else "40–49" if a < 50 else "50–59" if a < 60 else "60–69" if a < 70 else "70+"

EDU_RANK = ["PhD", "MD", "LLB/LLM", "MA", "BA", "post_secondary", "yeshiva", "high_school", "unknown"]

mks, unmatched_loc, flat = [], [], []
for r in roster.itertuples():
    p = profiles[r.name_he]
    pid = int(r.PersonID) if pd.notna(r.PersonID) else None
    pr = parl.get(str(pid), {}) if pid else {}
    w = wd.get(r.name_he, {})
    use_w = wiki_ok(r.name_he, w)
    sources = {k: list(v) for k, v in (p.get("sources") or {}).items()}
    conflicts, filled = [], []

    # gender: Knesset record first
    gender = p.get("gender")
    if pid and pid in mk_ind.index:
        g = {"זכר": "male", "נקבה": "female"}.get(mk_ind.loc[pid].GenderDesc)
        served = bool(pr.get("terms"))
        if g and gender and g != gender:
            # records created in Oct 2026 for first-time MKs are not yet verified by the Knesset;
            # for them the referenced research profile wins, for serving MKs the Knesset record wins
            keep = g if served else gender
            conflicts.append(f"מגדר: פרופיל המחקר={gender}, רשומת הכנסת={g}; מוצג: {keep}")
            gender = keep
        else:
            gender = g or gender
        sources.setdefault("gender", []).append(f"Knesset OData KNS_Person #{pid}")

    bd, by = p.get("birth_date"), p.get("birth_year")
    if use_w and w.get("birth_date"):
        wb = w["birth_date"]
        if bd and wb[:10] != bd[:10] and wb[5:7] != "00":
            conflicts.append(f"תאריך לידה: מקורות המחקר={bd}, ויקינתונים={wb}")
        if not bd and not by:
            if wb[5:7] != "00":
                bd = wb
            by = int(wb[:4])
            filled.append("birth_date")
            sources.setdefault("birth_date", []).append(w["wikidata_url"])
    if bd and not by:
        by = int(bd[:4])
    age, approx = age_at(bd, by)

    res_name = p.get("residence_locality_he")
    if not res_name and use_w and w.get("residence"):
        res_name = w["residence"][0]
        if res_name == "בית אגיון":
            res_name = "ירושלים"
        filled.append("residence")
        sources.setdefault("residence_locality_he", []).append(w["wikidata_url"])
    L = find_loc(res_name)
    if res_name and not L:
        unmatched_loc.append((r.name_he, res_name))

    birthplace = p.get("birthplace")
    if not birthplace and use_w and w.get("birthplace"):
        birthplace = w["birthplace"][0]; filled.append("birthplace")
        sources.setdefault("birthplace", []).append(w["wikidata_url"])
    # birthplace: an Israeli locality (mapped + CBS profile) or a country abroad
    BL, born_abroad, born_country = None, None, None
    if birthplace:
        bp = re.split(r"[,،]", birthplace)
        BL = find_loc(bp[0].strip())
        if BL:
            born_abroad = False
        else:
            last = bp[-1].strip()
            # unrecognised Bedouin villages / small places not in the CBS list are still in Israel
            if last in ("ישראל", "ארץ ישראל", "סעוה", "הנתון") or find_loc(last):
                born_abroad = False
            else:
                born_abroad, born_country = True, re.sub(r"\s*\(.*\)", " (לשעבר)", last) if last.startswith("ברית המועצות") else last

    terms = pr.get("terms") or p.get("prior_knesset_terms") or []
    prior = [t for t in terms if t < 26]
    is_new = len(prior) == 0
    if p.get("is_new_mk") is not None and bool(p.get("is_new_mk")) != is_new:
        conflicts.append(f"כהונה קודמת: פרופיל המחקר={'חדש' if p.get('is_new_mk') else 'ותיק'}, נתוני הכנסת={'חדש' if is_new else 'ותיק'} (נבחרו נתוני הכנסת)")

    edu_level = p.get("highest_education_level") or "unknown"
    sectors = sorted({c.get("sector") for c in (p.get("career") or []) if c.get("sector")})
    k25 = pr.get("vote_stats", {}).get("25", {})
    b25 = pr.get("bill_stats", {}).get("25", {})
    cm25 = {}
    for c in pr.get("committees", []):
        if c.get("knesset") == 25:
            key = c["committee"]
            if c["role"] == "chair" or key not in cm25:
                cm25[key] = c["role"]
    wiki_he = p.get("wikipedia_he") or (w.get("url") if use_w else None)

    mk = dict(
        id=str(pid) if pid else f"new-{party_by_roster[r.party_he]}-{r.list_position}",
        person_id=pid, name_he=r.name_he, name_en=p.get("name_en"),
        party=party_by_roster[r.party_he], list_position=int(r.list_position),
        gender=gender, birth_date=bd, birth_year=by, age=age, age_approx=approx, age_group=age_group(age),
        birthplace=birthplace,
        residence=dict(name=res_name, note=p.get("residence_note"), **loc_profile(L)) if res_name else None,
        birthplace_loc=dict(name=BL["name"], **loc_profile(BL)) if BL else None,
        born_abroad=born_abroad, born_country=born_country,
        education=p.get("education") or [], education_level=edu_level,
        career=p.get("career") or [], sectors=sectors, military_service=p.get("military_service"),
        languages=p.get("languages"), family_status=p.get("family_status"),
        prior_terms=prior, is_new=is_new,
        gov_roles=pr.get("gov_roles", []), knesset_roles=pr.get("knesset_roles", []),
        gov_roles_profile=p.get("government_roles") or [],
        committees_k25=[dict(committee=k, role=v) for k, v in sorted(cm25.items(), key=lambda x: (x[1] != "chair", x[0]))],
        k25=dict(participation=k25.get("participation"), with_faction_rate=k25.get("with_faction_rate"),
                 votes_cast=k25.get("votes_cast"), votes_held=k25.get("votes_held_while_serving"),
                 bills_initiated=b25.get("initiated"), bills_passed=b25.get("passed")) if (k25 or b25) else None,
        has_votes=bool(pr.get("vote_stats")), has_bills=bool(pr.get("bill_stats")),
        bio_he=p.get("bio_summary_he"), wikipedia_he=wiki_he, wikipedia_en=p.get("wikipedia_en"),
        sources=sources, notes=p.get("confidence_notes"), conflicts=conflicts, filled_from_wikidata=filled,
    )
    mks.append(mk)
    flat.append(dict(id=mk["id"], person_id=pid, name_he=mk["name_he"], name_en=mk["name_en"], party=mk["party"],
                     list_position=mk["list_position"], gender=gender, birth_year=by, age=age,
                     residence=res_name, residence_code=mk["residence"]["code"] if mk["residence"] else None,
                     education_level=edu_level, sectors=";".join(sectors), is_new=is_new,
                     prior_terms=";".join(map(str, prior)),
                     k25_participation=mk["k25"]["participation"] if mk["k25"] else None,
                     k25_with_faction=mk["k25"]["with_faction_rate"] if mk["k25"] else None,
                     k25_bills_initiated=mk["k25"]["bills_initiated"] if mk["k25"] else None))

json.dump(mks, open(f"{OUT}/mks.json", "w"), ensure_ascii=False, separators=(",", ":"))
with open(f"{OUT}/mks.csv", "w", newline="", encoding="utf-8-sig") as f:
    wr = csv.DictWriter(f, fieldnames=list(flat[0].keys())); wr.writeheader(); wr.writerows(flat)

# vote totals: CEC ballot-box file (step 6) when available, else the secondary-source figures in parties.csv
cec_path = f"{ROOT}/work/party_votes_cec.csv"
cec = pd.read_csv(cec_path, index_col=0).iloc[:, 0].to_dict() if os.path.exists(cec_path) else {}
VALID = 5690682
plist = []
for r in parties.itertuples():
    v = int(cec.get(r.id, r.votes))
    plist.append(dict(id=r.id, name_he=r.name_he, full_name_he=r.full_name_he, letters=r.letters, leader_he=r.leader_he,
                      seats=int(r.seats), votes=v, pct=round(100 * v / VALID, 2), color=r.color,
                      group=r.group if isinstance(r.group, str) else None,
                      votes_source="CEC ballot-box file" if r.id in cec else "Wikipedia"))
json.dump(plist, open(f"{OUT}/parties.json", "w"), ensure_ascii=False, separators=(",", ":"))

meta = dict(
    built_at=dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    election_date=str(ELECTION),
    results=dict(eligible=7331981, voters=5716665, turnout=0.7797, valid=5690682, invalid=25983, threshold_votes=184947,
                 source="קובץ תוצאות לפי קלפיות של ועדת הבחירות המרכזית (ספירה סופית; עותק במאגר hopetohelp/26), סכומים אומתו מול התוצאות הארציות",
                 source_url="https://github.com/hopetohelp/26",
                 caveat="התוצאות הרשמיות יפורסמו ברשומות; ייתכנו הבדלים קטנים במספרי הקולות."),
    roster_source="i24NEWS – רשימת 120 הנבחרים לפי תוצאות ועדת הבחירות (29–30.10.2026); טרם הושווה לפרסום ברשומות",
    roster_source_url="https://www.i24news.tv/he/news/israel-elections-2026/artc-12604d2f",
    swearing_in="2026-11-10",
    # Groups are unnamed on purpose; the legend lists the member parties. Split follows the
    # 53 / 48 / 19 bloc count in post-election coverage, with the Haredi parties shown separately.
    groups=[dict(id="g1", color="#9A5B5B"), dict(id="g2", color="#5A4A3E"),
            dict(id="g3", color="#4A6E8C"), dict(id="g4", color="#5E7F5A")],
    groups_source="חלוקה לגושים כפי שדווחה בסיקור תוצאות הבחירות (53 / 48 / 19), כשהמפלגות החרדיות מוצגות בנפרד",
)
json.dump(meta, open(f"{OUT}/meta.json", "w"), ensure_ascii=False, indent=1)
print("mks:", len(mks), "| with residence coords:", sum(1 for m in mks if m["residence"] and m["residence"]["lat"]),
      "| with age:", sum(1 for m in mks if m["age"] is not None), "| conflicts:", sum(1 for m in mks if m["conflicts"]),
      "| filled from wikidata:", sum(1 for m in mks if m["filled_from_wikidata"]))
print("UNMATCHED LOCALITIES:", unmatched_loc)
