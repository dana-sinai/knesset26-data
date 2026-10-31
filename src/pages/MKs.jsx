import { useMemo, useState } from 'react';
import { LayoutGrid, Table2, Download, SlidersHorizontal } from 'lucide-react';
import { useMKs, useParties, EDU_LABEL, EDU_ORDER, pct } from '@/lib/data';
import { useMKFilters, METRICS, metricValue } from '@/lib/filters';
import FilterPanel from '@/components/FilterPanel';
import { MKCard, Loading, Page } from '@/components/bits';
import { MKLink } from '@/components/MKDrawer';

const SORTS = {
  party: (a, b) => a.party.localeCompare(b.party) || a.list_position - b.list_position,
  name: (a, b) => a.name_he.localeCompare(b.name_he, 'he'),
  age: (a, b) => (a.age ?? 999) - (b.age ?? 999),
  terms: (a, b) => b.prior_terms.length - a.prior_terms.length,
};
METRICS.forEach((d) => { SORTS[d.key] = (a, b) => (metricValue(b, d) ?? -1) - (metricValue(a, d) ?? -1); });

// table columns: [header, value used for sorting, text = sort A→Z first (otherwise high→low first)]
const COLS = [
  ['שם', (m) => m.name_he, true],
  ['מפלגה', (m) => m.party, true],
  ['מקום', (m) => m.list_position, true],
  ['מגדר', (m) => m.gender, true],
  ['גיל', (m) => m.age],
  ['מגורים', (m) => m.residence?.name, true],
  ['השכלה', (m) => (m.education_level && m.education_level !== 'unknown' ? EDU_ORDER.length - EDU_ORDER.indexOf(m.education_level) : null)],
  ['כנסות קודמות', (m) => m.prior_terms.length],
  ['כמו הסיעה', (m) => m.metrics?.faction_rate],
  ['השתתפות במליאה', (m) => m.metrics?.participation],
  ['הצעות חוק לכנסת', (m) => m.metrics?.bills_per_k],
  ['הפכו לחוק', (m) => m.metrics?.bills_passed],
  ['נוכחות בוועדות', (m) => m.metrics?.cmt_rate],
  ['ישיבות ועדה לכנסת', (m) => m.metrics?.cmt_per_k],
];
function byColumn(i, dir) {
  const [, get, text] = COLS[i];
  return (a, b) => {
    const x = get(a), y = get(b);
    if (x == null || x === '') return y == null || y === '' ? 0 : 1; // empty values always last
    if (y == null || y === '') return -1;
    const c = text && typeof x === 'string' ? x.localeCompare(y, 'he') : x - y;
    return dir === 'asc' ? c : -c;
  };
}

