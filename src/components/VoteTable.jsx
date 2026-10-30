import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useBillTopics, VOTE_CODE, VOTE_CLASS } from '@/lib/data';
import TopicChips, { TopicSelect } from '@/components/TopicChips';

const PAGE = 50;

/** All plenum votes of one MK in one Knesset, searchable. */
export default function VoteTable({ personId, knessets }) {
  const [k, setK] = useState(knessets[knessets.length - 1]);
  const [q, setQ] = useState('');
  const [res, setRes] = useState('');
  const [topic, setTopic] = useState('');
  const { data: bt } = useBillTopics();
  const [page, setPage] = useState(0);
  const { data: mine } = useData(`votes/mk_${personId}.json`);
  const { data: meta } = useData(`votes/meta_k${k}.json`);

  const rows = useMemo(() => {
    if (!mine || !meta) return [];
    const my = new Map(mine);
    const out = [];
    for (const v of meta.votes) {
      const code = my.get(v[0]);
      if (code == null) continue;
      out.push({ id: v[0], dt: v[1], title: v[2], subject: v[3], f: v[4], a: v[5], ab: v[6], item: v[7], code, topics: (bt && v[7] != null && bt[v[7]]) || [] });
    }
    return out.reverse();
  }, [mine, meta, bt]);

  const filtered = useMemo(() => {
    const qq = q.trim();
    return rows.filter((r) => (!res || String(r.code) === res) && (!topic || r.topics.includes(topic)) && (!qq || `${r.title} ${r.subject}`.includes(qq)));
  }, [rows, q, res, topic]);
  const topicCounts = useMemo(() => {
    const c = {};
    rows.forEach((r) => r.topics.forEach((t) => t && (c[t] = (c[t] || 0) + 1)));
    return c;
  }, [rows]);

  const counts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
    filtered.forEach((r) => (c[r.code] += 1));
    return c;
  }, [filtered]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <select value={k} onChange={(e) => { setK(Number(e.target.value)); setPage(0); }} className="rounded-md border border-rule bg-paper px-2 py-1.5">
          {knessets.map((x) => <option key={x} value={x}>הכנסת ה-{x}</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="חיפוש בנושא ההצבעה (למשל: תקציב, גיוס, מע״מ)"
          className="flex-1 min-w-[220px] rounded-md border border-rule bg-paper px-3 py-1.5" />
        <select value={res} onChange={(e) => { setRes(e.target.value); setPage(0); }} className="rounded-md border border-rule bg-paper px-2 py-1.5">
          <option value="">כל ההצבעות</option>
          {[1, 2, 3, 4].map((c) => <option key={c} value={c}>{VOTE_CODE[c]}</option>)}
        </select>
        <TopicSelect value={topic} onChange={(t) => { setTopic(t); setPage(0); }} counts={topicCounts} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-sub">{filtered.length.toLocaleString('he-IL')} הצבעות:</span>
        {[1, 2, 3, 4].map((c) => counts[c] > 0 && <span key={c} className={`px-2 py-0.5 rounded ${VOTE_CLASS[c]}`}>{VOTE_CODE[c]} {counts[c]}</span>)}
      </div>
      {!mine || !meta ? <p className="text-sub text-sm">טוען הצבעות…</p> : (
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="w-full text-sm">
            <thead className="bg-sand/60 text-xs text-sub">
              <tr>
                <th className="text-right font-medium px-3 py-2">תאריך</th>
                <th className="text-right font-medium px-3 py-2">נושא</th>
                <th className="text-right font-medium px-3 py-2">הצבעתו/ה</th>
                <th className="text-right font-medium px-3 py-2 whitespace-nowrap">בעד–נגד במליאה</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(page * PAGE, page * PAGE + PAGE).map((r) => (
                <tr key={r.id} className="border-t border-rule align-top">
                  <td className="px-3 py-2 whitespace-nowrap num text-sub">{r.dt.slice(0, 10).split('-').reverse().join('.')}</td>
                  <td className="px-3 py-2">
                    <Link to={`/votes?id=${r.id}&k=${k}`} className="hover:underline">{r.title || '(ללא כותרת)'}</Link>
                    {r.subject && <div className="text-xs text-sub">{r.subject}</div>}
                    <TopicChips billId={r.item} className="mt-1" />
                  </td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${VOTE_CLASS[r.code]}`}>{VOTE_CODE[r.code]}</span></td>
                  <td className="px-3 py-2 num whitespace-nowrap text-xs">{r.f}–{r.a}{r.ab ? ` (${r.ab} נמנעו)` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > PAGE && (
        <div className="flex items-center gap-2 text-sm justify-center">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded border border-rule disabled:opacity-40">הקודם</button>
          <span className="num text-sub">{page + 1} / {Math.ceil(filtered.length / PAGE)}</span>
          <button disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded border border-rule disabled:opacity-40">הבא</button>
        </div>
      )}
      <p className="text-[11px] text-sub">מקור: מאגר הנתונים הפתוח של הכנסת (טבלאות KNS_PlenumVote, KNS_PlenumVoteResult), דרך המראה של כנסת פתוחה. היעדרות מהצבעה אינה נרשמת – הטבלה מציגה רק הצבעות שבהן נרשמה הצבעה.</p>
    </div>
  );
}
