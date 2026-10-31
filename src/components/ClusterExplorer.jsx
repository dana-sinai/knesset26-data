import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useData, useMKs, useParties } from '@/lib/data';
import { useOpenMK, MKLink } from '@/components/MKDrawer';

export const GROUP_NAMES = ['קבוצה א׳', 'קבוצה ב׳', 'קבוצה ג׳', 'קבוצה ד׳'];

function ClusterMap({ data, pidToMK, partyById, highlight }) {
  const openMK = useOpenMK();
  const [hover, setHover] = useState(null);
  const pts = data.points;
  const xs = pts.map((p) => p[1]);
  const ys = pts.map((p) => p[2]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 560, H = 340, pad = 26;
  const sx = (x) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * pad);
  const sy = (y) => pad + ((y - y0) / (y1 - y0 || 1)) * (H - 2 * pad);
  const centres = data.clusters.map((c) => {
    const mem = pts.filter((p) => p[3] === c.id);
    return { id: c.id, x: mem.reduce((s, p) => s + sx(p[1]), 0) / mem.length, y: Math.min(...mem.map((p) => sy(p[2]))) - 14 };
  });
  const h = hover && pts.find((p) => p[0] === hover);
  const hm = h && pidToMK[h[0]];
  return (
    <div className="grid gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-xl border border-rule bg-paper">
        {centres.map((c) => (
          <text key={c.id} x={c.x} y={Math.max(16, c.y)} textAnchor="middle" style={{ font: '400 18px var(--font-title)', fill: 'rgb(var(--sub))' }}>{GROUP_NAMES[c.id]}</text>
        ))}
        {pts.map(([pid, x, y, cl]) => {
          const m = pidToMK[pid];
          const on = !highlight || highlight.has(pid);
          return (
            <circle key={pid} cx={sx(x)} cy={sy(y)} r={hover === pid || (highlight && on) ? 8 : 6}
              fill={partyById[m?.party]?.color || '#999'} fillOpacity={on ? 0.92 : 0.12}
              stroke={hover === pid || (highlight && on) ? 'rgb(var(--ink))' : 'rgb(var(--paper))'} strokeWidth={1.5}
              className="cursor-pointer transition-all" onMouseEnter={() => setHover(pid)} onMouseLeave={() => setHover(null)}
              onClick={() => m && openMK(m.id)}>
              <title>{`${m?.name_he} · ${partyById[m?.party]?.name_he} · ${GROUP_NAMES[cl]}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="min-h-5 text-xs text-sub text-center">
        {hm ? `${hm.name_he} · ${partyById[hm.party]?.name_he} · ${GROUP_NAMES[h[3]]} · ${h[4]} הצבעות` : 'כל נקודה היא חבר/ת כנסת; קרבה = הצבעה דומה. לחצו על נקודה או על מפלגה בקבוצה.'}
      </div>
    </div>
  );
}

/**
 * Topic chips + vote-based map + the groups with their party make-up.
 * Clicking a party inside a group lists exactly who it is (one person opens straight in the drawer).
 */
export default function ClusterExplorer({ topic, onTopic, compact = false }) {
  const { data: clusters } = useData('topics/clusters.json');
  const { data: topics } = useData('topics/topics.json');
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const [own, setOwn] = useState('all');
  const t = topic ?? own;
  const setT = (k) => { setSel(null); (onTopic || setOwn)(k); };
  const [sel, setSel] = useState(null); // { cl, party }
  const pidToMK = useMemo(() => Object.fromEntries((mks || []).filter((m) => m.person_id).map((m) => [Number(m.person_id), m])), [mks]);
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  if (!clusters || !topics || !mks || !parties) return <p className="text-sub text-sm">טוען…</p>;
  const labels = { all: 'כל הנושאים', ...topics.labels };
  const avail = ['all', ...Object.keys(topics.labels).filter((k) => clusters[k] && k !== 'other')];
  const d = clusters[t];
  const membersOf = (cl, party) => d.points.filter((p) => p[3] === cl && pidToMK[p[0]]?.party === party).map((p) => pidToMK[p[0]]);
  const selMembers = sel ? membersOf(sel.cl, sel.party) : [];
  const highlight = sel ? new Set(d.points.filter((p) => p[3] === sel.cl && pidToMK[p[0]]?.party === sel.party).map((p) => p[0])) : null;

  // always show the names first (even a single one); the name itself opens the member card
  const pick = (cl, party) => setSel(sel && sel.cl === cl && sel.party === party ? null : { cl, party });

  return (
    <div className="grid gap-5">
      <div className={`flex flex-wrap gap-1.5 ${compact ? 'justify-center' : ''}`}>
        {avail.map((k) => (
          <button key={k} onClick={() => setT(k)} aria-pressed={t === k}
            className={`px-3 py-1.5 rounded-full border text-sm ${t === k ? 'border-ink bg-ink text-paper' : 'border-rule text-sub hover:border-ink/40'}`}>
            {labels[k]}
          </button>
        ))}
      </div>
      {d && (
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
          <div className="grid gap-2">
            <ClusterMap data={d} pidToMK={pidToMK} partyById={partyById} highlight={highlight} />
            <p className="text-[11px] text-sub">
              {d.n_votes.toLocaleString('he-IL')} הצבעות שנויות במחלוקת · {d.points.length} חברי כנסת שכיהנו בעבר, עם מספיק הצבעות בנושא.
              הקבוצות נקבעו מההצבעות בלבד; הצירים אינם מסמנים ימין/שמאל.
            </p>
          </div>
          <div className="grid gap-4">
            {d.clusters.map((c) => (
              <div key={c.id} className="rounded-xl border border-rule p-4 grid gap-2">
                <div className="flex items-baseline justify-between"><h3 className="text-2xl">{GROUP_NAMES[c.id]}</h3><span className="text-xs text-sub num">{c.size} חברי כנסת</span></div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {c.parties.map(([p, n]) => {
                    const active = sel && sel.cl === c.id && sel.party === p;
                    return (
                      <button key={p} onClick={() => pick(c.id, p)} aria-pressed={active}
                        title={`מי ${n === 1 ? 'זה' : 'הם'}? הצגת השמות`}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${active ? 'border-ink bg-sand' : 'border-rule hover:border-ink/40'}`}>
                        <span className="w-2 h-2 rounded-full" style={{ background: partyById[p]?.color }} />{partyById[p]?.name_he} <span className="num text-sub">{n}</span>
                      </button>
                    );
                  })}
                </div>
                {sel && sel.cl === c.id && (
                  <div className="flex flex-wrap items-center gap-1.5 text-sm border-t border-rule pt-2">
                    {selMembers.map((m) => (
                      <MKLink key={m.id} id={m.id} className="rounded-full border border-rule px-2.5 py-0.5 hover:border-ink/40">{m.name_he}</MKLink>
                    ))}
                    <button onClick={() => setSel(null)} aria-label="סגירה" className="p-1 text-sub hover:text-ink"><X size={14} /></button>
                  </div>
                )}
              </div>
            ))}
            {compact && <Link to={`/topics${t !== 'all' ? `?t=${t}` : ''}`} className="text-sm underline text-sub justify-self-start">החוקים שמבדילים בין הקבוצות ←</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
