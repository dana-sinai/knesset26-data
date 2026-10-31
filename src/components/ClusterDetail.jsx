import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useData, useMKs, useParties } from '@/lib/data';
import { MKLink } from '@/components/MKDrawer';
import { GROUP_NAMES, ClusterMap } from '@/components/ClusterExplorer';

// topics/cluster_votes_{topic}.json: votes = [vid, knesset, date, name, stage, meaning, billId, [[shareFor, n] per group]],
// mk = {personId: one char per vote: "1" for, "2" against, "0" did not vote}
const fmtDate = (d) => (d ? d.split('-').reverse().join('.') : '');
const MIN_N = 5; // a group's majority counts only if at least 5 of its members voted
const side = (g) => (g && g[0] != null && g[1] >= MIN_N && g[0] !== 0.5 ? (g[0] > 0.5 ? 1 : 2) : 0);
const SIDE = { 1: 'בעד', 2: 'נגד' };

function useDetail(topic) {
  return useData(`topics/cluster_votes_${topic}.json`, { retry: false });
}

function VoteLine({ v, right }) {
  const [vid, k, date, name, , meaning] = v;
  return (
    <li className="grid sm:grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-2 border-b border-rule text-sm">
      <span>
        <Link to={`/votes?k=${k}&id=${vid}`} className="hover:underline">{meaning ? meaning.replace(/^בעד = /, '') : name}</Link>
        {meaning && <span className="block text-[11px] text-sub mt-0.5">{name}</span>}
        <span className="block text-[11px] text-sub">{fmtDate(date)} · הכנסת ה-{k}</span>
      </span>
      <span className="flex flex-wrap gap-1 content-start text-xs">{right}</span>
    </li>
  );
}

const Pill = ({ children, strong }) => <span className={`rounded-full px-2 py-0.5 whitespace-nowrap ${strong ? 'bg-ink text-paper' : 'bg-sand'}`}>{children}</span>;

