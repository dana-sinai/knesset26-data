# Monthly review (Claude scheduled task, 1st Sunday of the month)

Things that need judgement and are not automatic. Each item ends in a commit to this repo; the next daily
update (GitHub Actions) puts it on the site — no republish needed.

1. **Error reports** — read new rows of the app's `ErrorReport` table (Base44, status `new`). Check each against the
   original source. Fix the data (e.g. `pipeline/input/person_overrides.csv`, `translations_he*.json`,
   `profiles_all.json`), then set the report's status to `fixed` or `not_an_error`.
2. **Roles that changed** — ministers, deputy ministers, committee chairs, Speaker, resignations / replacements
   (the "Norwegian law"). Check official sources (gov.il, the Knesset site / oKnesset data) and update the profiles.
3. **Bills the model was unsure about** — `pipeline/work/new_bills_unclassified.tsv`: decide a topic for each and append
   to `pipeline/input/bill_topics_extra.tsv` as `id<TAB>topic<TAB><TAB>name<TAB>review`.
4. **"בעד =" lines** — `pipeline/work/new_meaning_needed.tsv`: write one neutral line per bill (from its title and the
   official summary only) and append to `pipeline/input/bill_meaning.tsv`.
5. **What the bill does / who it affects** — contested bills missing from `pipeline/input/bill_essence.tsv`: label them
   with the codebook in `pipeline/input/essence_labels.json` (same 5 columns).
6. Run the `daily-data` workflow once, check it succeeded, and send Dana a short summary (only what changed and anything
   that needs her decision).

Rules: neutral and factual (no left/right labels); every fact from an official or cited source; never publish photos of
people; never enter keys or passwords.
