import { useMemo } from 'react';
import { useMKs, useParties, useData } from '@/lib/data';
import { useMKFilters } from '@/lib/filters';
import FilterPanel from '@/components/FilterPanel';
import MKMap from '@/components/MKMap';
import { Loading, Page } from '@/components/bits';

export default function MapPage() {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const { data: locs } = useData('localities.json');
  const filters = useMKFilters(mks);
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  if (!mks || !parties) return <Loading />;
  const sel = filters.filtered;
  const place = filters.f.place;
  const mapped = sel.filter((m) => (place === 'birthplace' ? m.birthplace_loc?.lat : m.residence?.lat)).length;
  const abroad = sel.filter((m) => m.born_abroad).reduce((c, m) => ((c[m.born_country] = (c[m.born_country] || 0) + 1), c), {});

  return (
    <Page>
      <header className="grid gap-2">
        <h1 className="text-4xl font-black">מאיפה הם באים</h1>
        <p className="text-sub max-w-3xl">
          יישוב המגורים או יישוב הלידה של כל חבר/ת כנסת, ברמת יישוב בלבד (לא כתובת ולא שכונה). לחיצה על עיגול מציגה את הנבחרים מהיישוב ואת נתוני הלמ״ס שלו.
          החליפו בין "מקום מגורים" ל"מקום לידה" בחלונית הסינון.
        </p>
      </header>
      <div className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
        <aside className="lg:sticky lg:top-20 rounded-xl border border-rule p-4 bg-sand/40">
          <FilterPanel mks={mks} parties={parties} filters={filters} count={sel.length} />
        </aside>
        <div className="grid gap-3">
          <p className="text-sm text-sub">{mapped} מתוך {sel.length} ממוקמים על המפה לפי {place === 'birthplace' ? 'מקום לידה בישראל' : 'מקום מגורים'}.</p>
          <MKMap mks={sel} partyById={partyById} mode={place} localities={locs} height={600} />
          {place === 'birthplace' && Object.keys(abroad).length > 0 && (
            <div className="text-sm">
              <strong>נולדו מחוץ לישראל: </strong>
              {Object.entries(abroad).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`).join(' · ')}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
