import { useMemo, useState } from 'react';
import { useData, useParties, fmt } from '@/lib/data';

// Every locality as a dot, coloured by the list that won the most votes there, sized by the number of valid votes.
// Plain SVG (no map tiles), so it is light enough for the home page.
export default function LeadMap({ height = 360 }) {
  const { data: res } = useData('results_by_locality.json');
  const { data: loc } = useData('localities.json');
  const { data: parties } = useParties();
  const [hov, setHov] = useState(null);

  const pts = useMemo(() => {
    if (!res || !loc || !parties) return null;
    const ids = new Set(parties.map((p) => p.id));
    const out = [];
    Object.entries(res).forEach(([code, r]) => {
      const L = loc[code];
      if (!L?.lat || !r.valid) return;
      let best = null, bv = -1;
      Object.entries(r).forEach(([k, v]) => { if (ids.has(k) && v > bv) { best = k; bv = v; } });
      if (best) out.push({ code, name: L.name, lat: L.lat, lon: L.lon, valid: r.valid, best, share: bv / r.valid });
    });
    return out.sort((a, b) => b.valid - a.valid); // big ones first, small dots drawn on top
  }, [res, loc, parties]);

  if (!pts || !parties) return <div style={{ height }} className="rounded-xl bg-sand/50 animate-pulse" />;
  const pById = Object.fromEntries(parties.map((p) => [p.id, p]));
  const k = Math.cos((31.5 * Math.PI) / 180);
  const xs = pts.map((p) => p.lon * k), ys = pts.map((p) => p.lat);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const H = 400, W = Math.round((H * (x1 - x0)) / (y1 - y0)), pad = 8;
  const X = (p) => pad + ((p.lon * k - x0) / (x1 - x0)) * W;
  const Y = (p) => pad + ((y1 - p.lat) / (y1 - y0)) * H;
  const maxV = pts[0].valid;
  const winners = Object.entries(pts.reduce((a, p) => ({ ...a, [p.best]: (a[p.best] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-[auto_1fr] gap-4 items-center rounded-xl bg-sand/50 p-3">
      <svg viewBox={`0 0 ${W + pad * 2} ${H + pad * 2}`} style={{ height }} className="w-auto" role="img" aria-label="מפת היישובים לפי הרשימה הגדולה בכל יישוב">
        {pts.map((p) => (
          <circle key={p.code} cx={X(p)} cy={Y(p)} r={1.2 + 9 * Math.sqrt(p.valid / maxV)}
            fill={pById[p.best]?.color} fillOpacity={0.55 + 0.45 * Math.min(1, p.share * 1.5)} stroke="#F7F4EE" strokeWidth={0.3}
            onMouseEnter={() => setHov(p)} onMouseLeave={() => setHov(null)} />
        ))}
      </svg>
      <div className="grid gap-1 text-xs content-center">
        <p className="text-sub leading-snug">כל נקודה היא יישוב, בצבע הרשימה הגדולה בו.</p>
        <div className="h-8 text-ink leading-snug">
          {hov ? <>{hov.name}: {pById[hov.best]?.name_he} {Math.round(hov.share * 100)}% · <span className="num">{fmt(hov.valid)}</span> קולות</> : null}
        </div>
        {winners.slice(0, 6).map(([id, n]) => (
          <span key={id} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pById[id]?.color }} />
            {pById[id]?.name_he}<span className="num text-sub">{n} יישובים</span>
          </span>
        ))}
      </div>
    </div>
  );
}