/** One member against the groups of this topic: how often they voted like each group, and where they differed. */
export function MKCompare({ topic, pid, groups, onClose }) {
  const { data: det } = useDetail(topic);
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const [tab, setTab] = useState(null);
  const m = useMemo(() => (mks || []).find((x) => Number(x.person_id) === Number(pid)), [mks, pid]);
  const res = useMemo(() => {
    const s = det?.mk?.[String(pid)];
    if (!s) return null;
    const G = groups.length;
    const agree = Array.from({ length: G }, () => ({ same: 0, n: 0, diff: [] }));
    det.votes.forEach((v, j) => {
      const mine = Number(s[j]);
      if (!mine) return;
      v[7].forEach((g, gi) => {
        const gs = side(g);
        if (!gs || gi >= G) return;
        agree[gi].n += 1;
        if (gs === mine) agree[gi].same += 1; else agree[gi].diff.push({ v, mine });
      });
    });
    agree.forEach((a) => a.diff.sort((x, y) => (y.v[2] > x.v[2] ? 1 : -1)));
    return agree;
  }, [det, pid, groups.length]);
  if (!m || !parties) return null;
  const p = parties.find((x) => x.id === m.party);
  const own = groups.find((g) => g.own)?.id;
  const t = tab ?? (res ? res.findIndex((_, gi) => gi !== own) : 0);

  return (
    <div className="rounded-2xl border border-ink/30 p-4 sm:p-5 grid gap-4 bg-paper">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <MKLink id={m.id} className="text-2xl font-title hover:underline">{m.name_he}</MKLink>
          <span className="text-sm text-sub flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: p?.color }} />{p?.name_he} · במפה: {GROUP_NAMES[own]}</span>
        </div>
        {onClose && <button onClick={onClose} aria-label="סגירה" className="p-1 text-sub hover:text-ink"><X size={18} /></button>}
      </div>
      {!res ? <p className="text-sm text-sub">טוען…</p> : (
        <>
          <div className="grid gap-2">
            <p className="text-sm text-sub">באיזה אחוז מההצבעות בנושא הצביע/ה כמו רוב כל קבוצה:</p>
            {res.map((a, gi) => (
              <div key={gi} className="grid grid-cols-[88px_1fr_auto] items-center gap-2 text-sm">
                <span className={gi === own ? 'font-medium' : ''}>{GROUP_NAMES[gi]}</span>
                <span className="h-2.5 rounded-full bg-sand overflow-hidden"><span className="block h-full rounded-full bg-ink/70" style={{ width: `${a.n ? (a.same / a.n) * 100 : 0}%` }} /></span>
                <span className="num text-xs text-sub w-24 text-left">{a.n ? `${Math.round((a.same / a.n) * 100)}% · ${a.n} הצבעות` : '—'}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            <div role="tablist" className="flex flex-wrap gap-1.5">
              {res.map((a, gi) => (
                <button key={gi} role="tab" aria-selected={t === gi} onClick={() => setTab(gi)}
                  className={`px-3 py-1 rounded-full border text-xs ${t === gi ? 'border-ink bg-ink text-paper' : 'border-rule text-sub hover:border-ink/40'}`}>
                  איפה שונה מ{GROUP_NAMES[gi]} ({a.diff.length})
                </button>
              ))}
            </div>
            {res[t] && (res[t].diff.length ? (
              <ul className="grid">
                {res[t].diff.slice(0, 25).map(({ v, mine }) => (
                  <VoteLine key={v[0]} v={v} right={<>
                    <Pill strong>{m.name_he.split(' ').slice(-1)[0]}: {SIDE[mine]}</Pill>
                    {v[7].map((g, gi) => (side(g) ? <Pill key={gi}>{GROUP_NAMES[gi]}: {SIDE[side(g)]} <span className="num text-sub">{Math.round(g[0] * 100)}%</span></Pill> : null))}
                  </>} />
                ))}
              </ul>
            ) : <p className="text-sm text-sub">תמיד הצביע/ה כמו רוב {GROUP_NAMES[t]} בנושא הזה.</p>)}
            {res[t]?.diff.length > 25 && <p className="text-xs text-sub">מוצגות 25 האחרונות מתוך {res[t].diff.length}.</p>}
          </div>
        </>
      )}
    </div>
  );
}

/** What each group supports and opposes that the other groups don't — the "sides" of the topic, in words. */
export function Sides({ topic, groups }) {
  const { data: det } = useDetail(topic);
  const cols = useMemo(() => {
    if (!det) return null;
    return groups.map((g) => {
      const list = [];
      det.votes.forEach((v) => {
        const sides = v[7].map(side);
        const mine = sides[g.id];
        if (mine !== 1) return; // what this group supported while the others opposed
        const others = sides.filter((_, gi) => gi !== g.id);
        if (!others.length || others.some((o) => !o || o === mine)) return;
        const gap = Math.min(...v[7].filter((_, gi) => gi !== g.id).map((o) => Math.abs(o[0] - v[7][g.id][0])));
        list.push({ v, mine, gap });
      });
      list.sort((a, b) => b.gap - a.gap || (b.v[2] > a.v[2] ? 1 : -1));
      return { g, list };
    });
  }, [det, groups]);
  if (!cols) return <p className="text-sm text-sub">טוען…</p>;
  return (
    <div className={`grid gap-4 ${groups.length > 2 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
      {cols.map(({ g, list }) => (
        <div key={g.id} className="rounded-xl border border-rule p-4 grid gap-2 content-start">
          <h3 className="text-2xl">{GROUP_NAMES[g.id]}</h3>
          <p className="text-xs text-sub">הצעות שרוב {GROUP_NAMES[g.id]} תמך בהן, ורוב {groups.length > 2 ? 'כל הקבוצות האחרות' : GROUP_NAMES[groups.find((x) => x.id !== g.id).id]} התנגד ({list.length})</p>
          <ul className="grid">
            {list.slice(0, 10).map(({ v }) => (
              <VoteLine key={v[0]} v={v} right={<>{v[7].map((o, gi) => <Pill key={gi} strong={gi === g.id}>{GROUP_NAMES[gi]}: <span className="num">{Math.round(o[0] * 100)}%</span> בעד</Pill>)}</>} />
            ))}
          </ul>
          {!list.length && <p className="text-sm text-sub">אין הצבעות כאלה בנושא.</p>}
        </div>
      ))}
    </div>
  );
}

/** Member card tab: where this member sits on the vote map, per topic, and where they differ from each group. */
export function MKClusterTab({ pid, initialTopic }) {
  const { data: clusters } = useData('topics/clusters.json');
  const { data: topics } = useData('topics/topics.json');
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const avail = useMemo(() => (clusters ? Object.keys(clusters).filter((k) => clusters[k]?.points?.some((p) => p[0] === pid)) : []), [clusters, pid]);
  const [t, setT] = useState(null);
  const topic = t || (initialTopic && avail.includes(initialTopic) ? initialTopic : avail.includes('all') ? 'all' : avail[0]);
  const pidToMK = useMemo(() => Object.fromEntries((mks || []).filter((m) => m.person_id).map((m) => [Number(m.person_id), m])), [mks]);
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  if (!clusters || !topics || !mks || !parties) return <p className="text-sm text-sub">טוען…</p>;
  if (!avail.length) return <p className="text-sm text-sub">אין מספיק הצבעות שנויות במחלוקת כדי למקם את חבר/ת הכנסת במפה.</p>;
  const d = clusters[topic];
  const own = d.points.find((x) => x[0] === pid)?.[3];
  const labels = { all: 'כל הנושאים', ...topics.labels };
  return (
    <div className="grid gap-4">
      <p className="text-sm text-sub leading-relaxed">
        מפת חברי הכנסת שכיהנו בעבר לפי ההצבעות שלהם בלבד – קרובים = הצביעו דומה. הנקודה המודגשת היא חבר/ת הכנסת הזה/זו.{' '}
        <Link to={`/clusters${topic !== 'all' ? `?t=${topic}` : ''}`} className="underline hover:text-ink">לעמוד המלא</Link>
      </p>
      <select value={topic} onChange={(e) => setT(e.target.value)} aria-label="נושא" className="justify-self-start rounded-full border border-ink bg-paper px-4 py-1.5 text-sm">
        {avail.map((k) => <option key={k} value={k}>{labels[k]}</option>)}
      </select>
      <ClusterMap data={d} pidToMK={pidToMK} partyById={partyById} picked={pid} topic={topic} />
      <MKCompare key={`${topic}-${pid}`} topic={topic} pid={pid} groups={d.clusters.map((c) => ({ id: c.id, own: own === c.id }))} />
    </div>
  );
}
