"""Step 3: locality layer for the map.

Sources (data.gov.il datastore API):
  - Survey of Israel / Mapping Center locality centroids (ITM coords)   resource 70ba1705-3b25-416f-939c-985999f87f35
  - Population Authority residents by locality and age group            resource 64edd0ee-3d5d-43ce-8562-c336c24dbc1f
  - Socio-economic cluster 2019 (CBS), localities in regional councils   resource 7c860e04-9f8d-41c2-9f24-6249958d2081
Output: public/data/localities.json  {code: {name, name_en, lat, lon, type, population, age groups, cluster}}
"""
import json, os
from pyproj import Transformer

ROOT = os.path.dirname(__file__)
RAW = f"{ROOT}/raw/cbs"
OUT = os.path.join(ROOT, "..", "public", "data", "localities.json")
tr = Transformer.from_crs("EPSG:2039", "EPSG:4326", always_xy=True)

def num(x):
    try:
        return int(float(str(x).replace(",", "")))
    except Exception:
        return None

loc = {}
for r in json.load(open(f"{RAW}/locality_centroids.json")):
    code = num(r["סמל ישוב"])
    x, y = float(r["אורדינטה מזרחית"]), float(r["אורדינטה צפונית"])
    lon, lat = tr.transform(x, y)
    loc[code] = dict(code=code, name=r["שם ישוב"].strip(), name_en=r["שם ישוב בלטינית"].strip().title(),
                     type=r["סוג ישוב"], lat=round(lat, 5), lon=round(lon, 5))
for r in json.load(open(f"{RAW}/population_by_locality_age.json")):
    code = num(r["סמל_ישוב"])
    if code in loc:
        loc[code].update(population=num(r["סהכ"]), district=r.get("נפה"),
                         regional_council=r.get("מועצה_אזורית") or None,
                         age={k.replace("גיל_", ""): num(v) for k, v in r.items() if k.startswith("גיל_")})
for r in json.load(open(f"{RAW}/socioeconomic_cluster_2019.json")):
    code = num(r["LOCALITY SYMBOL"])
    if code in loc:
        loc[code]["socioeconomic_cluster_2019"] = num(r["ESHKOL 2019"])
json.dump(loc, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(loc), "localities")
