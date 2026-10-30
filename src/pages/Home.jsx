import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';
import { useMKs, useParties, useMeta, EDU_LABEL, EDU_ORDER, SECTOR_LABEL, fmt } from '@/lib/data';
import { PER_B } from '@/lib/filters';
import { Loading, Page, Section } from '@/components/bits';
import { MKLink, useOpenMK } from '@/components/MKDrawer';
import Hemicycle from '@/components/Hemicycle';

/* ---------- the one filter on this page: the chips above the chamber + a party/bloc pick ---------- */
const CHIPS = [
  ['', 'כל הכנסת'],
  ['female', 'נשים'],
  ['male', 'גברים'],
  ['new', 'חדשים בכנסת'],
  ['returning', 'כיהנו בעבר'],
];
const chipMatch = { female: (m) => m.gender === 'female', male: (m) => m.gender === 'male', new: (m) => m.is_new, returning: (m) => !m.is_new };

function median(a) {
  const s = a.filter((x) => x != null).sort((x, y) => x - y);
  if (!s.length) return null;
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : Math.round((s[k - 1] + s[k]) / 2);
}

/* ---------- small, quiet visual pieces ---------- */
function Bars({ rows, total }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(84px,auto)_1fr_auto] items-center gap-2 text-sm">
          <span className="text-sub truncate">{r.label}</span>
          <span className="h-2 rounded-full bg-sand overflow-hidden">
            <span className="block h-full rounded-full bg-ink/70" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="num text-xs text-sub w-14 text-left">{r.value}{total ? ` · ${Math.round((r.value / total) * 100)}%` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

function Split({ a, b, total }) {
  const pa = total ? (a.value / total) * 100 : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-sand">
        <span className="block h-full bg-ink/75" style={{ width: `${pa}%` }} />
        <span className="block h-full bg-gold/45" style={{ width: `${100 - pa}%` }} />
      </div>
      <div className="flex justify-between text-xs text-sub num">
        <span><span className="inline-block w-2 h-2 rounded-full bg-ink/75 ml-1" />{a.label} {a.value}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-gold/45 ml-1" />{b.label} {b.value}</span>
      </div>
    </div>
  );
}

function Fact({ title, big, sub, children }) {
  return (
    <div className="rounded-2xl border border-rule bg-paper p-5 grid gap-3 content-start">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-2xl leading-none">{title}</h3>
        {big != null && <span className="font-title text-4xl leading-none num">{big}</span>}
      </div>
      {sub && <p className="text-xs text-sub -mt-2">{sub}</p>}
      {children}
    </div>
  );
}

