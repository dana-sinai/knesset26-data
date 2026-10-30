"""Step 6: CBS locality profiles + Knesset 26 results by locality -> "who each party represents".

Sources (all official):
  CBS localities file 2024 (bycode2024.xlsx)                         – codes, district, population group, locality form, ITM coords
  CBS socio-economic index 2021 (release 230/2024): t2 local authorities, t3 localities in regional councils – cluster 1–10
  CBS peripherality index 2020 (release 420/2022) t2 localities     – cluster 1 (most peripheral) – 10
  CBS Census 2022 'Summarized file of broad geographical units'     – Haredi/religiosity, academic degree, median wage, born abroad
  CEC Knesset 26 results by ballot box (expb, final count; copy from github.com/hopetohelp/26 raw/ballots-2026.csv,
      totals checked against the CEC final national results)
Outputs (public/data/): localities.json (enriched), electorate.json, results_by_locality.json
Unit of analysis is the LOCALITY. Big cities are internally diverse; statistical-area analysis is a later step.
"""
import json, os
import numpy as np
import pandas as pd
from pyproj import Transformer

ROOT = os.path.dirname(__file__)
C = f"{ROOT}/raw/cbs2"
OUT = os.path.join(ROOT, "..", "public", "data")
tr = Transformer.from_crs("EPSG:2039", "EPSG:4326", always_xy=True)
num = lambda v: pd.to_numeric(v, errors="coerce")

# ---------- bycode
by = pd.read_excel(f"{C}/bycode2024.xlsx")
by["code"] = by["סמל יישוב"].astype(int)
FORM = {  # CBS 'צורת יישוב' coarse groups
    "city": range(150, 160), "town": range(160, 200), "moshav": range(310, 330), "kibbutz": range(330, 340),
    "communal": range(370, 380), "rural_other": range(340, 370), "arab_rural": range(260, 300), "bedouin": range(440, 480),
}
def form_group(f):
    try:
        f = int(f)
    except Exception:
        return None
    if f in (110, 120, 130, 140, 150, 160, 170, 180, 191, 192, 193): return "city/town"
    for k, r in FORM.items():
        if f in r: return k
    return "other"

# ---------- SES 2021
t2 = pd.read_excel(f"{C}/ses_auth_t2.xlsx", header=None).iloc[10:, :7]
t2.columns = ["muni", "code", "name", "pop", "ses_value", "ses_rank", "ses_cluster"]
t2 = t2[num(t2.code).notna() & num(t2.ses_cluster).notna()]
ses = {int(r.code): dict(ses_cluster=int(r.ses_cluster), ses_value=round(float(r.ses_value), 3), ses_level="authority") for r in t2.itertuples()}
t3 = pd.read_excel(f"{C}/ses_rc_loc_t3.xlsx", header=None).iloc[10:]
for r in t3.itertuples(index=False):
    code, cl, val = num(r[5]), num(r[12]), num(r[10])
    if pd.notna(code) and pd.notna(cl):
        ses[int(code)] = dict(ses_cluster=int(cl), ses_value=round(float(val), 3) if pd.notna(val) else None, ses_level="locality")

# ---------- periphery 2020
pt = pd.read_excel(f"{C}/periph_loc_t2.xlsx", header=None).iloc[7:]
per = {}
for r in pt.itertuples(index=False):
    code, cl = num(r[3]), num(r[15])
    if pd.notna(code) and pd.notna(cl):
        per[int(code)] = int(cl)

# ---------- census 2022
X = pd.ExcelFile(f"{C}/census2022_broad.xlsx")
big = pd.read_excel(X, "Big Localities", header=3)
big = big[num(big.LocalityCode).notna() & big.Quarter.isna() & big.SubQuarter.isna()]
little = pd.read_excel(X, "Little Localities", header=4)
little = little[num(little.LocalityCode).notna()]
cen = {}
for r in big.itertuples():
    cen[int(r.LocalityCode)] = dict(
        haredi_hh_pct=num(r.hh_Haredi_pcnt), dati_hh_pct=num(r.hh_Dati_pcnt), hiloni_hh_pct=num(r.hh_Hiloni_pcnt),
        masorati_hh_pct=num(r.hh_Masorati_pcnt), religiosity_main=r.hh_MidatDatiyut_NameEng,
        academic_pct=(num(r.Acadm1Cert_pcnt) or 0) + (num(r.Acadm2Cert_pcnt) or 0) if pd.notna(num(r.Acadm1Cert_pcnt)) else None,
        median_wage=num(r.employeesAnnual_medWage), born_abroad_jews_pct=num(r.j_abr_pcnt), age_median=num(r.age_median),
        type_en=r.TypeLocEng)
