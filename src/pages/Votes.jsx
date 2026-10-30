import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMKs, useParties, useData, VOTE_CODE, VOTE_CLASS } from '@/lib/data';
import { Loading, Page } from '@/components/bits';
import { MKLink } from '@/components/MKDrawer';

const KS = [25, 24, 23, 22, 21, 20];

function VoteDetail({ vote, k, mks, partyById }) {
  const ym = vote.dt.slice(0, 7);
  const { data: month } = useData(`votes/by_month/${ym}.json`);
  if (!month) return <p className="text-sub text-sm">טוען…</p>;
  const rec = new Map(month[vote.id] || []);
  const served = mks.filter((m) => m.prior_terms.includes(k));
  const groups = {};
  served.forEach((m) => {
    (groups[m.party] = groups[m.party] || []).push({ m, code: m.person_id ? rec.get(m.person_id) : undefined });
  });
  return (
    <div className="grid gap-4">
      <div className="text-sm">
        <span className="text-sub">תוצאה במליאה: </span>
        <span className="num">בעד {vote.f} · נגד {vote.a}{vote.ab ? ` · נמנעו ${vote.ab}` : ''}</span>
      </div>
      <p className="text-xs text-sub">חברי הכנסת ה-26 שכיהנו בכנסת ה-{k}, לפי מפלגתם הנוכחית ({served.length}):</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([pid, list]) => (
          <div key={pid} className="rounded-lg border border-rule p-3 grid gap-1.5 content-start">
            <div className="flex items-center gap-1.5 font-semibold text-sm"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: partyById[pid]?.color }} />{partyById[pid]?.name_he}</div>
            {list.map(({ m, code }) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <MKLink id={m.id} className="hover:underline truncate">{m.name_he}</MKLink>
                {code ? <span className={`px-2 py-0.5 rounded text-xs ${VOTE_CLASS[code]}`}>{VOTE_CODE[code]}</span>
                  : <span className="text-xs text-sub">לא נרשמה הצבעה</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-sub">"לא נרשמה הצבעה" – נעדר/ה, לא השתתף/ה, או שלא כיהן/ה באותו מועד. מפלגה = הרשימה שבה נבחר/ה לכנסת ה-26, לא בהכרח הסיעה באותה עת.</p>
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
  const { data: meta } = useData(`votes/meta_k${k}.json`);
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  const all = useMemo(() => (meta ? meta.votes.map((v) => ({ id: v[0], dt: v[1], title: v[2], subject: v[3], f: v[4], a: v[5], ab: v[6] })).reverse() : []), [meta]);
  const list = useMemo(() => {
    const qq = q.trim();
    return qq ? all.filter((v) => `${v.title} ${v.subject}`.includes(qq)) : all;
  }, [all, q]);
  const sel = selId ? all.find((v) => v.id === selId) : null;
  if (!mks || !parties) return <Loading />;

  return (
    <Page>
      <header className="grid gap-2 max-w-3xl">
        <h1 className="text-4xl font-black">הצבעות במליאה</h1>
        <p className="text-sub">כל הצבעות המליאה בכנסות 20–25. בחרו הצבעה כדי לראות איך הצביעו חברי הכנסת הנבחרים שכיהנו אז. סיווג נושאי של ההצבעות יתווסף בהמשך.</p>
      </header>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <select value={k} onChange={(e) => setSp({ k: e.target.value })} className="rounded-md border border-rule bg-paper px-2 py-1.5">
          {KS.map((x) => <option key={x} value={x}>הכנסת ה-{x}</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setN(60); }} placeholder="חיפוש בנושא ההצבעה…" className="flex-1 min-w-[220px] rounded-md border border-rule bg-paper px-3 py-1.5" />
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
                <span className="text-xs text-sub num">{v.dt.slice(0, 10).split('-').reverse().join('.')} · בעד {v.f} · נגד {v.a}{v.subject ? ` · ${v.subject}` : ''}</span>
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
