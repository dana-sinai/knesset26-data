import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { loadJSON, useData, useParties, useTopics, useBillSummaries, fmt } from '@/lib/data';
import { Loading, Page, Section } from '@/components/bits';

// Party rows in topics/party_{id}.json: [vid, knesset, date, title, stage, partyFor, partyAgainst, allFor, allAgainst, meaning, billId]
const STAGE = { final: 'אישור סופי', early: 'טרומית / ראשונה', whole: 'הצבעה על ההצעה' };
const fmtDate = (d) => (d ? d.split('-').reverse().join('.') : '');
const FOR = [47, 74, 58], AGAINST = [106, 48, 54], MID = [236, 231, 220];
const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const heat = (r) => `rgb(${(r >= 0.5 ? mix(MID, FOR, (r - 0.5) * 2) : mix(MID, AGAINST, (0.5 - r) * 2)).join(',')})`;
const ink = (r) => (Math.abs(r - 0.5) > 0.3 ? '#F7F4EE' : '#2B2622');
const side = (pf, pa) => (pf > pa ? 1 : pa > pf ? 2 : 0);
const pct = (x) => `${Math.round(x * 100)}%`;

function useRecords(parties) {
  const ids = (parties || []).filter((p) => p.seats > 0).map((p) => p.id);
  const qs = useQueries({ queries: ids.map((id) => ({ queryKey: ['data', `topics/party_${id}.json`], queryFn: () => loadJSON(`topics/party_${id}.json`), staleTime: Infinity })) });
  const done = qs.every((q) => q.data);
  return useMemo(() => (done ? Object.fromEntries(ids.map((id, i) => [id, qs[i].data])) : null), [done, ids.join()]); // eslint-disable-line react-hooks/exhaustive-deps
}

function PartyDot({ p }) {
  return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />{p.name_he}</span>;
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-sub">
      <span>רוב נגד</span>
      <span className="h-2.5 w-40 rounded-full" style={{ background: `linear-gradient(to left, ${heat(0)}, ${heat(0.5)}, ${heat(1)})` }} />
      <span>רוב בעד</span>
    </div>
  );
}

