import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';

const tick = { fontSize: 12, fill: '#626876' };
const INK = '#3B4A6B';
const tip = { contentStyle: { background: 'rgb(var(--paper))', border: '1px solid rgb(var(--rule))', borderRadius: 8, direction: 'rtl', fontSize: 12 } };

/** Horizontal bar of counts. data: [{label, value, color?}] */
export function HBar({ data, height, unit = '', max }) {
  const h = height || Math.max(120, data.length * 30 + 20);
  return (
    <div dir="ltr"><ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#e2dcd0" />
        <XAxis type="number" tick={tick} reversed domain={[0, max || 'auto']} allowDecimals={false} unit={unit} />
        <YAxis type="category" dataKey="label" tick={tick} width={120} orientation="right" interval={0} />
        <Tooltip {...tip} formatter={(v) => [`${v}${unit}`, '']} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="value" radius={[4, 0, 0, 4]} fill={INK} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.color || INK} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>
  );
}

/** Stacked horizontal bars per category. rows: [{label, ...keys}], keys: [{key, name, color}] */
export function StackedH({ rows, keys, height, percent = false }) {
  const h = height || Math.max(140, rows.length * 30 + 50);
  const data = percent
    ? rows.map((r) => {
      const tot = keys.reduce((s, k) => s + (r[k.key] || 0), 0) || 1;
      const o = { label: r.label };
      keys.forEach((k) => (o[k.key] = Math.round(((r[k.key] || 0) / tot) * 1000) / 10));
      return o;
    })
    : rows;
  return (
    <div dir="ltr"><ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#e2dcd0" />
        <XAxis type="number" tick={tick} reversed domain={percent ? [0, 100] : [0, 'auto']} unit={percent ? '%' : ''} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={tick} width={120} orientation="right" interval={0} />
        <Tooltip {...tip} formatter={(v, n) => [percent ? `${v}%` : v, n]} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 12, direction: 'rtl' }} />
        {keys.map((k) => <Bar key={k.key} dataKey={k.key} name={k.name} stackId="s" fill={k.color} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer></div>
  );
}

/** Vertical histogram. data: [{label, value}] */
export function VBar({ data, height = 220, color = INK }) {
  return (
    <div dir="ltr"><ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#e2dcd0" />
        <XAxis dataKey="label" tick={tick} reversed interval={0} />
        <YAxis tick={tick} orientation="right" allowDecimals={false} width={30} />
        <Tooltip {...tip} formatter={(v) => [v, 'חברי כנסת']} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer></div>
  );
}

export function Card({ title, note, children }) {
  return (
    <div className="rounded-xl border border-rule bg-paper p-4 grid gap-3 content-start">
      <div>
        <h3 className="font-bold text-lg leading-tight">{title}</h3>
        {note && <p className="text-xs text-sub mt-0.5">{note}</p>}
      </div>
      {children}
    </div>
  );
}
