"""Step 4: structured enrichment from Hebrew Wikipedia + Wikidata.

For each elected MK: find the Hebrew Wikipedia article (URL from the research profile, else a
search for "<name> חבר הכנסת"), confirm it is about an Israeli politician, then read its Wikidata
item: sex (P21), birth date (P569), birthplace (P19), educated at (P69), occupation (P106),
residence (P551), Knesset member positions (P39).
Output: pipeline/work/wikidata.json  {name_he: {...}}  -- used only to FILL GAPS or flag conflicts;
the research profiles stay primary. Every value carries its Wikidata/Wikipedia URL.
"""
import json, os, time, urllib.parse, urllib.request

ROOT = os.path.dirname(__file__)
UA = {"User-Agent": "knesset26-civic-data/0.1 (independent research; dana.sinai@gmail.com)"}
cache_path = f"{ROOT}/raw/wiki/cache.json"
cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}

def get(url):
    if url in cache:
        return cache[url]
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            data = json.load(urllib.request.urlopen(req, timeout=30))
            cache[url] = data
            time.sleep(0.1)
            return data
        except Exception as e:
            time.sleep(1 + i)
    return None

def he_api(**p):
    p.update(format="json", formatversion=2)
    return get("https://he.wikipedia.org/w/api.php?" + urllib.parse.urlencode(p))

def find_title(name, url):
    if url and "he.wikipedia.org/wiki/" in url:
        return urllib.parse.unquote(url.split("/wiki/")[1]).replace("_", " ")
    r = he_api(action="query", list="search", srsearch=f"{name} חבר הכנסת", srlimit=3)
    hits = (r or {}).get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None

labels_cache = {}
def label(qid):
    if qid in labels_cache:
        return labels_cache[qid]
    d = get(f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={qid}&props=labels&languages=he|en&format=json")
    e = (d or {}).get("entities", {}).get(qid, {})
    l = e.get("labels", {})
    labels_cache[qid] = (l.get("he") or l.get("en") or {}).get("value", qid)
    return labels_cache[qid]

def claims(ent, pid):
    out = []
    for c in ent.get("claims", {}).get(pid, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if v is not None:
            out.append(v)
    return out

profiles = json.load(open(f"{ROOT}/input/profiles_all.json"))
result = {}
for p in profiles:
    name = p["name_he"]
    title = find_title(name, p.get("wikipedia_he"))
    rec = dict(title=None)
    if title:
        r = he_api(action="query", prop="pageprops|extracts", titles=title, exintro=1, explaintext=1, redirects=1)
        pages = (r or {}).get("query", {}).get("pages", [])
        if pages and "missing" not in pages[0]:
            pg = pages[0]
            intro = pg.get("extract", "") or ""
            qid = pg.get("pageprops", {}).get("wikibase_item")
            is_pol = any(w in intro for w in ("כנסת", "פוליטיקאי", "פוליטיקאית", "מועמד", "מועמדת", "רשימת"))
            rec = dict(title=pg["title"], url="https://he.wikipedia.org/wiki/" + urllib.parse.quote(pg["title"].replace(" ", "_")),
                       qid=qid, is_politician_page=is_pol, intro=intro[:1200])
            if qid:
                d = get(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json")
                ent = (d or {}).get("entities", {}).get(qid, {})
                bd = [c["time"][1:11] for c in claims(ent, "P569") if isinstance(c, dict) and "time" in c]
                sex = [c["id"] for c in claims(ent, "P21")]
                rec.update(
                    wikidata_url=f"https://www.wikidata.org/wiki/{qid}",
                    birth_date=bd[0] if bd else None,
                    sex={"Q6581097": "male", "Q6581072": "female"}.get(sex[0]) if sex else None,
                    birthplace=[label(c["id"]) for c in claims(ent, "P19")][:2],
                    residence=[label(c["id"]) for c in claims(ent, "P551")][:3],
                    educated_at=[label(c["id"]) for c in claims(ent, "P69")][:6],
                    occupation=[label(c["id"]) for c in claims(ent, "P106")][:8],
                )
    result[name] = rec
    json.dump(cache, open(cache_path, "w"), ensure_ascii=False)

json.dump(result, open(f"{ROOT}/work/wikidata.json", "w"), ensure_ascii=False, indent=1)
found = sum(1 for r in result.values() if r.get("title"))
pol = sum(1 for r in result.values() if r.get("is_politician_page"))
print("articles found:", found, "| politician pages:", pol, "| with wikidata birth date:",
      sum(1 for r in result.values() if r.get("birth_date")))
