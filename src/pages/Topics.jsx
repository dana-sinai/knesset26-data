import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useMKs, useParties } from '@/lib/data';
import { Loading, Page, Section } from '@/components/bits';
import { useOpenMK } from '@/components/MKDrawer';

const GROUP_NAMES = ['קבוצה א׳', 'קבוצה ב׳', 'קבוצה ג׳', 'קבוצה ד׳'];
const fmtDate = (d) => (d ? d.split('-').reverse().join('.') : '');

function ClusterMap({ data, pidToMK, partyById }) {
  const openMK = useOpenMK();
  const [hover, setHover] = useState(null);
  const pts = data.points;
  const xs = pts.map((p) => p[1]);
  const ys = pts.map((p) => p[2]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 560, H = 340, pad = 24;
  const sx = (x) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * pad);
  const sy = (y) => pad + ((y - y0) / (y1 - y0 || 1)) * (H - 2 * pad);
  // cluster centres for labels
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
          <text key={c.id} x={c.x} y={Math.max(14, c.y)} textAnchor="middle" style={{ font: '400 18px var(--font-title)', fill: 'rgb(var(--sub))' }}>{GROUP_NAMES[c.id]}</text>
        ))}
        {pts.map(([pid, x, y, cl]) => {
          const m = pidToMK[pid];
          const color = partyById[m?.party]?.color || '#999';
          return (
            <circle key={pid} cx={sx(x)} cy={sy(y)} r={hover === pid ? 8 : 6} fill={color} fillOpacity={0.9}
              stroke={hover === pid ? 'rgb(var(--ink))' : 'rgb(var(--paper))'} strokeWidth={1.5}
              className="cursor-pointer" onMouseEnter={() => setHover(pid)} onMouseLeave={() => setHover(null)}
              onClick={() => m && openMK(m.id)}>
              <title>{`${m?.name_he} · ${partyById[m?.party]?.name_he} · ${GROUP_NAMES[cl]}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="h-5 text-xs text-sub text-center">
        {hm ? `${hm.name_he} · ${partyById[hm.party]?.name_he} · ${GROUP_NAMES[h[3]]} · ${h[4]} הצבעות` : 'כל נקודה היא חבר/ת כנסת. קרבה = הצבעה דומה. לחצו על נקודה לפרטים.'}
      </div>
    </div>
  );
}

export default function Topics() {
  const { data: clusters } = useData('topics/clusters.json');
  const { data: topics } = useData('topics/topics.json');
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const [t, setT] = useState('all');
  const pidToMK = useMemo(() => Object.fromEntries((mks || []).filter((m) => m.person_id).map((m) => [Number(m.person_id), m])), [mks]);
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  if (!clusters || !topics || !mks || !parties) return <Loading />;
  const labels = { all: 'כל הנושאים', ...topics.labels };
  const avail = ['all', ...Object.keys(topics.labels).filter((k) => clusters[k] && k !== 'other')];
  const d = clusters[t];

  return (
    <Page>
      <header className="grid gap-3 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl">מי מצביע עם מי, לפי נושא</h1>
        <p className="text-sub leading-relaxed">
          המפה נבנית רק מההצבעות עצמן, בלי לדעת לאיזו מפלגה כל אחד שייך: חברי כנסת שהצביעו באופן דומה על חוקים שנויים במחלוקת
          קרובים זה לזה, והקבוצות נקבעות אוטומטית. רק אחר כך צובעים כל נקודה בצבע המפלגה – כדי לראות איך המפלגות מתחלקות בין הקבוצות.
          כולל רק מי שכיהן בכנסות קודמות (מאז 2003).
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
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
            <ClusterMap data={d} pidToMK={pidToMK} partyById={partyById} />
            <p className="text-[11px] text-sub">
              {d.n_votes} הצבעות שנויות במחלוקת · {d.points.length} חברי כנסת עם 15 הצבעות לפחות בנושא.
              הצירים אינם מסמנים ימין/שמאל – רק מרחק בין דפוסי הצבעה.
            </p>
          </div>
          <div className="grid gap-4">
            {d.clusters.map((c) => (
              <div key={c.id} className="rounded-xl border border-rule p-4 grid gap-2">
                <div className="flex items-baseline justify-between"><h3 className="text-2xl">{GROUP_NAMES[c.id]}</h3><span className="text-xs text-sub num">{c.size} חברי כנסת</span></div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {c.parties.map(([p, n]) => (
                    <Link key={p} to={`/party/${p}`} className="flex items-center gap-1 rounded-full border border-rule px-2 py-0.5 hover:border-ink/40">
                      <span className="w-2 h-2 rounded-full" style={{ background: partyById[p]?.color }} />{partyById[p]?.name_he} <span className="num text-sub">{n}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d?.separating?.length > 0 && (
        <Section title="החוקים שהכי מבדילים בין הקבוצות">
          <div className="overflow-x-auto rounded-xl border border-rule">
            <table className="w-full text-sm">
              <thead className="bg-sand/60 text-xs text-sub"><tr>
                <th className="text-right font-medium px-3 py-2">הצעת החוק</th>
                <th className="text-right font-medium px-3 py-2 whitespace-nowrap">תאריך</th>
                {d.clusters.map((c) => <th key={c.id} className="text-right font-medium px-3 py-2 whitespace-nowrap">{GROUP_NAMES[c.id]}: בעד</th>)}
              </tr></thead>
              <tbody>
                {d.separating.map(([vid, k, date, name, stage, shares, meaning]) => (
                  <tr key={vid} className="border-t border-rule align-top">
                    <td className="px-3 py-2">
                      <Link to={`/votes?k=${k}&id=${vid}`} className="hover:underline">{name}</Link>
                      {meaning && <div className="text-xs text-ink/80 mt-0.5">{meaning}</div>}
                      <div className="text-[11px] text-sub">{{ final: 'אישור סופי', early: 'קריאה טרומית / ראשונה', whole: 'הצבעה על ההצעה' }[stage]}</div>
                    </td>
                    <td className="px-3 py-2 num text-sub whitespace-nowrap">{fmtDate(date)}</td>
                    {shares.map((s, i) => <td key={i} className="px-3 py-2 num">{Math.round(s * 100)}%</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-sub">שיעור המצביעים בעד בכל קבוצה (מתוך מי שהצביע בעד או נגד). מוצגות רק הצבעות שבהן הצביעו לפחות 5 מכל קבוצה.</p>
        </Section>
      )}
    </Page>
  );
}
