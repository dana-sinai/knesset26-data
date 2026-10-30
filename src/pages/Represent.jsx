import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMKs, useParties, useData } from '@/lib/data';
import { SES_B, PER_B, POP_B } from '@/lib/filters';
import { Loading, Page } from '@/components/bits';

const DIMS = {
  ses: { he: 'אשכול חברתי-כלכלי של היישוב', cols: [['1–3', 'low'], ['4–6', 'mid'], ['7–10', 'high']], mk: (P) => SES_B(P?.socioeconomic_cluster) },
  periphery: { he: 'פריפריאליות', cols: [['1–3 (פריפריה)', 'periphery'], ['4–6', 'middle'], ['7–10 (מרכז)', 'center']], mk: (P) => PER_B(P?.periphery_cluster) },
  population: { he: 'הרכב אוכלוסיית היישוב', cols: [['יישוב יהודי (90%+)', 'jewish'], ['יישוב מעורב', 'mixed'], ['יישוב ערבי (90%+)', 'arab']], mk: (P) => POP_B(P?.arab_pct) },
};
const LENS = [['voters', 'מצביעי המפלגה'], ['residence', 'הנבחרים – מקום מגורים'], ['birthplace', 'הנבחרים – מקום לידה']];

function shade(v) {
  const a = Math.min(1, v / 80);
  return { background: `rgba(24,32,51,${0.06 + a * 0.75})`, color: a > 0.5 ? '#fff' : 'inherit' };
}

export default function Represent() {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const { data: el } = useData('electorate.json');
  const [dim, setDim] = useState('ses');
  const [lens, setLens] = useState('voters');

  const rows = useMemo(() => {
    if (!mks || !parties || !el) return [];
    const D = DIMS[dim];
    const ps = parties.filter((p) => p.seats > 0);
    const mkRow = (list) => {
      const known = list.map((m) => D.mk(lens === 'birthplace' ? m.birthplace_loc : m.residence)).filter(Boolean);
      return { n: known.length, vals: D.cols.map(([, b]) => (known.length ? (100 * known.filter((x) => x === b).length) / known.length : null)) };
    };
    const out = ps.map((p) => {
      if (lens === 'voters') {
        const d = el.electorate[p.id]?.dims?.[dim] || {};
        return { p, n: null, vals: D.cols.map(([k]) => d[k] ?? 0) };
      }
      return { p, ...mkRow(mks.filter((m) => m.party === p.id)) };
    });
    const allD = el.electorate._all.dims[dim];
    out.push(lens === 'voters'
      ? { p: { id: '_all', name_he: 'כלל המצביעים', color: '#888' }, vals: D.cols.map(([k]) => allD[k] ?? 0) }
      : { p: { id: '_all', name_he: 'כל 120 הנבחרים', color: '#888' }, ...mkRow(mks) });
    return out;
  }, [mks, parties, el, dim, lens]);

  if (!mks || !parties || !el) return <Loading />;
  const D = DIMS[dim];
  return (
    <Page>
      <header className="grid gap-2 max-w-3xl">
        <h1 className="text-4xl font-black">את מי הם מייצגים</h1>
        <p className="text-sub leading-relaxed">
          שלוש עדשות על אותה שאלה: איפה הצביעו מצביעי כל מפלגה, איפה גרים הנבחרים שלה, ואיפה הם נולדו – כולן לפי מאפייני היישוב בנתוני הלמ״ס.
          השוואה בין העדשות מראה אם הנבחרים באים מאותם מקומות כמו מצביעיהם.
        </p>
      </header>
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex rounded-lg border border-rule overflow-hidden text-sm">
          {Object.entries(DIMS).map(([k, v]) => <button key={k} onClick={() => setDim(k)} className={`px-3 py-1.5 ${dim === k ? 'bg-ink text-paper' : ''}`}>{v.he}</button>)}
        </div>
        <div className="flex rounded-lg border border-rule overflow-hidden text-sm">
          {LENS.map(([k, l]) => <button key={k} onClick={() => setLens(k)} className={`px-3 py-1.5 ${lens === k ? 'bg-gold text-ink' : ''}`}>{l}</button>)}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-rule">
        <table className="w-full text-sm">
          <thead className="bg-sand/60 text-xs text-sub">
            <tr>
              <th className="text-right font-medium px-3 py-2">מפלגה</th>
              {D.cols.map(([k]) => <th key={k} className="text-center font-medium px-3 py-2">{k}</th>)}
              {lens !== 'voters' && <th className="text-center font-medium px-3 py-2">נבחרים עם נתון</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id} className={`border-t border-rule ${r.p.id === '_all' ? 'font-semibold' : ''}`}>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm ml-1.5" style={{ background: r.p.color }} />
                  {r.p.id === '_all' ? r.p.name_he : <Link className="hover:underline" to={`/party/${r.p.id}`}>{r.p.name_he}</Link>}
                </td>
                {r.vals.map((v, i) => (
                  <td key={i} className="px-3 py-1.5 text-center num" style={v == null ? {} : shade(v)}>{v == null ? '—' : `${v.toFixed(0)}%`}</td>
                ))}
                {lens !== 'voters' && <td className="px-3 py-1.5 text-center num text-sub">{r.n}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-sub grid gap-1 max-w-3xl leading-relaxed">
        <p><strong>מצביעים:</strong> קולות כל מפלגה לפי קלפי (ועדת הבחירות, ספירה סופית), מצורפים ליישוב ולמאפייניו. ללא קולות המעטפות הכפולות.</p>
        <p><strong>נבחרים:</strong> יישוב המגורים / הלידה לפי מקורות פומביים, ברמת יישוב. נבחרים ללא נתון, או שנולדו בחו״ל, אינם נספרים בעדשה זו.</p>
        <p><strong>מגבלה:</strong> הניתוח הוא ברמת יישוב. בערים גדולות ומגוונות (ירושלים, תל אביב, חיפה) הממוצע מסתיר הבדלים גדולים בין שכונות. השלב הבא: ניתוח ברמת אזור סטטיסטי (קלפי ← אזור סטטיסטי) לקולות המצביעים.</p>
      </div>
    </Page>
  );
}