export default function Record() {
  const { data: parties } = useParties();
  const { data: topics } = useTopics();
  const { data: summaries } = useBillSummaries();
  const { data: ess } = useData('topics/bill_essence.json', { retry: false });
  const rec = useRecords(parties);
  const [sp, setSp] = useSearchParams();
  const [allTopics, setAllTopics] = useState(false);
  const set = (o) => setSp((cur) => { const n = new URLSearchParams(cur); Object.entries(o).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); return n; }, { replace: true });
  const P = sp.get('p') || '', T = sp.get('t') || '', A = sp.get('a') || '', B = sp.get('b') || '', CT = sp.get('ct') || '';
  const DIM = ess && ['mech', 'who'].includes(sp.get('d')) ? sp.get('d') : 'topic';

  const model = useMemo(() => {
    if (!rec || !parties || !topics) return null;
    const withRec = parties.filter((p) => p.seats > 0 && rec[p.id]?.members_with_record > 0);
    const without = parties.filter((p) => p.seats > 0 && !(rec[p.id]?.members_with_record > 0));
    // rows grouped by the chosen dimension: topic (as stored), or what the bill does / who it affects (bill_essence)
    const bucket = {};
    withRec.forEach((p) => {
      if (DIM === 'topic') { bucket[p.id] = rec[p.id].votes; return; }
      const seen = new Map();
      Object.values(rec[p.id].votes).forEach((l) => l.forEach((x) => seen.set(x[0], x)));
      const g = {};
      seen.forEach((x) => {
        const e = ess.bills[String(x[10])];
        if (!e) return;
        const keys = DIM === 'mech' ? [e[0], e[1]] : [e[2], e[3]];
        keys.filter(Boolean).forEach((k) => (g[k] = g[k] || []).push(x));
      });
      bucket[p.id] = g;
    });
    // columns, by how many contested votes they have
    const tCount = {};
    withRec.forEach((p) => Object.entries(bucket[p.id]).forEach(([t, l]) => { tCount[t] = Math.max(tCount[t] || 0, l.length); }));
    const cols = Object.keys(tCount).filter((t) => t !== 'other').sort((a, b) => tCount[b] - tCount[a]);
    // party x topic: share of the party's members' for/against votes that were "for"
    const cell = {};
    withRec.forEach((p) => {
      cell[p.id] = {};
      cols.forEach((t) => {
        const l = bucket[p.id][t] || [];
        let f = 0, a = 0;
        l.forEach((x) => { f += x[5]; a += x[6]; });
        cell[p.id][t] = f + a ? { r: f / (f + a), n: l.length, f, a } : null;
      });
    });
    // each party's majority side on each vote (per topic, and over all topics)
    const pos = {}; // pos[party][topic|'all'] = Map(vid -> side)
    withRec.forEach((p) => {
      pos[p.id] = { all: new Map() };
      Object.entries(rec[p.id].votes).forEach(([t, l]) => {
        pos[p.id][t] = new Map();
        l.forEach((x) => { const s = side(x[5], x[6]); if (s) { pos[p.id][t].set(x[0], s); pos[p.id].all.set(x[0], s); } });
      });
    });
    return { withRec, without, cols, tCount, cell, pos, bucket };
  }, [rec, parties, topics, ess, DIM]);

  const agree = useMemo(() => {
    if (!model) return null;
    const key = CT || 'all';
    const m = {};
    model.withRec.forEach((p) => {
      m[p.id] = {};
      model.withRec.forEach((q) => {
        if (p.id === q.id) return;
        const a = model.pos[p.id][key], b = model.pos[q.id][key];
        if (!a || !b) return;
        let n = 0, same = 0;
        a.forEach((s, vid) => { const s2 = b.get(vid); if (s2) { n += 1; if (s2 === s) same += 1; } });
        if (n) m[p.id][q.id] = { r: same / n, n };
      });
    });
    return m;
  }, [model, CT]);

  if (!model || !agree || !topics) return <Loading />;
  const L = DIM === 'topic' ? topics.labels : ess.labels[DIM === 'mech' ? 'mechanism' : 'who'];
  const TL = topics.labels;
  const EL = ess ? { ...ess.labels.mechanism, ...ess.labels.who } : {};
  const essChips = (bill) => { const e = ess?.bills?.[String(bill)]; return e ? [e[0], e[2]].filter((k) => k && k !== 'other').map((k) => EL[k]) : []; };
  const pById = Object.fromEntries(parties.map((p) => [p.id, p]));
  const shownCols = allTopics ? model.cols : model.cols.slice(0, 12);

  // drill-down: what party P did on topic T
  const drill = P && T && model.bucket[P]?.[T] ? model.bucket[P][T].slice().sort((x, y) => (y[2] > x[2] ? 1 : -1)) : null;
  // comparison: votes where A and B took opposite sides
  let split = null;
  if (A && B && model.pos[A] && model.pos[B]) {
    const key = CT || 'all';
    const rows = new Map();
    Object.entries(rec[A].votes).forEach(([t, l]) => { if (key === 'all' || t === key) l.forEach((x) => rows.set(x[0], x)); });
    const pa = model.pos[A][key] || new Map(), pb = model.pos[B][key] || new Map();
    const bRow = new Map();
    Object.entries(rec[B].votes).forEach(([, l]) => l.forEach((x) => bRow.set(x[0], x)));
    split = [...rows.values()].filter((x) => pa.get(x[0]) && pb.get(x[0]) && pa.get(x[0]) !== pb.get(x[0]))
      .map((x) => ({ x, b: bRow.get(x[0]) })).sort((u, v) => (v.x[2] > u.x[2] ? 1 : -1));
  }

  return (
    <Page>
      <header className="grid gap-3 max-w-3xl">
        <p className="text-sm text-gold font-semibold">מה הם עושים</p>
        <h1 className="text-4xl sm:text-5xl">מפלגות ונושאים</h1>
        <p className="text-sub leading-relaxed">
          איך הצביעו בפועל חברי הרשימות הנוכחיות, בכל נושא, על הצעות חוק שנויות במחלוקת. בחרו מפלגה ונושא כדי לראות כל הצבעה, או שתי
          מפלגות כדי לראות היכן הן חלוקות.
        </p>
        <p className="text-xs text-sub leading-relaxed rounded-lg bg-sand/60 px-3 py-2">
          חשוב לדעת: זה מבוסס על ההצבעות של מי שכיהן בעבר ונבחר היום מטעם המפלגה, בכנסות 16–25 – גם אם אז היה במפלגה אחרת, בקואליציה או
          באופוזיציה. רשימות שכל נבחריהן חדשים ({model.without.map((p) => p.name_he).join(', ') || 'אין'}) עוד אין להן רקורד.
          הצבעה שנויה במחלוקת = לפחות 20 מצביעים בעד ונגד, ולפחות רבע מהם בכל צד.
        </p>
      </header>

      {/* ---------------- party x topic */}
      <Section title="מי בעד מה" aside={<Legend />}>
        {ess && (
          <div className="flex flex-wrap items-center gap-1.5 -mt-2 text-sm">
            <span className="text-sub text-xs">לפי:</span>
            {[['topic', 'נושא'], ['mech', 'מה החוק עושה'], ['who', 'על מי הוא משפיע']].map(([k, l]) => (
              <button key={k} onClick={() => set({ d: k === 'topic' ? '' : k, t: '' })} aria-pressed={DIM === k}
                className={`px-3 py-1 rounded-full border text-xs ${DIM === k ? 'border-ink bg-ink text-paper' : 'border-rule text-sub hover:border-ink/40'}`}>{l}</button>
            ))}
          </div>
        )}
        <p className="text-sm text-sub">כל משבצת: מתוך ההצבעות בעד או נגד של חברי המפלגה {DIM === 'topic' ? 'בנושא' : 'בהצעות מהסוג הזה'}, כמה היו בעד. לחצו על משבצת כדי לראות את ההצבעות עצמן.</p>
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="text-xs border-separate border-spacing-0.5 min-w-full">
            <thead><tr>
              <th className="sticky right-0 bg-paper z-10" />
              {shownCols.map((t) => (
                <th key={t} className="font-medium text-sub align-bottom px-0.5 pb-1">
                  <span className="block w-14 leading-tight">{L[t] || t}</span>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {model.withRec.map((p) => (
                <tr key={p.id}>
                  <th className="sticky right-0 bg-paper z-10 text-right font-medium pl-2 whitespace-nowrap text-sm"><PartyDot p={p} /></th>
                  {shownCols.map((t) => {
                    const c = model.cell[p.id][t];
                    const on = P === p.id && T === t;
                    return (
                      <td key={t} className="p-0">
                        {c ? (
                          <button onClick={() => { set({ p: p.id, t }); setTimeout(() => document.getElementById('drill')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                            title={`${p.name_he} · ${L[t]}: ${pct(c.r)} בעד (${c.n} הצבעות)`}
                            className={`num w-14 h-9 rounded-md text-[11px] transition-transform hover:scale-105 ${on ? 'ring-2 ring-ink' : ''} ${c.n < 5 ? 'opacity-50' : ''}`}
                            style={{ background: heat(c.r), color: ink(c.r) }}>
                            {pct(c.r)}
                          </button>
                        ) : <span className="block w-14 h-9 rounded-md bg-sand/40" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-sub">
          <span>משבצת דהויה = פחות מ-5 הצבעות.</span>
          {model.cols.length > 12 && (
            <button onClick={() => setAllTopics(!allTopics)} className="underline hover:text-ink">{allTopics ? 'רק הנושאים המרכזיים' : `כל ${model.cols.length} הנושאים`}</button>
          )}
        </div>
      </Section>

      {/* ---------------- drill-down */}
      <Section title={DIM === 'topic' ? 'מה עשתה המפלגה בנושא' : DIM === 'mech' ? 'מה עשתה המפלגה, לפי סוג החוק' : 'מה עשתה המפלגה, לפי מי שהחוק משפיע עליו'}>
        <div id="drill" className="flex flex-wrap gap-2 scroll-mt-24">
          <select value={P} onChange={(e) => set({ p: e.target.value })} aria-label="מפלגה"
            className="px-3 py-1.5 rounded-full border border-rule text-sm bg-paper">
            <option value="">בחרו מפלגה</option>
            {model.withRec.map((p) => <option key={p.id} value={p.id}>{p.name_he}</option>)}
          </select>
          <select value={T} onChange={(e) => set({ t: e.target.value })} aria-label="נושא"
            className="px-3 py-1.5 rounded-full border border-rule text-sm bg-paper">
            <option value="">{DIM === 'topic' ? 'בחרו נושא' : DIM === 'mech' ? 'בחרו סוג' : 'בחרו קבוצה'}</option>
            {model.cols.map((t) => <option key={t} value={t}>{L[t] || t}</option>)}
          </select>
        </div>
        {!drill && <p className="text-sm text-sub">בחרו מפלגה ונושא – או לחצו על משבצת בטבלה למעלה.</p>}
        {drill && (
          <div className="grid gap-2">
            <p className="text-sm">
              <PartyDot p={pById[P]} /> · {L[T]}: <strong className="num">{drill.length}</strong> הצבעות.
              {' '}רוב המפלגה הצביע בעד ב-<strong className="num">{drill.filter((x) => side(x[5], x[6]) === 1).length}</strong>,
              {' '}נגד ב-<strong className="num">{drill.filter((x) => side(x[5], x[6]) === 2).length}</strong>.
            </p>
            <ul className="grid">
              {drill.slice(0, 60).map((x) => {
                const [vid, k, date, name, stage, pf, pa, f, a, meaning, bill] = x;
                const s = side(pf, pa);
                return (
                  <li key={vid} className="grid sm:grid-cols-[1fr_220px] gap-x-4 gap-y-1 py-2 border-b border-rule text-sm">
                    <span>
                      <Link to={`/votes?k=${k}&id=${vid}`} className="hover:underline">{name}</Link>
                      {meaning && <span className="block text-xs text-ink/80 mt-0.5">{meaning}</span>}
                      {essChips(bill).length > 0 && (
                        <span className="flex flex-wrap gap-1 mt-1">{essChips(bill).map((c) => <span key={c} className="text-[10px] rounded-full bg-sand px-2 py-0.5 text-sub">{c}</span>)}</span>
                      )}
                      {summaries?.[bill] && (
                        <details className="text-xs text-ink/80 mt-0.5"><summary className="cursor-pointer text-sub">תקציר החוק</summary>
                          <span className="block mt-1 leading-relaxed">{summaries[bill]}</span></details>
                      )}
                      <span className="block text-[11px] text-sub">{fmtDate(date)} · הכנסת ה-{k} · {STAGE[stage] || ''} · {f > a ? 'התקבלה' : 'לא התקבלה'} ({f}–{a})</span>
                    </span>
                    <span className="grid gap-1 content-start">
                      <span className="text-xs">{s === 1 ? 'רוב המפלגה: בעד' : s === 2 ? 'רוב המפלגה: נגד' : 'המפלגה התפצלה'}</span>
                      <span className="flex h-2.5 rounded-full overflow-hidden bg-sand">
                        <span style={{ width: `${(pf / Math.max(1, pf + pa)) * 100}%`, background: heat(1) }} />
                        <span style={{ width: `${(pa / Math.max(1, pf + pa)) * 100}%`, background: heat(0) }} />
                      </span>
                      <span className="num text-[11px] text-sub">{pf} בעד · {pa} נגד</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {drill.length > 60 && <p className="text-xs text-sub">מוצגות 60 ההצבעות האחרונות מתוך {drill.length}.</p>}
          </div>
        )}
      </Section>

      {/* ---------------- party x party */}
      <Section title="מי מצביע כמו מי" aside={
        <select value={CT} onChange={(e) => set({ ct: e.target.value })} aria-label="נושא להשוואה"
          className="px-3 py-1.5 rounded-full border border-rule text-xs bg-paper">
          <option value="">כל הנושאים</option>
          {Object.keys(TL).filter((t) => t !== 'other').map((t) => <option key={t} value={t}>{TL[t]}</option>)}
        </select>
      }>
        <p className="text-sm text-sub -mt-2">באיזה אחוז מההצבעות המשותפות רוב שתי המפלגות הצביע אותו דבר. לחצו על משבצת כדי לראות היכן הן חלוקות.</p>
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="text-xs border-separate border-spacing-0.5">
            <thead><tr>
              <th className="sticky right-0 bg-paper z-10" />
              {model.withRec.map((q) => (
                <th key={q.id} className="font-medium text-sub align-bottom px-0.5 pb-1"><span className="block w-14 leading-tight">{q.name_he}</span></th>
              ))}
            </tr></thead>
            <tbody>
              {model.withRec.map((p) => (
                <tr key={p.id}>
                  <th className="sticky right-0 bg-paper z-10 text-right font-medium pl-2 whitespace-nowrap text-sm"><PartyDot p={p} /></th>
                  {model.withRec.map((q) => {
                    if (p.id === q.id) return <td key={q.id}><span className="block w-14 h-9 rounded-md bg-ink/5" /></td>;
                    const c = agree[p.id][q.id];
                    const on = (A === p.id && B === q.id) || (A === q.id && B === p.id);
                    return (
                      <td key={q.id} className="p-0">
                        {c ? (
                          <button onClick={() => { set({ a: p.id, b: q.id }); setTimeout(() => document.getElementById('split')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                            title={`${p.name_he} ו${q.name_he}: אותו צד ב-${pct(c.r)} מ-${c.n} הצבעות`}
                            className={`num w-14 h-9 rounded-md text-[11px] hover:scale-105 transition-transform ${on ? 'ring-2 ring-ink' : ''} ${c.n < 10 ? 'opacity-50' : ''}`}
                            style={{ background: heat(c.r), color: ink(c.r) }}>
                            {pct(c.r)}
                          </button>
                        ) : <span className="block w-14 h-9 rounded-md bg-sand/40" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-sub">ירוק = בדרך כלל באותו צד, אדום = בדרך כלל בצדדים מנוגדים. משבצת דהויה = פחות מ-10 הצבעות משותפות.</p>

        <div id="split" className="grid gap-2 scroll-mt-24">
          {split && (
            <>
              <h3 className="text-xl">
                היכן <PartyDot p={pById[A]} /> ו<PartyDot p={pById[B]} /> חלוקות{CT ? ` · ${TL[CT]}` : ''}: <span className="num">{split.length}</span> הצבעות
              </h3>
              <ul className="grid">
                {split.slice(0, 40).map(({ x, b }) => {
                  const [vid, k, date, name, , pf, pa, f, a, meaning] = x;
                  return (
                    <li key={vid} className="grid sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-2 border-b border-rule text-sm">
                      <span>
                        <Link to={`/votes?k=${k}&id=${vid}`} className="hover:underline">{name}</Link>
                        {meaning && <span className="block text-xs text-ink/80 mt-0.5">{meaning}</span>}
                        <span className="block text-[11px] text-sub">{fmtDate(date)} · הכנסת ה-{k} · {f > a ? 'התקבלה' : 'לא התקבלה'} ({f}–{a})</span>
                      </span>
                      <span className="flex flex-wrap gap-2 text-xs content-start">
                        <span className="rounded-full bg-sand px-2 py-0.5">{pById[A].name_he}: {side(pf, pa) === 1 ? 'בעד' : 'נגד'} <span className="num text-sub">({pf}–{pa})</span></span>
                        {b && <span className="rounded-full bg-sand px-2 py-0.5">{pById[B].name_he}: {side(b[5], b[6]) === 1 ? 'בעד' : 'נגד'} <span className="num text-sub">({b[5]}–{b[6]})</span></span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {split.length > 40 && <p className="text-xs text-sub">מוצגות 40 האחרונות מתוך {fmt(split.length)}.</p>}
            </>
          )}
        </div>
      </Section>
    </Page>
  );
}
