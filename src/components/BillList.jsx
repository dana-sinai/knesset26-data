import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';

const PASSED = 118;

export default function BillList({ personId }) {
  const { data } = useData(`bills/mk_${personId}.json`);
  const [q, setQ] = useState('');
  const [k, setK] = useState('');
  const [onlyMain, setOnlyMain] = useState(true);
  const [onlyPassed, setOnlyPassed] = useState(false);
  const [n, setN] = useState(40);
  const knessets = useMemo(() => [...new Set((data || []).map((b) => b.knesset))].sort((a, b) => b - a), [data]);
  const list = useMemo(() => (data || [])
    .filter((b) => (!k || String(b.knesset) === k) && (!onlyMain || b.is_initiator) && (!onlyPassed || b.status_id === PASSED) && (!q || b.name.includes(q)))
    .sort((a, b) => b.knesset - a.knesset || b.bill_id - a.bill_id), [data, q, k, onlyMain, onlyPassed]);

  if (!data) return <p className="text-sub text-sm">טוען הצעות חוק…</p>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש בשם הצעת החוק" className="flex-1 min-w-[200px] rounded-md border border-rule bg-paper px-3 py-1.5" />
        <select value={k} onChange={(e) => setK(e.target.value)} className="rounded-md border border-rule bg-paper px-2 py-1.5">
          <option value="">כל הכנסות</option>
          {knessets.map((x) => <option key={x} value={x}>הכנסת ה-{x}</option>)}
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={onlyMain} onChange={(e) => setOnlyMain(e.target.checked)} />יוזם/ת (לא מצטרף/ת)</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={onlyPassed} onChange={(e) => setOnlyPassed(e.target.checked)} />רק שהתקבלו בקריאה שלישית</label>
      </div>
      <p className="text-xs text-sub">{list.length.toLocaleString('he-IL')} הצעות חוק</p>
      <ul className="grid gap-1.5">
        {list.slice(0, n).map((b) => (
          <li key={`${b.bill_id}-${b.is_initiator}`} className="rounded-lg border border-rule px-3 py-2 text-sm grid gap-0.5">
            <span>{b.name}</span>
            <span className="text-xs text-sub">
              כנסת {b.knesset}{b.private_number ? ` · פ/${b.private_number}/${b.knesset}` : ''} · {b.status || 'סטטוס לא ידוע'}
              {b.status_id === PASSED && <strong className="text-emerald-700 dark:text-emerald-400"> ✓</strong>}
              {!b.is_initiator && ' · מצטרף/ת'}
            </span>
          </li>
        ))}
      </ul>
      {list.length > n && <button onClick={() => setN(n + 60)} className="text-sm underline justify-self-center">הצגת עוד</button>}
      <p className="text-[11px] text-sub">מקור: KNS_Bill, KNS_BillInitiator – מאגר הנתונים הפתוח של הכנסת.</p>
    </div>
  );
}
