import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMKs, useParties, useMeta, EDU_LABEL, EDU_ORDER, SECTOR_LABEL, fmt } from '@/lib/data';
import { useMKFilters } from '@/lib/filters';
import FilterPanel from '@/components/FilterPanel';
import { Stat, Loading, Page, Section } from '@/components/bits';
import { HBar, StackedH, VBar, Card } from '@/components/charts';
import { MKLink } from '@/components/MKDrawer';

function median(a) {
  const s = a.filter((x) => x != null).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function SeatStrip({ mks, parties, groups }) {
  const order = parties.filter((p) => p.seats > 0);
  const gs = (groups || []).map((g) => ({ ...g, parties: order.filter((p) => p.group === g.id) }));
  const byParty = Object.fromEntries(order.map((p) => [p.id, mks.filter((m) => m.party === p.id).sort((a, b) => a.list_position - b.list_position)]));
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-[3px]">
        {order.flatMap((p) => byParty[p.id].map((m) => (
          <Link key={m.id} to={`/mk/${m.id}`} title={`${m.name_he} · ${p.name_he}`}
            className="w-4 h-4 sm:w-5 sm:h-5 rounded-[3px] hover:scale-125 transition-transform"
            style={{ background: p.color, outline: m.gender === 'female' ? '2px solid rgb(var(--gold))' : 'none', outlineOffset: -2 }} />
        )))}
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        {gs.map((g) => (
          <div key={g.id} className="flex items-center gap-2">
            <span className="w-1 self-stretch rounded-full" style={{ background: g.color }} />
            <span className="flex flex-wrap gap-x-2">
              {g.parties.map((p) => (
                <Link key={p.id} to={`/party/${p.id}`} className="hover:underline flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />{p.name_he}
                </Link>
              ))}
            </span>
            <span className="mr-auto num font-semibold">{g.parties.reduce((s, p) => s + p.seats, 0)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs hidden">
        {order.map((p) => (
          <Link key={p.id} to={`/party/${p.id}`} className="flex items-center gap-1.5 hover:underline">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />{p.name_he} <span className="text-sub num">{p.seats}</span>
          </Link>
        ))}
        <span className="flex items-center gap-1.5 text-sub"><span className="w-2.5 h-2.5 rounded-sm border-2 border-gold" />מסגרת זהב = חברת כנסת</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const { data: meta } = useMeta();
  const filters = useMKFilters(mks);
  const sel = filters.filtered;

  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);

  const charts = useMemo(() => {
    if (!parties) return null;
    const ps = parties.filter((p) => p.seats > 0);
    const gender = ps.map((p) => {
      const g = sel.filter((m) => m.party === p.id);
      return { label: p.name_he, female: g.filter((m) => m.gender === 'female').length, male: g.filter((m) => m.gender === 'male').length };
    }).filter((r) => r.female + r.male > 0);
    const tenure = ps.map((p) => {
      const g = sel.filter((m) => m.party === p.id);
      return { label: p.name_he, new: g.filter((m) => m.is_new).length, ret: g.filter((m) => !m.is_new).length };
    }).filter((r) => r.new + r.ret > 0);
    const bins = ['עד 39', '40–49', '50–59', '60–69', '70+', 'unknown'];
    const age = bins.map((b) => ({ label: b === 'unknown' ? 'לא ידוע' : b, value: sel.filter((m) => m.age_group === b).length }));
    const edu = EDU_ORDER.map((e) => ({ label: EDU_LABEL[e], value: sel.filter((m) => m.education_level === e).length })).filter((d) => d.value);
    const sc = {};
    sel.forEach((m) => m.sectors.forEach((s) => (sc[s] = (sc[s] || 0) + 1)));
    const sectors = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s, v]) => ({ label: SECTOR_LABEL[s] || s, value: v }));
    return { gender, tenure, age, edu, sectors };
  }, [sel, parties]);

  if (!mks || !parties) return <Loading />;
  const women = sel.filter((m) => m.gender === 'female').length;
  const newMKs = sel.filter((m) => m.is_new).length;
  const degree = sel.filter((m) => ['PhD', 'MD', 'LLB/LLM', 'MA', 'BA'].includes(m.education_level)).length;
  const known = sel.filter((m) => m.education_level !== 'unknown').length;

  return (
    <Page>
      <header className="grid gap-3 max-w-3xl">
        <p className="text-sm text-gold font-semibold">הבחירות לכנסת ה-26 · 27.10.2026</p>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight">מי נבחר לכנסת, ומה אנחנו יודעים עליהם</h1>
        <p className="text-sub leading-relaxed">
          120 חברי הכנסת הנבחרים: רקע אישי, השכלה, קריירה, מקום מגורים, ולמי שכיהן בעבר – כל הצבעה במליאה, הצעות חוק ותפקידים בוועדות.
          כל נתון מקושר למקורו. השבעת הכנסת: {meta?.swearing_in ? new Date(meta.swearing_in).toLocaleDateString('he-IL') : '10.11.2026'}.
        </p>
      </header>

      <SeatStrip mks={mks} parties={parties} groups={meta?.groups} />
      {meta?.groups_source && <p className="text-[11px] text-sub -mt-6">{meta.groups_source}. מסגרת זהב = חברת כנסת.</p>}

      <div className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
        <aside className="lg:sticky lg:top-20 rounded-xl border border-rule p-4 bg-sand/40">
          <FilterPanel mks={mks} parties={parties} filters={filters} count={sel.length} />
        </aside>
        <div className="grid gap-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="חברי כנסת בבחירה" value={sel.length} hint={filters.active ? 'לפי הסינון' : 'כל הכנסת'} />
            <Stat label="נשים" value={women} hint={sel.length ? `${Math.round((women / sel.length) * 100)}%` : ''} />
            <Stat label="חדשים בכנסת" value={newMKs} hint={sel.length ? `${Math.round((newMKs / sel.length) * 100)}%` : ''} />
            <Stat label="גיל חציוני" value={median(sel.map((m) => m.age)) ?? '—'}
              hint={`בעלי תואר אקדמי: ${known ? Math.round((degree / known) * 100) : 0}% מהידועים`} />
          </div>

          {charts && sel.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card title="נשים וגברים לפי מפלגה">
                <StackedH rows={charts.gender} keys={[{ key: 'female', name: 'נשים', color: '#B8A27C' }, { key: 'male', name: 'גברים', color: '#3B4A6B' }]} />
              </Card>
              <Card title="חדשים מול ותיקים">
                <StackedH rows={charts.tenure} keys={[{ key: 'new', name: 'חדשים', color: '#B8A27C' }, { key: 'ret', name: 'כיהנו בעבר', color: '#3B4A6B' }]} />
              </Card>
              <Card title="גיל ביום הבחירות" note="גיל משוער (~) כשידועה רק שנת הלידה">
                <VBar data={charts.age} />
              </Card>
              <Card title="השכלה – התואר הגבוה ביותר">
                <HBar data={charts.edu} />
              </Card>
              <Card title="רקע מקצועי" note="כל חבר/ת כנסת נספר/ת בכל תחום שבו עבד/ה; סכום התחומים עולה על מספר האנשים">
                <HBar data={charts.sectors} />
              </Card>
              <Card title="מהבחירה הנוכחית">
                <ul className="grid gap-1 text-sm max-h-[340px] overflow-auto">
                  {sel.slice().sort((a, b) => a.party.localeCompare(b.party) || a.list_position - b.list_position).map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: partyById[m.party]?.color }} />
                      <MKLink className="hover:underline" id={m.id}>{m.name_he}</MKLink>
                      <span className="text-xs text-sub">{partyById[m.party]?.name_he}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Section title="תוצאות הבחירות">
        <div className="grid gap-2 text-sm">
          {parties.map((p) => (
            <Link to={`/party/${p.id}`} key={p.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[220px_1fr_auto] items-center gap-3 hover:bg-sand/60 rounded-md px-2 py-1">
              <span className="flex items-center gap-2 font-medium"><span className="w-3 h-3 rounded-sm" style={{ background: p.color }} />{p.name_he}</span>
              <span className="hidden sm:block h-2 rounded-full bg-sand"><span className="block h-2 rounded-full" style={{ width: `${(p.pct / 21) * 100}%`, background: p.color }} /></span>
              <span className="num text-sub">{fmt(p.votes)} · {p.pct.toFixed(2)}% · <strong className="text-ink">{p.seats}</strong> מנד׳</span>
            </Link>
          ))}
          {meta && <p className="text-xs text-sub mt-2">מקור: <a className="underline" href={meta.results.source_url} target="_blank" rel="noreferrer">{meta.results.source}</a>. {meta.results.caveat}</p>}
        </div>
      </Section>
    </Page>
  );
}
