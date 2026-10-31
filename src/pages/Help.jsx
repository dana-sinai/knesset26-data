import { useEffect, useMemo, useState } from 'react';
import { useData, useTopics } from '@/lib/data';
import { Loading, Page } from '@/components/bits';
import { addRecord, APP_ID } from '@/components/Report';

const NEED = 3; // browsers that must agree before a bill gets a topic (same rule as pipeline/12_crowd_topics.py)

function voterId() {
  try {
    let v = localStorage.getItem('k26_voter');
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('k26_voter', v); }
    return v;
  } catch { return `anon-${Math.random().toString(36).slice(2)}`; }
}
function loadMine() { try { return JSON.parse(localStorage.getItem('k26_voted') || '{}'); } catch { return {}; } }
function saveMine(m) { try { localStorage.setItem('k26_voted', JSON.stringify(m)); } catch { /* private mode */ } }

export default function Help() {
  const { data: items } = useData('topics/needs_help.json', { retry: false });
  const { data: topics } = useTopics();
  const [votes, setVotes] = useState([]);
  const [mine, setMine] = useState(loadMine);
  const [other, setOther] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    fetch(`/api/apps/${APP_ID}/entities/TopicVote?limit=5000`, { headers: { 'X-App-Id': APP_ID } })
      .then((r) => (r.ok ? r.json() : [])).then((d) => setVotes(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const tally = useMemo(() => {
    const t = {};
    const last = {};
    votes.forEach((v) => { last[`${v.bill_id}|${v.voter || v.id}`] = v; });
    Object.values(last).forEach((v) => {
      if (v.choice === 'unsure') return;
      const b = (t[v.bill_id] = t[v.bill_id] || {});
      b[v.choice] = (b[v.choice] || 0) + 1;
    });
    return t;
  }, [votes]);

  if (!topics) return <Loading />;
  const L = topics.labels;
  const choose = async (bill, choice) => {
    setBusy(bill);
    try {
      const rec = await addRecord('TopicVote', { bill_id: String(bill), choice, voter: voterId() });
      setVotes((v) => [...v, rec]);
      const m = { ...mine, [bill]: choice };
      setMine(m); saveMine(m);
    } catch { /* keep the buttons; the visitor can try again */ }
    setBusy(null);
  };

  return (
    <Page>
      <header className="grid gap-3 max-w-3xl">
        <p className="text-sm text-gold font-semibold">מה הם עושים</p>
        <h1 className="text-4xl sm:text-5xl">עזרו לנו לסווג</h1>
        <p className="text-sub leading-relaxed">
          כל הצעת חוק באתר משויכת לנושא, כדי שאפשר יהיה לראות מי הצביע בעד מה בכל תחום. את רובן אנחנו מסווגים אוטומטית, אבל על חלקן לא בטוחים.
          ההצעות האלה מחכות כאן, בלי נושא, עד שלפחות {NEED} אנשים יסכימו לאיזה נושא הן שייכות. מספיק לקרוא את השם ולבחור.
        </p>
      </header>

      {!items ? <Loading /> : !items.length ? (
        <p className="text-sub">כרגע אין הצעות שמחכות לסיווג. תודה! חזרו בעוד כמה ימים.</p>
      ) : (
        <ul className="grid gap-3 max-w-3xl">
          {items.map((it) => {
            const t = tally[String(it.bill)] || {};
            const best = Object.entries(t).sort((a, b) => b[1] - a[1])[0];
            const my = mine[it.bill];
            return (
              <li key={it.bill} className="rounded-xl border border-rule p-4 grid gap-3">
                <p className="font-medium leading-relaxed">{it.name}</p>
                {my ? (
                  <p className="text-sm text-sub">תודה! בחרת: <strong className="text-ink">{my === 'unsure' ? 'לא בטוח/ה' : L[my]}</strong>
                    {best ? ` · עד עכשיו: ${L[best[0]]} (${best[1]} מתוך ${NEED} הנדרשים)` : ''}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 text-sm">
                    {it.guesses.map((g) => (
                      <button key={g} disabled={busy === it.bill} onClick={() => choose(it.bill, g)}
                        className="rounded-full border border-rule px-3 py-1 hover:border-ink/50 hover:bg-sand disabled:opacity-50">{L[g] || g}</button>
                    ))}
                    <select value={other[it.bill] || ''} disabled={busy === it.bill}
                      onChange={(e) => { setOther({ ...other, [it.bill]: e.target.value }); if (e.target.value) choose(it.bill, e.target.value); }}
                      className="rounded-full border border-rule bg-paper px-3 py-1 text-sub">
                      <option value="">נושא אחר…</option>
                      {Object.entries(L).filter(([k]) => k !== 'other' && !it.guesses.includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <button disabled={busy === it.bill} onClick={() => choose(it.bill, 'unsure')} className="rounded-full px-3 py-1 text-sub hover:text-ink">לא בטוח/ה</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-sub max-w-3xl">
        לא נאסף שום מידע אישי: רק הבחירה, ומזהה אקראי שנשמר בדפדפן שלכם כדי שכל דפדפן ייספר פעם אחת. ההכרעות נכנסות לאתר בעדכון היומי, והמודל לומד מהן.
      </p>
    </Page>
  );
}
