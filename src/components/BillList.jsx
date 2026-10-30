import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useData, useBillTopics, useBillSummaries, knessetBillUrl } from '@/lib/data';
import TopicChips, { TopicSelect } from '@/components/TopicChips';

const PASSED = 118;

export default function BillList({ personId }) {
  const { data } = useData(`bills/mk_${personId}.json`);
  const [q, setQ] = useState('');
  const [k, setK] = useState('');
  const [onlyMain, setOnlyMain] = useState(true);
  const [onlyPassed, setOnlyPassed] = useState(false);
  const [n, setN] = useState(40);
  const [topic, setTopic] = useState('');
  const { data: bt } = useBillTopics();
  const { data: summaries } = useBillSummaries();
  const tOf = (b) => (bt && bt[b.bill_id]) || [];
  const knessets = useMemo(() => [...new Set((data || []).map((b) => b.knesset))].sort((a, b) => b - a), [data]);
  const list = useMemo(() => (data || [])
    .filter((b) => (!k || String(b.knesset) === k) && (!onlyMain || b.is_initiator) && (!onlyPassed || b.status_id === PASSED) && (!topic || tOf(b).includes(topic)) && (!q || b.name.includes(q)))
    .sort((a, b) => b.knesset - a.knesset || b.bill_id - a.bill_id), [data, q, k, onlyMain, onlyPassed, topic, bt]); // eslint-disable-line react-hooks/exhaustive-deps
  const topicCounts = useMemo(() => {
    const c = {};
    (data || []).filter((b) => !onlyMain || b.is_initiator).forEach((b) => tOf(b).forEach((t) => t && (c[t] = (c[t] || 0) + 1)));
    return c;
  }, [data, bt, onlyMain]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <p className="text-sub text-sm">טוען הצעות חוק…</p>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש בשם הצעת החוק" className="flex-1 min-w-[200px] rounded-md border border-rule bg-paper px-3 py-1.5" />
        <select value={k} onChange={(e) => setK(e.target.value)} className="rounded-md border border-rule bg-paper px-2 py-1.5">
          <option value="">כל הכנסות</option>
          {knessets.map((x) => <option key={x} value={x}>הכנסת ה-{x}</option>)}
        </select>
        <TopicSelect value={topic} onChange={setTopic} counts={topicCounts} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={onlyMain} onChange={(e) => setOnlyMain(e.target.checked)} />יוזם/ת (לא מצטרף/ת)</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={onlyPassed} onChange={(e) => setOnlyPassed(e.target.checked)} />רק שהתקבלו בקריאה שלישית</label>
      </div>
      <p className="text-xs text-sub">{list.length.toLocaleString('he-IL')} הצעות חוק</p>
      <ul className="grid gap-1.5">
        {list.slice(0, n).map((b) => (
          <li key={`${b.bill_id}-${b.is_initiator}`} className="rounded-lg border border-rule px-3 py-2 text-sm grid gap-0.5">
            <span>{b.name}</span>
            <TopicChips billId={b.bill_id} />
            {summaries?.[b.bill_id] && (
              <details className="text-xs text-ink/80">
                <summary className="cursor-pointer text-sub">תקציר החוק (מאגר הכנסת)</summary>
                <p className="mt-1 leading-relaxed">{summaries[b.bill_id]}</p>
              </details>
            )}
            <span className="text-xs text-sub">
              כנסת {b.knesset}{b.private_number ? ` · פ/${b.private_number}/${b.knesset}` : ''} · {b.status || 'סטטוס לא ידוע'}
              {b.status_id === PASSED && <strong className="text-emerald-700 dark:text-emerald-400"> ✓</strong>}
              {!b.is_initiator && ' · מצטרף/ת'}
            </span>
            <span className="flex flex-wrap gap-3 text-xs">
              <Link to={`/votes?k=${b.knesset}&bill=${b.bill_id}`} className="underline text-sub hover:text-ink">הצבעות במליאה על ההצעה</Link>
              <a href={knessetBillUrl(b.bill_id)} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline text-sub hover:text-ink">באתר הכנסת<ExternalLink size={11} /></a>
            </span>
          </li>
        ))}
      </ul>
      {list.length > n && <button onClick={() => setN(n + 60)} className="text-sm underline justify-self-center">הצגת עוד</button>}
      <p className="text-[11px] text-sub">מקור: KNS_Bill, KNS_BillInitiator – מאגר הנתונים הפתוח של הכנסת.</p>
    </div>
  );
}
