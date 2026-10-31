import { useMemo, useState } from 'react';
import { useData, useParties, fmt } from '@/lib/data';
import { Loading, Page, Section } from '@/components/bits';

// public/data/voter_profile.json: one row per local authority — sector, valid votes, CBS / census characteristics (x),
// and each list's share of the vote there (s, %). Everything is weighted by the number of valid votes.
const fmtN = (v, unit) => (v == null || Number.isNaN(v) ? '—' : unit === '₪' ? `₪${fmt(Math.round(v))}` : unit === '%' ? `${v.toFixed(1)}%` : v.toFixed(2));

function wstats(pairs) { // pairs [x, y, w]
  let sw = 0, sx = 0, sy = 0;
  pairs.forEach(([x, y, w]) => { sw += w; sx += w * x; sy += w * y; });
  const mx = sx / sw, my = sy / sw;
  let cxy = 0, cxx = 0, cyy = 0;
  pairs.forEach(([x, y, w]) => { cxy += w * (x - mx) * (y - my); cxx += w * (x - mx) ** 2; cyy += w * (y - my) ** 2; });
  return { r: cxy / Math.sqrt(cxx * cyy), slope: cxy / cxx, mx, my };
}

// weighted least squares with standardised variables -> standardised coefficients and R²
function wls(rows, xs, yk, wk) {
  const data = rows.filter((r) => xs.every((k) => r.x[k] != null) && r.s[yk] != null);
  const W = data.map((r) => r[wk]); const sw = W.reduce((a, b) => a + b, 0);
  const z = (vals) => { const m = vals.reduce((a, v, i) => a + W[i] * v, 0) / sw; const sd = Math.sqrt(vals.reduce((a, v, i) => a + W[i] * (v - m) ** 2, 0) / sw) || 1; return vals.map((v) => (v - m) / sd); };
  const X = xs.map((k) => z(data.map((r) => r.x[k])));
  const Y = z(data.map((r) => r.s[yk]));
  const p = xs.length;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X[i].reduce((a, v, n) => a + W[n] * v * X[j][n], 0)));
  const b = Array.from({ length: p }, (_, i) => X[i].reduce((a, v, n) => a + W[n] * v * Y[n], 0));
  for (let i = 0; i < p; i += 1) { // Gauss-Jordan
    let piv = i; for (let r = i + 1; r < p; r += 1) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]]; [b[i], b[piv]] = [b[piv], b[i]];
    for (let r = 0; r < p; r += 1) { if (r === i) continue; const f = A[r][i] / A[i][i]; for (let c = i; c < p; c += 1) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const beta = b.map((v, i) => v / A[i][i]);
  const fit = Y.map((_, n) => beta.reduce((a, bb, i) => a + bb * X[i][n], 0));
  const sse = Y.reduce((a, y, n) => a + W[n] * (y - fit[n]) ** 2, 0), sst = Y.reduce((a, y, n) => a + W[n] * y * y, 0);
  return { beta, r2: 1 - sse / sst, n: data.length };
}

const heat = (r) => {
  if (r == null || Number.isNaN(r)) return { background: 'transparent' };
  const a = Math.min(1, Math.abs(r));
  if (a < 0.2) return { background: 'rgb(var(--paper))' };
  const c = r > 0 ? '74,110,140' : '154,91,91';
  return { background: `rgba(${c},${0.15 + a * 0.75})`, color: a > 0.55 ? '#fff' : 'inherit' };
};
const REG_VARS = ['se_index', 'age0_17', 'pct_single', 'pct_olim90', 'c_africa'];

