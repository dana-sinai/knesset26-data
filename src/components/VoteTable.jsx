import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useBillTopics, useMKs, useParties, VOTE_CODE, VOTE_CLASS } from '@/lib/data';
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
  // optional second MK to compare with, vote by vote
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const [other, setOther] = useState('');
  const [cmp, setCmp] = useState(''); // '' all shared votes · 'same' · 'diff'
  const { data: theirs } = useData(`votes/mk_${other}.json`, { enabled: !!other });
  const them = useMemo(() => (other && theirs ? new Map(theirs) : null), [other, theirs]);
  const otherMK = other && (mks || []).find((x) => String(x.person_id) === String(other));
  const partyName = (id) => (parties || []).find((p) => p.id === id)?.name_he;
  const { data: parl } = useData('parliament.json');
  const selfMK = (mks || []).find((x) => String(x.person_id) === String(personId));
  // Knessets in which both voted (from each member's vote counts per Knesset)
  const commonKs = (pid) => Object.keys(parl?.[String(pid)]?.vote_stats || {}).map(Number).filter((x) => knessets.includes(x));
  const pickOther = (pid) => {
    setOther(pid); setCmp(''); setPage(0);
    const ks = pid ? commonKs(pid) : [];
    if (ks.length && !ks.includes(k)) setK(Math.max(...ks));
  };

  const rows = useMemo(() => {
    if (!mine || !meta) return [];
    const my = new Map(mine);
    const out = [];
    for (const v of meta.votes) {
      const code = my.get(v[0]);
      if (code == null) continue;
      const oc = them ? them.get(v[0]) : undefined;
      if (them && oc == null) continue; // comparing: only votes both took part in
      const n = v[4] + v[5];
      out.push({ id: v[0], dt: v[1], title: v[2], subject: v[3], f: v[4], a: v[5], ab: v[6], item: v[7], code, oc,
        contested: n >= 20 && Math.min(v[4], v[5]) / n >= 0.25, topics: (bt && v[7] != null && bt[v[7]]) || [] });
    }
    return out.reverse();
  }, [mine, meta, bt, them]);
  // agreement counts only votes where both voted for or against
  const pair = useMemo(() => {
    if (!them) return null;
    const c = { n: 0, same: 0, cn: 0, csame: 0 };
    rows.forEach((r) => {
      if (r.code > 2 || r.oc > 2) return;
      c.n++; if (r.code === r.oc) c.same++;
      if (r.contested) { c.cn++; if (r.code === r.oc) c.csame++; }
    });
    return c;
  }, [rows, them]);

  const filtered = useMemo(() => {
    const qq = q.trim();
    const okCmp = (r) => !them || !cmp || (r.code <= 2 && r.oc <= 2 && (cmp === 'same' ? r.code === r.oc : r.code !== r.oc));
    return rows.filter((r) => okCmp(r) && (!res || String(r.code) === res) && (!topic || r.topics.includes(topic)) && (!qq || `${r.title} ${r.subject}`.includes(qq)));
  }, [rows, q, res, topic, them, cmp]);
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
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-sub">השוואה עם:</span>
        <select value={other} onChange={(e) => pickOther(e.target.value)} className="rounded-md border border-rule bg-paper px-2 py-1.5" aria-label="השוואה עם חבר/ת כנסת">
          <option value="">חבר/ת כנסת שכיהנו יחד בעבר</option>
          {(mks || []).filter((x) => x.has_votes && x.person_id && String(x.person_id) !== String(personId) && commonKs(x.person_id).length)
            .sort((x, y) => x.name_he.localeCompare(y.name_he, 'he'))
            .map((x) => <option key={x.person_id} value={x.person_id}>{x.name_he} · {partyName(x.party)}</option>)}
        </select>
        {other && <button onClick={() => pickOther('')} className="text-xs underline text-sub hover:text-ink">ביטול</button>}
      </div>
      {other && (!them || !meta ? <p className="text-sub text-sm">טוען…</p> : (
        <div className="grid gap-2 rounded-xl bg-sand/40 p-3 text-sm">
          {pair.n ? (
            <p>
              בכנסת ה-{k} הצביעו אותו דבר ב-<strong className="num">{Math.round((pair.same / pair.n) * 100)}%</strong> מתוך {pair.n.toLocaleString('he-IL')} הצבעות שבהן שניהם הצביעו בעד או נגד
              {pair.cn > 0 && <> · בהצבעות השנויות במחלוקת: <strong className="num">{Math.round((pair.csame / pair.cn) * 100)}%</strong> מתוך {pair.cn.toLocaleString('he-IL')}</>}.
            </p>
          ) : <p className="text-sub">{otherMK?.name_he} לא הצביע/ה בכנסת ה-{k}. כנסות שבהן שניהם הצביעו: {commonKs(other).join(', ') || 'אין'}.</p>}
          {pair.n > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[['', 'כל ההצבעות המשותפות'], ['same', 'הצביעו אותו דבר'], ['diff', 'הצביעו הפוך']].map(([key, l]) => (
                <button key={key} onClick={() => { setCmp(key); setPage(0); }} aria-pressed={cmp === key}
                  className={`px-3 py-1 rounded-full border text-xs ${cmp === key ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink/40'}`}>{l}</button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-sub">רק הצבעות שבהן שניהם הצביעו בעד או נגד (לא נמנעו). הצבעה שנויה במחלוקת: לפחות 20 מצביעים, ולפחות רבע מהם בכל צד.</p>
        </div>
      ))}
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
                <th className="text-right font-medium px-3 py-2">{them ? selfMK?.name_he : 'הצבעתו/ה'}</th>
                {them && <th className="text-right font-medium px-3 py-2">{otherMK?.name_he}</th>}
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
                  {them && <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${VOTE_CLASS[r.oc]}`}>{VOTE_CODE[r.oc]}</span></td>}
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