for r in little.itertuples():
    cen.setdefault(int(r.LocalityCode), dict(
        haredi_hh_pct=None, religiosity_main=r.hh_MidatDatiyut_NameEng, religiosity_main_pct=num(r.hh_MidatDatiyut_pcnt),
        academic_pct=num(r.AcadmCert_pcnt), median_wage=num(r.employeesAnnual_medWage),
        born_abroad_jews_pct=num(r.j_abr_pcnt), age_median=num(r.age_median), type_en=r.TypeLocEng))

# ---------- assemble locality profiles (start from existing map layer for coords)
locs = json.load(open(f"{OUT}/localities.json"))
locs = {int(k): v for k, v in locs.items()}
for _, r in by.iterrows():
    code = int(r["code"])
    L = locs.setdefault(code, dict(code=code, name=str(r["שם יישוב"]).strip()))
    if L.get("lat") is None and pd.notna(r["קואורדינטות"]):
        s = str(int(r["קואורדינטות"]))
        if len(s) in (10, 12):
            h = len(s) // 2
            x, y = int(s[:h]) * (10 if h == 5 else 1), int(s[h:]) * (10 if h == 5 else 1)
            lon, lat = tr.transform(x, y)
            L.update(lat=round(lat, 5), lon=round(lon, 5))
    pop_total = num(r["סך הכל אוכלוסייה 2024"]); jews = num(r["יהודים ואחרים"]); arabs = num(r["ערבים"])
    form = r["צורת ישוב שוטפת"]
    L.update(district_he=r["שם מחוז"], subdistrict_he=r["שם נפה"],
             form_code=int(form) if pd.notna(form) else None, form=form_group(form),
             religion_code=int(r["דת יישוב"]) if pd.notna(r["דת יישוב"]) else None,
             population_2024=int(pop_total) if pd.notna(pop_total) else None,
             arab_pct=round(100 * arabs / (jews + arabs), 1) if pd.notna(arabs) and pd.notna(jews) and (jews + arabs) > 0 else (0.0 if pd.notna(jews) and pd.isna(arabs) else None),
             authority_cluster=r["שם אשכול רשויות מקומיות"] if isinstance(r["שם אשכול רשויות מקומיות"], str) else None)
for code, L in locs.items():
    if code in ses: L.update(ses[code]); L["socioeconomic_cluster"] = ses[code]["ses_cluster"]
    if code in per: L["periphery_cluster"] = per[code]
    if code in cen:
        L.update({k: (round(float(v), 1) if isinstance(v, (int, float, np.floating)) and pd.notna(v) else (v if isinstance(v, str) else None))
                  for k, v in cen[code].items()})

# ---------- election results by locality
b = pd.read_csv(f"{ROOT}/raw/cec/hth_ballots2026.csv", encoding="utf-8-sig")
parties = pd.read_csv(f"{ROOT}/input/parties.csv")
letters = dict(zip(parties.letters, parties.id))
pcols = [c for c in b.columns if c in letters]
agg = b.groupby("סמל ישוב")[["בזב", "מצביעים", "כשרים"] + pcols].sum()
nat = agg.sum()
# party totals straight from the CEC file (overrides secondary sources)
party_votes = {letters[c]: int(nat[c]) for c in pcols}
assert party_votes["likud"] == 1167458, party_votes["likud"]

res_loc = {}
for code, r in agg.iterrows():
    code = int(code)
    res_loc[code] = dict(eligible=int(r["בזב"]), voters=int(r["מצביעים"]), valid=int(r["כשרים"]),
                         **{letters[c]: int(r[c]) for c in pcols if r[c] > 0})
    if code in locs:
        locs[code]["turnout"] = round(100 * r["מצביעים"] / r["בזב"], 1) if r["בזב"] else None

# ---------- electorate profile per party (vote-weighted locality characteristics)
def bucket_ses(L):
    c = L.get("socioeconomic_cluster")
    return None if c is None else ("1–3" if c <= 3 else "4–6" if c <= 6 else "7–10")
def bucket_per(L):
    c = L.get("periphery_cluster")
    return None if c is None else ("1–3 (פריפריה)" if c <= 3 else "4–6" if c <= 6 else "7–10 (מרכז)")
