import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOpenMK } from '@/components/MKDrawer';

const ROWS = 7;
const R_OUT = 200;
const R_IN = 80;
const CX = 210;
const CY = 206;

/** Seat coordinates for a half-circle chamber, ordered right → left (RTL reading order). */
function layout(total) {
  const radii = Array.from({ length: ROWS }, (_, i) => R_IN + ((R_OUT - R_IN) * i) / (ROWS - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.round((total * r) / sum));
  let diff = total - counts.reduce((a, b) => a + b, 0);
  for (let i = ROWS - 1; diff !== 0; i = (i - 1 + ROWS) % ROWS) { counts[i] += Math.sign(diff); diff -= Math.sign(diff); }
  const seats = [];
  radii.forEach((r, i) => {
    const n = counts[i];
    for (let j = 0; j < n; j++) {
      const t = n === 1 ? Math.PI / 2 : (Math.PI * j) / (n - 1); // 0 = right edge
      seats.push({ t, r, x: CX + r * Math.cos(t), y: CY - r * Math.sin(t) });
    }
  });
  return seats.sort((a, b) => a.t - b.t || a.r - b.r);
}

/**
 * Controlled chamber chart. `match` (optional) is a predicate on an MK; non-matching seats are dimmed.
 * Clicking a seat opens the member drawer.
 */
export default function Hemicycle({ mks, parties, groups, match, label }) {
  const openMK = useOpenMK();
  const [hover, setHover] = useState(null);

  const { seats, gs } = useMemo(() => {
    const seated = parties.filter((p) => p.seats > 0);
    const gIds = (groups || []).map((g) => g.id);
    const ordered = [
      ...gIds.flatMap((g) => seated.filter((p) => p.group === g)),
      ...seated.filter((p) => !gIds.includes(p.group)),
    ];
    const people = ordered.flatMap((p) => mks.filter((m) => m.party === p.id)
      .sort((a, b) => a.list_position - b.list_position).map((m) => ({ m, p })));
    const pos = layout(people.length);
    return {
      seats: people.map((x, i) => ({ ...x, ...pos[i] })),
      gs: (groups || []).map((g) => ({ ...g, parties: ordered.filter((p) => p.group === g.id) })),
    };
  }, [mks, parties, groups]);

  const on = (m) => !match || match(m);
  const n = seats.filter((s) => on(s.m)).length;
  const byParty = {};
  seats.forEach((s) => { if (on(s.m)) byParty[s.p.id] = (byParty[s.p.id] || 0) + 1; });
  const hov = hover && seats.find((x) => x.m.id === hover);

  return (
    <div className="grid gap-4">
      <div className="relative mx-auto w-full max-w-[640px]">
        <svg viewBox="-4 -6 428 236" className="w-full h-auto overflow-visible" role="img" aria-label="מושבי הכנסת ה-26 לפי מפלגות">
          {seats.map((s) => (
            <circle key={s.m.id} cx={s.x} cy={s.y} r={8.2}
              fill={s.p.color} opacity={on(s.m) ? 1 : 0.13}
              stroke={hover === s.m.id ? 'rgb(var(--ink))' : 'none'} strokeWidth={2}
              className="cursor-pointer transition-opacity duration-300"
              onMouseEnter={() => setHover(s.m.id)} onMouseLeave={() => setHover(null)}
              onClick={() => openMK(s.m.id)}>
              <title>{`${s.m.name_he} · ${s.p.name_he}`}</title>
            </circle>
          ))}
          <text x={CX} y={CY - 6} textAnchor="middle" className="fill-ink" style={{ font: '400 46px var(--font-title)' }}>{n}</text>
          <text x={CX} y={CY + 14} textAnchor="middle" style={{ font: '400 11px var(--font-body)', fill: 'rgb(var(--sub))' }}>
            {match ? `מתוך 120${label ? ` · ${label}` : ''}` : 'חברי כנסת'}
          </text>
        </svg>
        <div className="h-5 text-center text-xs text-sub -mt-1">
          {hov ? `${hov.m.name_he} · ${hov.p.name_he} · מקום ${hov.m.list_position}` : 'לחצו על מושב לפרטים'}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-xs">
        {gs.map((g) => {
          const tot = g.parties.reduce((s, p) => s + p.seats, 0);
          const sel = g.parties.reduce((s, p) => s + (byParty[p.id] || 0), 0);
          return (
            <div key={g.id} className="grid gap-1 content-start border-t-2 pt-2" style={{ borderColor: g.color }}>
              <span className="num font-semibold text-sm">{match ? <>{sel} <span className="text-sub font-normal">מתוך {tot}</span></> : `${tot} מושבים`}</span>
              {g.parties.map((p) => (
                <Link key={p.id} to={`/party/${p.id}`} className="hover:underline flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />{p.name_he}
                  <span className="text-sub num mr-auto">{match ? `${byParty[p.id] || 0}/${p.seats}` : p.seats}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
