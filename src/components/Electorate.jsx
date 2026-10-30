const ORDER = {
  ses: ['1–3', '4–6', '7–10', 'ללא נתון'],
  periphery: ['1–3 (פריפריה)', '4–6', '7–10 (מרכז)', 'ללא נתון'],
  population: ['יישוב יהודי (90%+)', 'יישוב מעורב', 'יישוב ערבי (90%+)', 'ללא נתון'],
  haredi: ['פחות מ-20% חרדים', '20–50% חרדים', 'רוב חרדי (50%+)', 'רוב חרדי', 'קטן/לא מדווח'],
};

/** One dimension of a party's electorate vs all voters. */
export function DimBars({ title, party, all, color }) {
  const keys = (ORDER[title.key] || Object.keys({ ...all, ...party })).filter((k) => (party[k] || 0) + (all[k] || 0) > 0.05);
  return (
    <div className="grid gap-2">
      <h4 className="text-xl">{title.he}</h4>
      <div className="grid gap-1.5">
        {keys.map((k) => {
          const p = party[k] || 0, a = all[k] || 0;
          return (
            <div key={k} className="grid grid-cols-[140px_1fr_auto] items-center gap-2 text-xs">
              <span className="truncate" title={k}>{k}</span>
              <div className="relative h-4 rounded bg-sand">
                <div className="absolute inset-y-0 right-0 rounded" style={{ width: `${p}%`, background: color }} />
                <div className="absolute inset-y-[-2px] w-[2px] bg-ink" style={{ right: `${a}%` }} title={`כלל המצביעים: ${a}%`} />
              </div>
              <span className="num w-20 text-left">{p.toFixed(1)}% <span className="text-sub">({a.toFixed(0)}%)</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Electorate({ data, partyId, color }) {
  if (!data) return null;
  const e = data.electorate[partyId];
  const all = data.electorate._all;
  if (!e) return null;
  return (
    <div className="grid gap-6">
      <p className="text-sm text-sub leading-relaxed">
        איפה הצביעו מצביעי המפלגה: פילוח הקולות לפי מאפייני היישוב (נתוני למ״ס). הפס הצבעוני = מצביעי המפלגה; הקו השחור (והמספר בסוגריים) = כלל המצביעים.
        {' '}{e.unlocated_votes ? `${e.unlocated_votes.toLocaleString('he-IL')} קולות מעטפות כפולות אינם משויכים ליישוב.` : ''}
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        {['ses', 'periphery', 'population', 'haredi', 'form', 'district'].map((d) => (
          <DimBars key={d} title={{ key: d, he: data.dims_he[d] }} party={e.dims[d] || {}} all={all.dims[d] || {}} color={color} />
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        {[['median_wage', 'שכר חציוני שנתי ביישוב (משוקלל)', (v) => `₪${Math.round(v).toLocaleString('he-IL')}`],
          ['academic_pct', 'בעלי תואר אקדמי ביישוב (משוקלל)', (v) => `${v.toFixed(1)}%`],
          ['turnout', 'אחוז הצבעה ביישובי המצביעים', (v) => `${v.toFixed(1)}%`]].map(([k, l, f]) => (
          <div key={k} className="rounded-lg border border-rule p-3">
            <div className="text-xs text-sub">{l}</div>
            <div className="font-display text-2xl font-bold num">{e.avg[k] != null ? f(e.avg[k]) : '—'}</div>
            <div className="text-[11px] text-sub">כלל המצביעים: {all.avg[k] != null ? f(all.avg[k]) : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