def bucket_pop(L):
    a = L.get("arab_pct")
    return None if a is None else ("יישוב ערבי (90%+)" if a >= 90 else "יישוב מעורב" if a >= 10 else "יישוב יהודי (90%+)")
def bucket_haredi(L):
    h = L.get("haredi_hh_pct")
    if h is None:
        return "קטן/לא מדווח" if L.get("religiosity_main") != "Haredi" else "רוב חרדי"
    return "רוב חרדי (50%+)" if h >= 50 else "20–50% חרדים" if h >= 20 else "פחות מ-20% חרדים"
def bucket_form(L):
    return {"city/town": "עיר / מועצה מקומית", "moshav": "מושב", "kibbutz": "קיבוץ", "communal": "יישוב קהילתי",
            "arab_rural": "כפר ערבי", "bedouin": "יישוב בדואי"}.get(L.get("form"), "אחר")
def bucket_district(L):
    return L.get("district_he") or "לא ידוע"

DIMS = {"ses": bucket_ses, "periphery": bucket_per, "population": bucket_pop, "haredi": bucket_haredi,
        "form": bucket_form, "district": bucket_district}
keys = list(party_votes) + ["_all"]
prof = {k: {d: {} for d in DIMS} for k in keys}
wavg = {k: {"ses_value": [0, 0], "median_wage": [0, 0], "academic_pct": [0, 0], "turnout": [0, 0]} for k in keys}
unlocated = {k: 0 for k in keys}
for code, r in res_loc.items():
    L = locs.get(code)
    for k in keys:
        v = r["valid"] if k == "_all" else r.get(k, 0)
        if not v: continue
        if not L:
            unlocated[k] += v; continue
        for d, f in DIMS.items():
            g = f(L)
            if g is None: g = "ללא נתון"
            prof[k][d][g] = prof[k][d].get(g, 0) + v
        for m in wavg[k]:
            x = L.get(m)
            if x is not None:
                wavg[k][m][0] += x * v; wavg[k][m][1] += v
electorate = {}
for k in keys:
    tot = party_votes.get(k) if k != "_all" else int(nat["כשרים"])
    electorate[k] = dict(
        votes=tot, unlocated_votes=unlocated[k],
        dims={d: {g: round(100 * v / tot, 1) for g, v in sorted(prof[k][d].items(), key=lambda x: -x[1])} for d in DIMS},
        avg={m: (round(s / w, 2) if w else None) for m, (s, w) in wavg[k].items()},
        top_localities=[dict(code=c, name=locs.get(c, {}).get("name", str(c)), votes=r.get(k, 0),
                             share=round(100 * r.get(k, 0) / r["valid"], 1) if r["valid"] else None)
                        for c, r in sorted(res_loc.items(), key=lambda x: -x[1].get(k if k != "_all" else "valid", 0))[:15]] if k != "_all" else [],
    )

json.dump({str(k): v for k, v in locs.items()}, open(f"{OUT}/localities.json", "w"), ensure_ascii=False, separators=(",", ":"))
json.dump({str(k): v for k, v in res_loc.items()}, open(f"{OUT}/results_by_locality.json", "w"), separators=(",", ":"))
json.dump(dict(electorate=electorate, party_votes=party_votes,
               dims_he={"ses": "אשכול חברתי-כלכלי של היישוב (למ״ס 2021)", "periphery": "אשכול פריפריאליות (למ״ס 2020)",
                        "population": "הרכב אוכלוסיית היישוב (למ״ס 2024)", "haredi": "שיעור משקי בית חרדיים ביישוב (מפקד 2022)",
                        "form": "צורת יישוב", "district": "מחוז"},
               note="פילוח הקולות של כל מפלגה לפי מאפייני היישוב שבו הוצבעו. קולות המעטפות הכפולות (חיילים, נכים, אסירים ועוד) אינם משויכים ליישוב."),
          open(f"{OUT}/electorate.json", "w"), ensure_ascii=False, indent=1)
pd.Series(party_votes).to_csv(f"{ROOT}/work/party_votes_cec.csv")
print("localities:", len(locs), "| with SES:", sum(1 for L in locs.values() if L.get("socioeconomic_cluster")),
      "| with periphery:", sum(1 for L in locs.values() if L.get("periphery_cluster")),
      "| with census:", sum(1 for L in locs.values() if L.get("religiosity_main")))
print("results localities:", len(res_loc), "| unlocated valid votes:", unlocated["_all"])
for k in ["likud", "yashar", "shas", "joint"]:
    print(k, electorate[k]["dims"]["ses"], electorate[k]["avg"])