function FindMK({ mks, partyById }) {
  const [q, setQ] = useState('');
  const openMK = useOpenMK();
  const res = useMemo(() => {
    const s = q.trim();
    if (s.length < 2) return [];
    return mks.filter((m) => `${m.name_he} ${m.residence?.name || ''} ${m.birthplace || ''}`.includes(s)).slice(0, 8);
  }, [q, mks]);
  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-sub" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חפשו חבר/ת כנסת או יישוב"
        className="w-full rounded-full border border-rule bg-paper pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:border-ink/50" />
      {res.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-xl border border-rule bg-paper shadow-lg overflow-hidden">
          {res.map((m) => (
            <li key={m.id}>
              <button onClick={() => { setQ(''); openMK(m.id); }} className="w-full text-right px-4 py-2 text-sm hover:bg-sand flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: partyById[m.party]?.color }} />
                <span className="font-medium">{m.name_he}</span>
                <span className="text-xs text-sub mr-auto">{partyById[m.party]?.name_he}{m.residence?.name ? ` · ${m.residence.name}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DOORS = [
  ['/parties', 'מפלגות', 'הרכב כל רשימה, ומי הצביע לה: פרופיל הבוחרים לפי נתוני הלמ״ס'],
  ['/represent', 'את מי הם מייצגים', 'מאיפה מגיעים חברי הכנסת ומאיפה מגיעים הבוחרים שלהם'],
  ['/votes', 'הצבעות במליאה', 'כל הצבעה מאז 2003 (הכנסת ה-16), ואיך הצביע כל מי שחוזר לכנסת'],
  ['/topics', 'מי מצביע עם מי', 'קבוצות לפי דפוסי הצבעה בכל נושא, ואיך המפלגות מתחלקות ביניהן'],
];

export default function Home() {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const { data: meta } = useMeta();
  const [chip, setChip] = useState('');
  const [party, setParty] = useState('');
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);

  const match = useMemo(() => {
    if (!chip && !party) return null;
    return (m) => (!chip || chipMatch[chip](m)) && (!party || m.party === party);
  }, [chip, party]);
  const label = [CHIPS.find((c) => c[0] === chip)?.[1], partyById[party]?.name_he].filter((x) => x && x !== 'כל הכנסת').join(' · ');
  const sel = useMemo(() => (mks ? (match ? mks.filter(match) : mks) : []), [mks, match]);

  const facts = useMemo(() => {
    const N = sel.length;
    const ages = sel.map((m) => m.age).filter((x) => x != null);
    const bins = ['עד 39', '40–49', '50–59', '60–69', '70+'];
    const age = bins.map((b) => ({ label: b, value: sel.filter((m) => m.age_group === b).length }));
    const degree = sel.filter((m) => ['PhD', 'MD', 'LLB/LLM', 'MA', 'BA'].includes(m.education_level)).length;
    const knownEdu = sel.filter((m) => m.education_level !== 'unknown').length;
    const edu = EDU_ORDER.filter((e) => e !== 'unknown').map((e) => ({ label: EDU_LABEL[e], value: sel.filter((m) => m.education_level === e).length })).filter((d) => d.value);
    const sc = {};
    sel.forEach((m) => m.sectors.forEach((s) => (sc[s] = (sc[s] || 0) + 1)));
    const sectors = Object.entries(sc).filter(([s]) => s !== 'politics_party' && s !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, v]) => ({ label: SECTOR_LABEL[s] || s, value: v }));
    const per = { periphery: 0, middle: 0, center: 0 };
    sel.forEach((m) => { const b = PER_B(m.residence?.periphery_cluster); if (b) per[b] += 1; });
    const lc = {};
    sel.forEach((m) => { if (m.residence?.name) lc[m.residence.name] = (lc[m.residence.name] || 0) + 1; });
    const towns = Object.entries(lc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
    return {
      N, age, edu, sectors, towns,
      med: median(ages), min: ages.length ? Math.min(...ages) : null, max: ages.length ? Math.max(...ages) : null,
      women: sel.filter((m) => m.gender === 'female').length, men: sel.filter((m) => m.gender === 'male').length,
      fresh: sel.filter((m) => m.is_new).length, degreePct: knownEdu ? Math.round((degree / knownEdu) * 100) : null,
      per: [{ label: 'פריפריה (מדד 1–3)', value: per.periphery }, { label: 'ביניים (4–6)', value: per.middle }, { label: 'מרכז (7–10)', value: per.center }],
      perKnown: per.periphery + per.middle + per.center,
    };
  }, [sel]);

  if (!mks || !parties) return <Loading />;
  const seated = parties.filter((p) => p.seats > 0);

  return (
    <Page>
      <header className="grid gap-4 max-w-3xl">
        <p className="text-sm text-gold font-semibold">הבחירות לכנסת ה-26 · 27.10.2026</p>
        <h1 className="text-4xl sm:text-6xl leading-tight">מי נבחר לכנסת, ומה אנחנו יודעים עליהם</h1>
        <p className="text-sub leading-relaxed">
          120 חברי הכנסת הנבחרים: רקע אישי, השכלה, קריירה, מקום מגורים, ולמי שכיהן בעבר – כל הצבעה במליאה, הצעות חוק ותפקידים בוועדות. כל נתון מקושר למקורו.
        </p>
        <FindMK mks={mks} partyById={partyById} />
      </header>

      {/* The chamber is the page's only filter. */}
      <section className="grid gap-5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CHIPS.map(([v, l]) => (
            <button key={v} onClick={() => setChip(v)} aria-pressed={chip === v}
              className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${chip === v ? 'border-ink bg-ink text-paper' : 'border-rule text-sub hover:border-ink/40 hover:text-ink'}`}>{l}</button>
          ))}
          <select value={party} onChange={(e) => setParty(e.target.value)} aria-label="בחירת מפלגה"
            className={`px-3 py-1.5 rounded-full border text-sm bg-paper ${party ? 'border-ink text-ink' : 'border-rule text-sub'}`}>
            <option value="">כל המפלגות</option>
            {seated.map((p) => <option key={p.id} value={p.id}>{p.name_he}</option>)}
          </select>
        </div>
        <Hemicycle mks={mks} parties={parties} groups={meta?.groups} match={match} label={label} />
        {meta?.groups_source && <p className="text-[11px] text-sub text-center">{meta.groups_source}. הקבוצות מוצגות בצבעים בלבד, ללא שמות.</p>}
      </section>

      <Section title={match ? `${label}: ${facts.N} חברי כנסת` : 'מי בכנסת ה-26'}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Fact title="נשים וגברים" big={facts.N ? `${Math.round((facts.women / facts.N) * 100)}%` : '—'} sub="שיעור הנשים">
            <Split a={{ label: 'נשים', value: facts.women }} b={{ label: 'גברים', value: facts.men }} total={facts.N} />
          </Fact>
          <Fact title="חדשים בכנסת" big={facts.fresh} sub={`מתוך ${facts.N} · השאר כיהנו בכנסת קודמת`}>
            <Split a={{ label: 'חדשים', value: facts.fresh }} b={{ label: 'כיהנו בעבר', value: facts.N - facts.fresh }} total={facts.N} />
          </Fact>
          <Fact title="גיל ביום הבחירות" big={facts.med ?? '—'} sub={facts.min != null ? `גיל חציוני · הצעיר/ה ${facts.min}, המבוגר/ת ${facts.max}` : ''}>
            <Bars rows={facts.age} />
          </Fact>
          <Fact title="השכלה" big={facts.degreePct != null ? `${facts.degreePct}%` : '—'} sub="בעלי תואר אקדמי, מתוך הידועים">
            <Bars rows={facts.edu} />
          </Fact>
          <Fact title="רקע מקצועי" sub="אדם נספר בכל תחום שעבד בו">
            <Bars rows={facts.sectors} />
          </Fact>
          <Fact title="מקום מגורים" sub="לפי מדד הפריפריאליות של הלמ״ס ליישוב">
            <Bars rows={facts.per} total={facts.perKnown} />
            <div className="text-xs text-sub pt-1 border-t border-rule">
              יישובים מובילים: {facts.towns.map((t) => `${t.label} (${t.value})`).join(' · ')}
            </div>
          </Fact>
        </div>
        {match && (
          <div className="flex flex-wrap gap-1.5 text-sm">
            {sel.slice().sort((a, b) => a.party.localeCompare(b.party) || a.list_position - b.list_position).map((m) => (
              <MKLink key={m.id} id={m.id} className="flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1 hover:border-ink/40">
                <span className="w-2 h-2 rounded-full" style={{ background: partyById[m.party]?.color }} />{m.name_he}
              </MKLink>
            ))}
          </div>
        )}
      </Section>

      <Section title="להעמיק">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DOORS.map(([to, t, d]) => (
            <Link key={to} to={to} className="group rounded-2xl border border-rule p-5 grid gap-2 content-start hover:border-ink/40 transition-colors">
              <span className="flex items-center justify-between font-semibold">{t}<ArrowLeft size={16} className="text-sub group-hover:text-ink transition-transform group-hover:-translate-x-1" /></span>
              <span className="text-sm text-sub leading-relaxed">{d}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="תוצאות הבחירות">
        <div className="grid gap-2 text-sm">
          {parties.map((p) => (
            <Link to={`/party/${p.id}`} key={p.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[220px_1fr_auto] items-center gap-3 hover:bg-sand/60 rounded-md px-2 py-1">
              <span className="flex items-center gap-2 font-medium"><span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />{p.name_he}</span>
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
