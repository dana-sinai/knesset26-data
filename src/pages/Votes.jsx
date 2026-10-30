import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMKs, useParties, useData, VOTE_CODE, VOTE_CLASS } from '@/lib/data';
import { Loading, Page } from '@/components/bits';
import { MKLink } from '@/components/MKDrawer';

const KS = [25, 24, 23, 22, 21, 20];

export const VOTE_TYPES = [
  ['all', 'כל ההצבעות'],
  ['bill', 'הצבעה על הצעת חוק'],
  ['part', 'סעיפים והסתייגויות'],
  ['agenda', 'הצעות לסדר היום'],
  ['confidence', 'אי-אמון'],
  ['other', 'אחר: מינויים, ועדות, צווים ונהלים'],
];
export function voteType(v) {
  const t = `${v.title || ''} ${v.subject || ''}`;
  if (/הסתייגו|סעיף|סעיפים/.test(v.subject || '') || /הסתייגות|^\s*סעיפ/.test(v.title || '')) return 'part';
  if (/אי-אמון|אי אמון|הבעת אמון/.test(t)) return 'confidence';
  if (/לסדר היום|הצעה לסדר/.test(t)) return 'agenda';
  if (/^\s*(הצעת חוק|הצעת חוק-יסוד)/.test(v.title || '')) return 'bill';
  return 'other';
}

const SHOWN = [1, 2, 3];

