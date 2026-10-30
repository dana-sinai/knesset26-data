import { useMemo, useState } from 'react';
import { useData, fmt } from '@/lib/data';

const PAGE = 40;
const isChair = (r) => /יו"ר|יו״ר|יושב|יושבת/.test(r || '');

/** Per-Knesset committee memberships with attendance, from the published protocols. */
export function CommitteeSummary({ personId }) {
  const { data: sum } = useData('committees/summary.json');
  const mine = sum?.[String(personId)];
  if (!sum) return <p className="text-sub text-sm">טוען…</p>;
  if (!mine) return <p className="text-sub text-sm">אין נתוני ועדות.</p>;
  const ks = Object.keys(mine).filter((k) => k !== '?').map(Number).sort((a, b) => b - a);
  return (
    <div className="grid gap-6">
      {ks.map((k) => {
        const rec = mine[String(k)];
        const rows = Object.entries(rec.committees)
          .filter(([, c]) => c.held > 0 || isChair(c.role))
          .sort((a, b) => (isChair(b[1].role) - isChair(a[1].role)) || b[1].held - a[1].held);
        const hidden = Object.keys(rec.committees).length - rows.length;
        return (
          <div key={k} className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-semibold">הכנסת ה-{k}</h4>
              <span className="text-xs text-sub num">השתתפות בכל הוועדות: {fmt(rec.attended_total)} ישיבות</span>
            </div>
            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-rule">
                <table className="w-full text-sm">
                  <thead className="bg-sand/60 text-xs text-sub"><tr>
                    {['ועדה', 'תפקיד', 'ישיבות בזמן החברות', 'השתתף/ה', 'שיעור'].map((h) => <th key={h} className="text-right font-medium px-3 py-2 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {rows.map(([name, c]) => (
                      <tr key={name} className="border-t border-rule">
                        <td className="px-3 py-1.5">{name}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{isChair(c.role) ? <span className="px-2 py-0.5 rounded bg-ink text-paper text-xs">{c.role}</span> : <span className="text-sub text-xs">{c.role}</span>}</td>
                        <td className="px-3 py-1.5 num">{fmt(c.held)}</td>
                        <td className="px-3 py-1.5 num">{fmt(c.attended)}</td>
                        <td className="px-3 py-1.5 num">{c.held ? `${Math.round((c.attended / c.held) * 100)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hidden > 0 && <p className="text-[11px] text-sub">ועוד {hidden} ועדות משנה או ועדות משותפות שלא התכנסו בזמן החברות (או שאין להן פרוטוקול מפוענח).</p>}
          </div>
        );
      })}
      <p className="text-[11px] text-sub leading-relaxed">
        <strong>השתתפות</strong> = הופעה ברשימת הנוכחים בפרוטוקול הישיבה. נספרות רק ישיבות שהפרוטוקול שלהן פורסם ופוענח.
        ממלאי מקום ושרים משתתפים פחות מטבע תפקידם. בוועדות אין הצבעות שמיות, ולכן אין רישום של הצבעה אישית בוועדה.
        מקור: מאגר הנתונים הפתוח של הכנסת (ישיבות ועדה ופרוטוקולים), דרך כנסת פתוחה.
      </p>
    </div>
  );
}

/** Searchable list of every committee session the MK attended. */
export function CommitteeSessions({ personId }) {
  const { data: rows } = useData(`committees/mk_${personId}.json`);
  const [q, setQ] = useState('');
  const [k, setK] = useState('');
  const [cmt, setCmt] = useState('');
  const [page, setPage] = useState(0);
  const ks = useMemo(() => [...new Set((rows || []).map((r) => r[1]))].filter(Boolean).sort((a, b) => b - a), [rows]);
  const cmts = useMemo(() => {
    const c = {};
    (rows || []).filter((r) => !k || String(r[1]) === k).forEach((r) => (c[r[2]] = (c[r[2]] || 0) + 1));
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [rows, k]);
  const list = useMemo(() => {
    const qq = q.trim();
    return (rows || []).filter((r) => (!k || String(r[1]) === k) && (!cmt || r[2] === cmt) && (!qq || `${r[2]} ${r[3]}`.includes(qq)));
  }, [rows, q, k, cmt]);
  if (!rows) return <p className="text-sub text-sm">טוען…</p>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <select value={k} onChange={(e) => { setK(e.target.value); setCmt(''); setPage(0); }} className="rounded-md border border-rule bg-paper px-2 py-1.5">
          <option value="">כל הכנסות</option>
          {ks.map((x) => <option key={x} value={x}>הכנסת ה-{x}</option>)}
        </select>
        <select value={cmt} onChange={(e) => { setCmt(e.target.value); setPage(0); }} className="rounded-md border border-rule bg-paper px-2 py-1.5 max-w-[260px]">
          <option value="">כל הוועדות</option>
          {cmts.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="חיפוש בנושא הישיבה…"
          className="flex-1 min-w-[200px] rounded-md border border-rule bg-paper px-3 py-1.5" />
      </div>
      <p className="text-xs text-sub num">{fmt(list.length)} ישיבות</p>
      <ul className="grid gap-1">
        {list.slice(page * PAGE, page * PAGE + PAGE).map((r, i) => (
          <li key={i} className="grid grid-cols-[82px_1fr] gap-3 text-sm border-b border-rule py-1.5">
            <span className="text-sub num text-xs pt-0.5">{r[0].split('-').reverse().join('.')}</span>
            <span>
              {r[4] ? <a href={r[4]} target="_blank" rel="noreferrer" className="hover:underline">{r[3] || '(ללא נושא)'}</a> : (r[3] || '(ללא נושא)')}
              <span className="block text-xs text-sub">{r[2]}</span>
            </span>
          </li>
        ))}
      </ul>
      {list.length > PAGE && (
        <div className="flex items-center gap-2 text-sm justify-center">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded border border-rule disabled:opacity-40">הקודם</button>
          <span className="num text-sub">{page + 1} / {Math.ceil(list.length / PAGE)}</span>
          <button disabled={(page + 1) * PAGE >= list.length} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded border border-rule disabled:opacity-40">הבא</button>
        </div>
      )}
    </div>
  );
}