export default function MKs() {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const filters = useMKFilters(mks);
  const [view, setView] = useState('cards');
  const [panel, setPanel] = useState(true); // side filter panel (desktop)
  const [sort, setSort] = useState('party');
  const [col, setCol] = useState(null); // { i, dir } when sorted by clicking a table header
  const clickCol = (i) => setCol((c) => (c && c.i === i ? { i, dir: c.dir === 'asc' ? 'desc' : 'asc' } : { i, dir: COLS[i][2] ? 'asc' : 'desc' }));
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  const list = useMemo(() => filters.filtered.slice().sort(col ? byColumn(col.i, col.dir) : SORTS[sort]), [filters.filtered, sort, col]);
  if (!mks || !parties) return <Loading />;

  return (
    <Page>
      <header className="grid gap-2">
        <h1 className="text-4xl font-black">חברי הכנסת ה-26</h1>
        <p className="text-sub">כל מה שידוע על חברי הכנסת אפשר לסנן ולמיין: רקע אישי, מקום מגורים, ולמי שכיהן/ה – הצבעות, הצעות חוק ונוכחות בוועדות.</p>
      </header>
      <div className={`grid gap-8 items-start ${panel ? 'lg:grid-cols-[300px_1fr]' : ''}`}>
        <aside className={`lg:sticky lg:top-20 rounded-xl border border-rule p-4 bg-sand/40 ${panel ? '' : 'lg:hidden'}`}>
          <FilterPanel mks={mks} parties={parties} filters={filters} count={list.length} />
        </aside>
        <div className="grid gap-4 content-start">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            {view === 'table' ? <span className="text-xs text-sub">לחצו על כותרת עמודה כדי למיין לפיה</span> : <div className="flex items-center gap-2 text-sm">
              <span className="text-sub">מיון:</span>
              <select value={sort} onChange={(e) => { setSort(e.target.value); setCol(null); }} className="rounded-md border border-rule bg-paper px-2 py-1">
                <option value="party">מפלגה ומקום ברשימה</option>
                <option value="name">שם</option>
                <option value="age">גיל</option>
                {METRICS.map((d) => <option key={d.key} value={d.key}>{d.label} (מהגבוה)</option>)}
              </select>
            </div>}
            <div className="flex items-center gap-1">
              <button onClick={() => setPanel(!panel)} className="hidden lg:flex items-center gap-1 text-xs border border-rule rounded-md px-2 py-1.5 hover:bg-sand">
                <SlidersHorizontal size={14} />{panel ? 'הסתרת הסינון' : `סינון${filters.active ? ' (פעיל)' : ''}`}
              </button>
              <a href="/data/mks.csv" download className="flex items-center gap-1 text-xs border border-rule rounded-md px-2 py-1.5 hover:bg-sand"><Download size={14} />CSV</a>
              <button onClick={() => setView('cards')} aria-label="כרטיסים" className={`p-1.5 rounded-md ${view === 'cards' ? 'bg-ink text-paper' : 'hover:bg-sand'}`}><LayoutGrid size={16} /></button>
              <button onClick={() => setView('table')} aria-label="טבלה" className={`p-1.5 rounded-md ${view === 'table' ? 'bg-ink text-paper' : 'hover:bg-sand'}`}><Table2 size={16} /></button>
            </div>
          </div>
          {view === 'cards' ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {list.map((m) => <MKCard key={m.id} m={m} party={partyById[m.party]} />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-rule">
              <table className="w-full text-sm">
                <thead className="bg-sand/60 text-xs text-sub">
                  <tr>{COLS.map(([h], i) => (
                    <th key={h} aria-sort={col?.i === i ? (col.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-right font-medium p-0 whitespace-nowrap">
                      <button onClick={() => clickCol(i)} title="לחצו למיון" className={`w-full text-right px-3 py-2 hover:text-ink ${col?.i === i ? 'text-ink' : ''}`}>
                        {h}<span className="mr-1 inline-block w-3">{col?.i === i ? (col.dir === 'asc' ? '▲' : '▼') : ''}</span>
                      </button>
                    </th>
                  ))}</tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} className="border-t border-rule hover:bg-sand/40">
                      <td className="px-3 py-1.5 whitespace-nowrap"><MKLink className="hover:underline font-medium" id={m.id}>{m.name_he}</MKLink></td>
                      <td className="px-3 py-1.5 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: partyById[m.party]?.color }} />{partyById[m.party]?.name_he}</td>
                      <td className="px-3 py-1.5 num">{m.list_position}</td>
                      <td className="px-3 py-1.5">{m.gender === 'female' ? 'אישה' : m.gender === 'male' ? 'גבר' : '—'}</td>
                      <td className="px-3 py-1.5 num">{m.age != null ? `${m.age_approx ? '~' : ''}${m.age}` : '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{m.residence?.name || '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{EDU_LABEL[m.education_level]}</td>
                      <td className="px-3 py-1.5 num whitespace-nowrap" title={m.prior_terms.join(', ')}>
                        {!m.prior_terms.length ? 'חדש/ה' : m.prior_terms.length <= 2 ? m.prior_terms.join(', ') : `${m.prior_terms.length} (${Math.min(...m.prior_terms)}–${Math.max(...m.prior_terms)})`}
                      </td>
                      <td className="px-3 py-1.5 num">{pct(m.metrics?.faction_rate, 1)}</td>
                      <td className="px-3 py-1.5 num">{pct(m.metrics?.participation)}</td>
                      <td className="px-3 py-1.5 num">{m.metrics?.bills_per_k ?? '—'}</td>
                      <td className="px-3 py-1.5 num">{m.metrics?.bills_passed ?? '—'}</td>
                      <td className="px-3 py-1.5 num">{pct(m.metrics?.cmt_rate)}</td>
                      <td className="px-3 py-1.5 num">{m.metrics?.cmt_per_k ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!list.length && <p className="text-sub text-sm py-8 text-center">אין חברי כנסת שתואמים לסינון.</p>}
        </div>
      </div>
    </Page>
  );
}