export default function VoterProfile() {
  const { data } = useData('voter_profile.json');
  const { data: parties } = useParties();
  const [party, setParty] = useState('likud');
  const [sector, setSector] = useState('jewish');
  const [xv, setXv] = useState('se_index');

  const rows = useMemo(() => (data ? data.rows.filter((r) => sector === 'all' || r.g === sector) : []), [data, sector]);
  // lists with at least 1% of the vote in the selected authorities (others would only add noise)
  const pList = useMemo(() => {
    const tot = rows.reduce((a, r) => a + r.v, 0) || 1;
    return (parties || []).filter((p) => p.seats > 0 && rows.reduce((a, r) => a + r.v * (r.s[p.id] || 0) / 100, 0) / tot >= 0.01);
  }, [parties, rows]);
  const P = pList.some((p) => p.id === party) ? party : pList[0]?.id;

  const profile = useMemo(() => {
    if (!data || !P) return [];
    return Object.entries(data.vars).filter(([k]) => k !== 't26').map(([k, [label, unit]]) => {
      let a = 0, aw = 0, b = 0, bw = 0, sq = 0;
      rows.forEach((r) => {
        const v = r.x[k]; if (v == null) return;
        const pv = r.v * (r.s[P] || 0) / 100;
        a += pv * v; aw += pv; b += r.v * v; bw += r.v;
      });
      const pm = a / aw, all = b / bw;
      rows.forEach((r) => { const v = r.x[k]; if (v != null) sq += r.v * (v - all) ** 2; });
      const sd = Math.sqrt(sq / bw) || 1;
      return { k, label, unit, pm, all, d: (pm - all) / sd };
    }).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  }, [data, rows, P]);

  const corr = useMemo(() => {
    if (!data) return {};
    const out = {};
    pList.forEach((p) => {
      out[p.id] = {};
      Object.keys(data.vars).forEach((k) => {
        const pairs = rows.filter((r) => r.x[k] != null && r.s[p.id] != null).map((r) => [r.x[k], r.s[p.id], r.v]);
        out[p.id][k] = pairs.length > 5 ? wstats(pairs).r : null;
      });
    });
    return out;
  }, [data, rows, pList]);

  const reg = useMemo(() => (data && P && sector !== 'arab' && sector !== 'druze' && rows.length > 15 ? wls(rows, REG_VARS, P, 'v') : null), [data, rows, P, sector]);

  if (!data || !parties) return <Loading />;
  const pById = Object.fromEntries(parties.map((p) => [p.id, p]));
  const p = pById[P];
  const V = data.vars;

  // scatter
  const pts = rows.filter((r) => r.x[xv] != null && r.s[P] != null);
  const st = pts.length > 5 ? wstats(pts.map((r) => [r.x[xv], r.s[P], r.v])) : null;
  const W = 640, H = 320, pad = 36;
  const xs = pts.map((r) => r.x[xv]), ys = pts.map((r) => r.s[P]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(5, ...ys);
  const sx = (x) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * pad), sy = (y) => H - pad - (y / y1) * (H - 2 * pad);
  const maxV = Math.max(...pts.map((r) => r.v), 1);

  return (
    <Page>
      <header className="grid gap-3 max-w-3xl">
        <p className="text-sm text-gold font-semibold">מי בחר בהם</p>
        <h1 className="text-4xl sm:text-5xl">מה מאפיין את מצביעי כל מפלגה</h1>
        <p className="text-sub leading-relaxed">
          ההצבעה בכל רשות מקומית, מול נתוני הלמ״ס עליה: השכלה, הכנסה, גיל, מוצא, עלייה, מגורים. הנתונים הם של רשויות ולא של אנשים – כשמפלגה
          חזקה ברשויות עם הרבה בעלי תואר, זה לא אומר שבעלי התואר עצמם הצביעו לה.
        </p>
      </header>

      <div className="grid gap-3">
        <div className="flex flex-wrap gap-1.5">
          {pList.map((x) => (
            <button key={x.id} onClick={() => setParty(x.id)} aria-pressed={P === x.id}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm ${P === x.id ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink/40'}`}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: x.color }} />{x.name_he}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-sub">
          אילו רשויות:
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-md border border-rule bg-paper px-2 py-1 text-ink">
            {Object.entries(data.sectors).map(([k, l]) => <option key={k} value={k}>{l} ({data.rows.filter((r) => r.g === k).length})</option>)}
            <option value="all">כל הרשויות ({data.rows.length})</option>
          </select>
        </label>
      </div>

      <Section title={`איפה גרים מצביעי ${p?.name_he}`}>
        <p className="text-sm text-sub -mt-2 max-w-3xl">הממוצע ברשויות שבהן גרים מצביעי המפלגה (משוקלל לפי מספר המצביעים שלה בכל רשות), מול הממוצע של כל המצביעים ברשויות שנבחרו. ממוין מההבדל הגדול לקטן.</p>
        <div className="grid gap-1.5 max-w-3xl">
          {profile.map((x) => (
            <div key={x.k} className="grid grid-cols-[minmax(130px,1.2fr)_2fr_auto] items-center gap-3 text-sm">
              <button onClick={() => setXv(x.k)} className={`text-right hover:underline ${xv === x.k ? 'font-semibold' : ''}`}>{x.label}</button>
              <span className="relative h-3 rounded-full bg-sand">
                <span className="absolute top-0 bottom-0 w-px bg-ink/40" style={{ right: '50%' }} />
                <span className="absolute top-0.5 bottom-0.5 rounded-full" style={{ background: p?.color, right: x.d >= 0 ? `${50 - Math.min(48, x.d * 30)}%` : '50%', left: x.d >= 0 ? '50%' : `${50 - Math.min(48, -x.d * 30)}%` }} />
              </span>
              <span className="num text-xs text-sub whitespace-nowrap w-36 text-left"><strong className="text-ink">{fmtN(x.pm, x.unit)}</strong> · כלל המצביעים {fmtN(x.all, x.unit)}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-sub">פס לשמאל = גבוה מהממוצע, לימין = נמוך מהממוצע (ביחידות של סטיית תקן). לחצו על מאפיין כדי לראות את הרשויות בתרשים למטה.</p>
      </Section>

      <Section title={`${p?.name_he} מול ${V[xv][0]}`}>
        <div className="flex flex-wrap items-center gap-2 text-sm -mt-2">
          <select value={xv} onChange={(e) => setXv(e.target.value)} className="rounded-md border border-rule bg-paper px-2 py-1">
            {Object.entries(V).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {st && <span className="text-sub">מתאם r = <strong dir="ltr" className="num text-ink">{st.r.toFixed(2)}</strong> · {pts.length} רשויות</span>}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl h-auto rounded-xl border border-rule bg-paper" style={{ direction: 'ltr' }}>
          <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="rgb(var(--sub))">{V[xv][0]}</text>
          <text x={10} y={pad - 12} fontSize="11" fill="rgb(var(--sub))">% {p?.name_he}</text>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={pad} x2={W - pad} y1={sy(f * y1)} y2={sy(f * y1)} stroke="rgb(var(--rule))" /><text x={pad - 4} y={sy(f * y1) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--sub))">{Math.round(f * y1)}</text></g>)}
          {[x0, (x0 + x1) / 2, x1].map((v, i) => <text key={i} x={sx(v)} y={H - pad + 14} textAnchor="middle" fontSize="10" fill="rgb(var(--sub))">{V[xv][1] === '₪' ? Math.round(v / 1000) + 'K' : Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v)}</text>)}
          {pts.map((r) => (
            <circle key={r.n} cx={sx(r.x[xv])} cy={sy(r.s[P])} r={2 + 10 * Math.sqrt(r.v / maxV)} fill={p?.color} fillOpacity="0.45" stroke={p?.color} strokeWidth="0.5">
              <title>{`${r.n}: ${r.s[P].toFixed(1)}% · ${V[xv][0]} ${fmtN(r.x[xv], V[xv][1])}`}</title>
            </circle>
          ))}
          {st && <line x1={sx(x0)} x2={sx(x1)} y1={sy(st.my + st.slope * (x0 - st.mx))} y2={sy(st.my + st.slope * (x1 - st.mx))} stroke="rgb(var(--ink))" strokeWidth="1.5" strokeDasharray="5 4" />}
        </svg>
        <p className="text-[11px] text-sub">כל עיגול הוא רשות מקומית, בגודל לפי מספר המצביעים בה. רחפו מעל עיגול לשם הרשות. הקו המקווקו: מגמה ליניארית.</p>
      </Section>

      <Section title="כל המפלגות מול כל המאפיינים">
        <p className="text-sm text-sub -mt-2 max-w-3xl">המתאם (r) בין שיעור ההצבעה למפלגה ברשות לבין כל מאפיין. כחול = המפלגה חזקה יותר ברשויות שבהן המאפיין גבוה, אדום = חלשה יותר. לבן = קשר חלש מאוד. לחצו על משבצת לתרשים.</p>
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="text-xs border-separate border-spacing-0.5">
            <thead><tr><th className="sticky right-0 bg-paper z-10" />{pList.map((x) => <th key={x.id} className="font-medium text-sub px-0.5 align-bottom"><span className="block w-14 leading-tight">{x.name_he}</span></th>)}</tr></thead>
            <tbody>
              {Object.entries(V).map(([k, [l]]) => (
                <tr key={k}>
                  <th className="sticky right-0 bg-paper z-10 text-right font-normal pl-2 whitespace-nowrap">{l}</th>
                  {pList.map((x) => {
                    const r = corr[x.id]?.[k];
                    return (
                      <td key={x.id} className="p-0">
                        <button onClick={() => { setParty(x.id); setXv(k); }} title={`${x.name_he} × ${l}: r = ${r?.toFixed(2)}`}
                          dir="ltr" className={`num w-14 h-7 rounded text-[11px] ${P === x.id && xv === k ? 'ring-2 ring-ink' : ''}`} style={heat(r)}>
                          {r == null || Number.isNaN(r) ? '' : r.toFixed(2)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {reg && (
        <Section title={`מה מנבא את ההצבעה ל${p?.name_he}, כשבודקים הכל יחד`}>
          <p className="text-sm text-sub -mt-2 max-w-3xl">
            רגרסיה עם חמישה מאפיינים בבת אחת. המספר הוא המקדם המתוקנן: בכמה סטיות תקן משתנה ההצבעה כשהמאפיין עולה בסטיית תקן אחת והאחרים
            קבועים. R² = כמה מההבדלים בין הרשויות המודל מסביר.
          </p>
          <div className="grid gap-1.5 max-w-xl">
            {REG_VARS.map((k, i) => (
              <div key={k} className="grid grid-cols-[minmax(130px,1fr)_2fr_auto] items-center gap-3 text-sm">
                <span>{V[k][0]}</span>
                <span className="relative h-3 rounded-full bg-sand">
                  <span className="absolute top-0 bottom-0 w-px bg-ink/40" style={{ right: '50%' }} />
                  <span className="absolute top-0.5 bottom-0.5 rounded-full bg-ink/70" style={{ right: reg.beta[i] >= 0 ? `${50 - Math.min(48, reg.beta[i] * 45)}%` : '50%', left: reg.beta[i] >= 0 ? '50%' : `${50 - Math.min(48, -reg.beta[i] * 45)}%` }} />
                </span>
                <span dir="ltr" className="num text-xs w-10 text-left">{reg.beta[i].toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="text-sm">R² = <strong className="num">{reg.r2.toFixed(2)}</strong> · {reg.n} רשויות</p>
        </Section>
      )}

      <p className="text-xs text-sub max-w-3xl leading-relaxed">
        מקור: {data.source} הניתוח לפי רשות, על הקלפיות הרגילות (המעטפות הכפולות לא משויכות ליישוב). כל החישובים משוקללים לפי מספר הקולות.
        מועצה אזורית נספרת כרשות אחת.
      </p>
    </Page>
  );
}