function Chip({ code }) {
  return <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${VOTE_CLASS[code]}`}>{VOTE_CODE[code]}</span>;
}

function VoteDetail({ vote, k, mks, partyById }) {
  const ym = vote.dt.slice(0, 7);
  const { data: month } = useData(`votes/by_month/${ym}.json`);
  const [view, setView] = useState('party');
  const [on, setOn] = useState({ 1: true, 2: true, 3: true });
  if (!month) return <p className="text-sub text-sm">טוען…</p>;
  const rec = new Map(month[vote.id] || []);
  const served = mks.filter((m) => m.prior_terms.includes(k));
  const voters = served
    .map((m) => ({ m, code: m.person_id ? rec.get(m.person_id) : undefined }))
    .filter((r) => SHOWN.includes(r.code));
  const counts = { 1: 0, 2: 0, 3: 0 };
  voters.forEach((r) => (counts[r.code] += 1));
  const shown = voters.filter((r) => on[r.code]);
  const notShown = served.length - voters.length;
  const byPartyOrder = (a, b) => (partyById[a.m.party]?.seats ?? 0) < (partyById[b.m.party]?.seats ?? 0) ? 1 : -1;

  const groups = {};
  shown.forEach((r) => (groups[r.m.party] = groups[r.m.party] || []).push(r));

  return (
    <div className="grid gap-4">
      <div className="text-sm">
        <span className="text-sub">תוצאה במליאה (כל חברי הכנסת דאז): </span>
        <span className="num">בעד {vote.f} · נגד {vote.a}{vote.ab ? ` · נמנעו ${vote.ab}` : ''}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-sub">הצגה:</span>
        {SHOWN.map((c) => (
          <button key={c} onClick={() => setOn({ ...on, [c]: !on[c] })} aria-pressed={on[c]}
            className={`px-2.5 py-1 rounded-md border text-xs num transition-colors ${on[c] ? 'border-ink bg-ink text-paper' : 'border-rule text-sub hover:border-ink/40'}`}>
            {VOTE_CODE[c]} {counts[c]}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-rule" />
        <span className="text-xs text-sub">קיבוץ:</span>
        {[['party', 'לפי מפלגה'], ['position', 'לפי עמדה']].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
            className={`px-2.5 py-1 rounded-md border text-xs ${view === v ? 'border-ink bg-sand' : 'border-rule text-sub hover:border-ink/40'}`}>{l}</button>
        ))}
      </div>

      {!voters.length ? (
        <p className="text-sm text-sub border border-dashed border-rule rounded-xl p-6 text-center">אף אחד מחברי הכנסת ה-26 לא הצביע בהצבעה זו.</p>
      ) : view === 'party' ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([pid, list]) => (
            <div key={pid} className="rounded-lg border border-rule p-3 grid gap-1.5 content-start">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: partyById[pid]?.color }} />{partyById[pid]?.name_he}
                <span className="mr-auto text-[11px] font-normal text-sub num">
                  {SHOWN.map((c) => { const n = list.filter((r) => r.code === c).length; return n ? `${VOTE_CODE[c]} ${n}` : null; }).filter(Boolean).join(' · ')}
                </span>
              </div>
              {list.sort((a, b) => a.code - b.code || a.m.list_position - b.m.list_position).map(({ m, code }) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <MKLink id={m.id} className="hover:underline truncate">{m.name_he}</MKLink>
                  <Chip code={code} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {SHOWN.filter((c) => on[c] && counts[c]).map((c) => (
            <div key={c} className="rounded-lg border border-rule p-3 grid gap-1.5 content-start">
              <div className="flex items-center justify-between"><Chip code={c} /><span className="text-xs text-sub num">{counts[c]}</span></div>
              {shown.filter((r) => r.code === c).sort(byPartyOrder).map(({ m }) => (
                <div key={m.id} className="flex items-center gap-1.5 text-sm">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: partyById[m.party]?.color }} title={partyById[m.party]?.name_he} />
                  <MKLink id={m.id} className="hover:underline truncate">{m.name_he}</MKLink>
                </div>
              ))}
              {!counts[c] && <span className="text-xs text-sub">—</span>}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-sub leading-relaxed">
        מוצגים רק חברי הכנסת ה-26 שכיהנו בכנסת ה-{k} והצביעו בפועל בהצבעה זו ({voters.length}).
        {notShown > 0 && ` ${notShown} נוספים לא מוצגים: לא נרשמה להם הצבעה (נעדרו, נכחו בלי להצביע, או טרם כיהנו במועד ההצבעה).`}
        {' '}מפלגה = הרשימה שבה נבחרו לכנסת ה-26, לא בהכרח הסיעה באותה עת.
      </p>
    </div>
  );
}

export default function Votes() {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const [sp, setSp] = useSearchParams();
  const k = Number(sp.get('k') || 25);
  const selId = sp.get('id') ? Number(sp.get('id')) : null;
  const [q, setQ] = useState('');
  const [n, setN] = useState(60);
  const [type, setType] = useState('all');
  const { data: meta } = useData(`votes/meta_k${k}.json`);
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  const all = useMemo(() => (meta ? meta.votes.map((v) => ({ id: v[0], dt: v[1], title: v[2], subject: v[3], f: v[4], a: v[5], ab: v[6] })).map((v) => ({ ...v, type: voteType(v) })).reverse() : []), [meta]);
  const list = useMemo(() => {
    const qq = q.trim();
    return all.filter((v) => (type === 'all' || v.type === type) && (!qq || `${v.title} ${v.subject}`.includes(qq)));
  }, [all, q, type]);
  const typeCounts = useMemo(() => {
    const c = { all: all.length };
    all.forEach((v) => (c[v.type] = (c[v.type] || 0) + 1));
    return c;
  }, [all]);
  const sel = selId ? all.find((v) => v.id === selId) : null;
  if (!mks || !parties) return <Loading />;

  return (
    <Page>
      <header className="grid gap-2 max-w-3xl">
        <h1 className="text-4xl font-black">הצבעות במליאה</h1>
        <p className="text-sub">כל הצבעות המליאה בכנסות 20–25: הצבעות על הצעות חוק בקריאותיהן, על סעיפים והסתייגויות, הצעות לסדר היום, אי-אמון, מינויים והרכבי ועדות. ההצבעות בתוך הוועדות עצמן אינן מפורסמות במאגר הפתוח של הכנסת ולכן אינן כאן. בחרו הצבעה כדי לראות איך הצביעו חברי הכנסת הנבחרים שכיהנו אז. סיווג נושאי (תקציב, ביטחון, דת ומדינה…) יתווסף בהמשך.</p>
      </header>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <select value={k} onChange={(e) => setSp({ k: e.target.value })} className="rounded-md border border-rule bg-paper px-2 py-1.5">
          {KS.map((x) => <option key={x} value={x}>הכנסת ה-{x}</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setN(60); }} placeholder="חיפוש בנושא ההצבעה…" className="flex-1 min-w-[220px] rounded-md border border-rule bg-paper px-3 py-1.5" />
        <select value={type} onChange={(e) => { setType(e.target.value); setN(60); }} className="rounded-md border border-rule bg-paper px-2 py-1.5">
          {VOTE_TYPES.map(([v, l]) => <option key={v} value={v}>{l} ({(typeCounts[v] || 0).toLocaleString('he-IL')})</option>)}
        </select>
        <span className="text-sub num">{list.length.toLocaleString('he-IL')} הצבעות</span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 items-start">
        <ul className="grid gap-1 max-h-[75vh] overflow-auto pl-1">
          {!meta && <li className="text-sub text-sm">טוען…</li>}
          {list.slice(0, n).map((v) => (
            <li key={v.id}>
              <button onClick={() => setSp({ k: String(k), id: String(v.id) })}
                className={`w-full text-right rounded-lg border px-3 py-2 text-sm grid gap-0.5 ${selId === v.id ? 'border-ink bg-sand' : 'border-rule hover:border-ink/40'}`}>
                <span>{v.title || '(ללא כותרת)'}</span>
                <span className="text-xs text-sub num">{v.dt.slice(0, 10).split('-').reverse().join('.')} · בעד {v.f} · נגד {v.a}{v.ab ? ` · נמנעו ${v.ab}` : ''}{v.subject ? ` · ${v.subject}` : ''}</span>
              </button>
            </li>
          ))}
          {list.length > n && <li><button onClick={() => setN(n + 100)} className="text-sm underline">הצגת עוד</button></li>}
        </ul>
        <div className="lg:sticky lg:top-20">
          {sel ? (
            <div className="grid gap-3">
              <h2 className="text-2xl font-bold leading-snug">{sel.title}</h2>
              <p className="text-sm text-sub">{sel.dt.slice(0, 10).split('-').reverse().join('.')} {sel.subject && `· ${sel.subject}`} · הצבעה #{sel.id}</p>
              <VoteDetail vote={sel} k={k} mks={mks} partyById={partyById} />
            </div>
          ) : <p className="text-sub text-sm border border-dashed border-rule rounded-xl p-8 text-center">בחרו הצבעה מהרשימה</p>}
        </div>
      </div>
    </Page>
  );
}
