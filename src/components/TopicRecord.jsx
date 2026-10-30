import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useData, useParties, VOTE_CODE, VOTE_CLASS, fmt } from '@/lib/data';

const STAGE = { final: 'אישור סופי', early: 'קריאה מוקדמת / ראשונה' };
const fmtDate = (d) => (d ? d.split('-').reverse().join('.') : '');

function TopicBars({ counts, labels, unit = '' }) {
  const rows = Object.entries(counts || {}).filter(([t]) => t !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="text-sm text-sub">אין נתונים.</p>;
  return (
    <ul className="grid gap-1.5">
      {rows.map(([t, v]) => (
        <li key={t} className="grid grid-cols-[minmax(110px,auto)_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate">{labels[t] || t}</span>
          <span className="h-2 rounded-full bg-sand overflow-hidden"><span className="block h-full rounded-full bg-ink/70" style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="num text-xs text-sub w-10 text-left">{fmt(v)}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

function Agreement({ agreement }) {
  const { data: parties } = useParties();
  if (!parties) return null;
  const rows = parties.filter((p) => agreement?.[p.id]).map((p) => ({ p, ...agreement[p.id] })).sort((a, b) => b.rate - a.rate);
  if (!rows.length) return <p className="text-sm text-sub">אין מספיק הצבעות משותפות.</p>;
  return (
    <ul className="grid gap-1.5">
      {rows.map(({ p, rate, n }) => (
        <li key={p.id} className="grid grid-cols-[minmax(110px,auto)_1fr_auto] items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 truncate"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />{p.name_he}</span>
          <span className="h-2 rounded-full bg-sand overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${rate * 100}%`, background: p.color }} /></span>
          <span className="num text-xs text-sub w-20 text-left" title={`${n} הצבעות משותפות`}>{Math.round(rate * 100)}% · {n}</span>
        </li>
      ))}
    </ul>
  );
}

function VoteRows({ list, party }) {
  const [n, setN] = useState(12);
  return (
    <ul className="grid gap-1">
      {list.slice(0, n).map((x) => {
        // MK row: [vid, k, date, name, stage, code, f, a, meaning]; party row: [vid, k, date, name, stage, pf, pa, f, a, meaning]
        const [vid, k, date, name, stage] = x;
        const meaning = party ? x[9] : x[8];
        return (
          <li key={vid} className="grid grid-cols-[1fr_auto] gap-3 py-1.5 border-b border-rule text-sm">
            <span>
              <Link to={`/votes?k=${k}&id=${vid}`} className="hover:underline">{name}</Link>
              {meaning && <span className="block text-xs text-ink/80 mt-0.5">{meaning}</span>}
              <span className="block text-[11px] text-sub num">{fmtDate(date)} · {STAGE[stage]} · במליאה: בעד {party ? x[7] : x[6]}, נגד {party ? x[8] : x[7]}</span>
            </span>
            <span className="self-start">
              {party ? (
                <span className="text-xs num whitespace-nowrap">
                  <span className={`px-1.5 py-0.5 rounded ${VOTE_CLASS[1]}`}>בעד {x[5]}</span>{' '}
                  <span className={`px-1.5 py-0.5 rounded ${VOTE_CLASS[2]}`}>נגד {x[6]}</span>
                </span>
              ) : <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${VOTE_CLASS[x[5]]}`}>{VOTE_CODE[x[5]]}</span>}
            </span>
          </li>
        );
      })}
      {list.length > n && <li><button onClick={() => setN(n + 25)} className="text-xs underline text-sub mt-1">עוד {list.length - n}</button></li>}
    </ul>
  );
}

function TopicVotes({ votes, labels, party }) {
  const [open, setOpen] = useState(null);
  const rows = Object.entries(votes || {}).map(([t, v]) => {
    const list = party ? v : v.list;
    const f = party ? list.filter((x) => x[5] > x[6]).length : v.for_;
    const a = party ? list.filter((x) => x[6] > x[5]).length : v.against;
    return { t, list, f, a, n: list.length };
  }).sort((x, y) => y.n - x.n);
  if (!rows.length) return <p className="text-sm text-sub">אין הצבעות שנויות במחלוקת ברשומות.</p>;
  return (
    <div className="grid gap-1">
      {rows.map(({ t, list, f, a, n }) => (
        <div key={t} className="border border-rule rounded-lg">
          <button onClick={() => setOpen(open === t ? null : t)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-right">
            <span className="font-medium flex-1">{labels[t] || t}</span>
            <span className="text-xs num text-sub">{party ? 'רוב המפלגה ' : ''}בעד {f} · נגד {a}</span>
            <span className="hidden sm:flex h-2 w-24 rounded-full overflow-hidden bg-sand">
              <span className="block h-full bg-[#5E7F69]" style={{ width: `${(f / Math.max(1, n)) * 100}%` }} />
              <span className="block h-full bg-[#9A5A60]" style={{ width: `${(a / Math.max(1, n)) * 100}%` }} />
            </span>
            <ChevronDown size={15} className={`transition-transform ${open === t ? 'rotate-180' : ''}`} />
          </button>
          {open === t && <div className="px-3 pb-2"><VoteRows list={list} party={party} /></div>}
        </div>
      ))}
    </div>
  );
}

/** "In practice" panel for one MK (by PersonID) or one party (by id). */
export default function TopicRecord({ personId, partyId }) {
  const path = personId ? `topics/mk_${personId}.json` : `topics/party_${partyId}.json`;
  const { data, isError } = useData(path, { retry: false });
  const { data: topics } = useData('topics/topics.json');
  const labels = topics?.labels || {};
  if (isError) return <p className="text-sm text-sub">אין רקורד בכנסות קודמות.</p>;
  if (!data || !topics) return <p className="text-sm text-sub">טוען…</p>;
  const party = !!partyId;
  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h3 className="text-2xl">מה {party ? 'יזמו חברי המפלגה' : 'יזם/ה'}: הצעות חוק לפי נושא</h3>
        <TopicBars counts={data.initiated} labels={labels} />
      </section>
      {!party && (
        <section className="grid gap-3">
          <h3 className="text-2xl">עם מי מצביע/ה</h3>
          <p className="text-xs text-sub -mt-2">באיזה שיעור מההצבעות השנויות במחלוקת הצביע/ה כמו רוב חברי כל מפלגה (בהרכבה בכנסת ה-26) שהצביעו בהן. המספר השני = הצבעות משותפות.</p>
          <Agreement agreement={data.agreement} />
        </section>
      )}
      <section className="grid gap-3">
        <h3 className="text-2xl">בעד ונגד, בחוקים שנויים במחלוקת</h3>
        <p className="text-xs text-sub -mt-2">{topics.definitions?.contested}. {topics.definitions?.whole_bill}.</p>
        <TopicVotes votes={data.votes} labels={labels} party={party} />
      </section>
      <p className="text-[11px] text-sub leading-relaxed">
        הנושאים נקבעו לפי שם הצעת החוק, בסיוע בינה מלאכותית ובבדיקה מדגמית; כל שורה מקושרת להצבעה עצמה כדי שאפשר יהיה לבדוק.
        האתר אינו מסווג הצבעות כימין או שמאל.
      </p>
    </div>
  );
}
