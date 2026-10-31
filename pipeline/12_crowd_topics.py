"""Step 12: topics that site visitors chose for bills the model was unsure about ("עזרו לנו לסווג" page).

Visitors' choices are stored in the app's TopicVote table (Base44), readable by anyone (no personal data — only a
random per-browser id). A bill gets a topic only when at least MIN_AGREE different browsers chose the same topic and
they are at least two-thirds of those who chose a topic. Accepted topics are appended to input/bill_topics_extra.tsv
(marked "crowd:<n>"), so the next steps use them and the classifier learns from them. Prints RERUN_09 if any changed.
"""
import json, os, urllib.request
from collections import Counter, defaultdict

APP = "6ae471d76106749b2b96d473"
URL = f"https://our-knesset.base44.app/api/apps/{APP}/entities/TopicVote?limit=5000"
MIN_AGREE = 3
EXTRA = "pipeline/input/bill_topics_extra.tsv"

try:
    req = urllib.request.Request(URL, headers={"X-App-Id": APP, "User-Agent": "knesset26-daily"})
    votes = json.load(urllib.request.urlopen(req, timeout=60))
except Exception as e:  # the daily build must not fail because of this step
    print(f"crowd topics: could not read votes ({e})")
    raise SystemExit(0)

topics = json.load(open("public/data/topics/topics.json"))["labels"]
done = set()
if os.path.exists(EXTRA):
    for line in open(EXTRA, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) > 4 and p[4].startswith("crowd:"):
            done.add(p[0])
help_ = {str(b["bill"]): b for b in json.load(open("public/data/topics/needs_help.json"))} \
    if os.path.exists("public/data/topics/needs_help.json") else {}

by_bill = defaultdict(dict)  # bill -> voter -> choice (last one counts)
for v in sorted(votes, key=lambda x: x.get("created_date", "")):
    b, c = str(v.get("bill_id", "")), v.get("choice")
    if b in help_ and c in topics:
        by_bill[b][v.get("voter") or v.get("id")] = c

added = 0
with open(EXTRA, "a", encoding="utf-8") as fh:
    for b, choices in by_bill.items():
        if b in done:
            continue
        cnt = Counter(choices.values())
        top, n = cnt.most_common(1)[0]
        if n >= MIN_AGREE and n / sum(cnt.values()) >= 2 / 3:
            fh.write(f"{b}\t{top}\t\t{help_[b]['name']}\tcrowd:{n}\n")
            added += 1
print(f"crowd topics: {len(votes)} votes on {len(by_bill)} bills, {added} bills decided")
if added:
    print("RERUN_09")
