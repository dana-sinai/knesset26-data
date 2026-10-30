#!/usr/bin/env bash
# Daily refresh: download what changed on the oKnesset mirror of the Knesset open data, rebuild the site data.
# Usage (from the app root):  bash pipeline/run_daily.sh fetch   then   bash pipeline/run_daily.sh build
#   (two calls so each stays well under a command time limit; "all" runs both)
# Afterwards, the scheduled task classifies any bills listed in pipeline/work/new_bills_unclassified.tsv
# (appending to pipeline/input/bill_topics_extra.tsv), adds "בעד = …" lines for new contested votes to
# pipeline/input/vote_meaning.json, reruns step 09 and saves a checkpoint.
set -euo pipefail
cd "$(dirname "$0")/.."
STAGE="${1:-all}"
python3 -c "import pandas, pyarrow, sklearn, pyproj" 2>/dev/null || pip install -q pandas pyarrow scikit-learn pyproj openpyxl
if [ "$STAGE" = "fetch" ] || [ "$STAGE" = "all" ]; then
B=https://production.oknesset.org/pipelines/data
R=pipeline/raw/ok
declare -A SRC=(
  [kns_plenumvote.csv]=knesset/kns_plenumvote/kns_plenumvote.csv
  [kns_plenumvoteresult.csv]=knesset/kns_plenumvoteresult/kns_plenumvoteresult.csv
  [kns_bill.csv]=bills/kns_bill/kns_bill.csv
  [kns_billinitiator.csv]=bills/kns_billinitiator/kns_billinitiator.csv
  [kns_persontoposition.csv]=members/kns_persontoposition/kns_persontoposition.csv
  [mk_individual.csv]=members/mk_individual/mk_individual.csv
  [mk_individual_committees.csv]=members/mk_individual/mk_individual_committees.csv
  [mk_individual_factions.csv]=members/mk_individual/mk_individual_factions.csv
  [mk_individual_govministries.csv]=members/mk_individual/mk_individual_govministries.csv
  [mk_individual_names.csv]=members/mk_individual/mk_individual_names.csv
  [factions.csv]=members/mk_individual/factions.csv
  [kns_committee.csv]=committees/kns_committee/kns_committee.csv
  [cmt_sessions_att.csv]=people/committees/meeting-attendees/kns_committeesession.csv
)
changed=()
for f in "${!SRC[@]}"; do
  tmp="$R/$f.new"
  code=$(curl -s -L -R -z "$R/$f" -o "$tmp" -w '%{http_code}' -m 600 "$B/${SRC[$f]}" || echo 000)
  if [ "$code" = "200" ] && [ -s "$tmp" ]; then mv "$tmp" "$R/$f"; changed+=("$f"); else rm -f "$tmp"; fi
  [ "$code" = "000" ] && echo "WARN: could not reach $B/${SRC[$f]}"
done
echo "changed: ${changed[*]:-none}"
if printf '%s\n' "${changed[@]:-}" | grep -q '^kns_plenumvoteresult.csv$' || [ ! -f "$R/plenumvoteresult.parquet" ]; then
  python3 - <<'PY'
import pandas as pd
r = pd.read_csv("pipeline/raw/ok/kns_plenumvoteresult.csv", usecols=["MkId", "VoteID", "VoteDate", "ResultCode", "ResultDesc"])
r.to_parquet("pipeline/raw/ok/plenumvoteresult.parquet")
print("parquet rebuilt:", len(r))
PY
fi
fi
if [ "$STAGE" = "fetch" ]; then exit 0; fi
cp public/data/votes/index.json pipeline/work/votes_index_before.json 2>/dev/null || true
cd pipeline
python3 01_match_roster.py | tail -3
python3 02_build_parliament.py | tail -2
python3 05_build_site_data.py | tail -2
cd ..
python3 pipeline/07_committees.py | tail -1
python3 pipeline/08_hebrew_and_metrics.py | tail -3
python3 pipeline/09_topics_and_positions.py | tail -4
# small local model: topics for new bills (confident ones) + "בעד =" from "(תיקון - …)" titles
if python3 pipeline/10_classify_new.py | tee /dev/stderr | grep -q RERUN_09; then
  python3 pipeline/09_topics_and_positions.py | tail -2
fi
echo "left for review: $(wc -l < pipeline/work/new_bills_unclassified.tsv) bill topics, $(wc -l < pipeline/work/new_meaning_needed.tsv) 'בעד =' lines"
python3 - <<'PY'
import json
b = json.load(open("pipeline/work/votes_index_before.json")) if __import__("os").path.exists("pipeline/work/votes_index_before.json") else {}
a = json.load(open("public/data/votes/index.json"))
d = {k: a[k] - b.get(k, 0) for k in a if a[k] != b.get(k, 0)}
print("new plenum votes by Knesset:", d or "none")
PY
