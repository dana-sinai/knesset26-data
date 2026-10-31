import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useMKs, useParties, useMeta, EDU_LABEL, EDU_ORDER, SECTOR_LABEL } from '@/lib/data';
import { PER_B } from '@/lib/filters';
import { Loading, Page, Section } from '@/components/bits';
import { MKLink, useOpenMK } from '@/components/MKDrawer';
import Hemicycle from '@/components/Hemicycle';

/* ---------- one filter for the whole page: chips, party, and every bar below ---------- */
const CHIPS = [
  ['gender', 'female', 'נשים'],
  ['gender', 'male', 'גברים'],
  ['tenure', 'new', 'חדשים בכנסת'],
  ['tenure', 'returning', 'כיהנו בעבר'],
];
const AGE_BINS = ['עד 39', '40–49', '50–59', '60–69', '70+'];
const PER_LABELS = { periphery: 'פריפריה (מדד 1–3)', middle: 'ביניים (4–6)', center: 'מרכז (7–10)' };
const TEST = {
  gender: (m, v) => m.gender === v,
  tenure: (m, v) => (v === 'new' ? m.is_new : !m.is_new),
  party: (m, v) => m.party === v,
  age: (m, v) => m.age_group === v,
  edu: (m, v) => m.education_level === v,
  sector: (m, v) => (m.sectors || []).includes(v),
  per: (m, v) => PER_B(m.residence?.periphery_cluster) === v,
};
const facetLabel = (k, v, partyById) => ({
  gender: { female: 'נשים', male: 'גברים' }[v], tenure: { new: 'חדשים', returning: 'כיהנו בעבר' }[v],
  party: partyById[v]?.name_he, age: `גיל ${v}`, edu: EDU_LABEL[v], sector: SECTOR_LABEL[v] || v, per: PER_LABELS[v],
}[k]);

function median(a) {
  const s = a.filter((x) => x != null).sort((x, y) => x - y);
  if (!s.length) return null;
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : Math.round((s[k - 1] + s[k]) / 2);
}

/* ---------- small, quiet visual pieces; every bar is a filter ---------- */
function Bars({ rows, total, active, onPick }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-1">
      {rows.map((r) => {
        const on = active === r.key;
        const dim = active != null && !on;
        return (
          <li key={r.key}>
            <button onClick={() => onPick(on ? null : r.key)} aria-pressed={on} title={on ? 'ביטול הסינון' : `סינון: ${r.label}`}
              className={`w-full grid grid-cols-[minmax(84px,auto)_1fr_auto] items-center gap-2 text-sm rounded-md px-1 py-0.5 text-right transition-colors ${on ? 'bg-sand' : 'hover:bg-sand/60'}`}>
              <span className={`truncate ${on ? 'text-ink font-medium' : 'text-sub'}`}>{r.label}</span>
              <span className="h-2 rounded-full bg-sand overflow-hidden">
                <span className={`block h-full rounded-full ${dim ? 'bg-ink/25' : 'bg-ink/70'}`} style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
              <span className="num text-xs text-sub w-14 text-left">{r.value}{total ? ` · ${Math.round((r.value / total) * 100)}%` : ''}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Split({ a, b, total, active, onPick }) {
  const pa = total ? (a.value / total) * 100 : 0;
  const seg = (x, w, cls) => (
    <button onClick={() => onPick(active === x.key ? null : x.key)} title={`סינון: ${x.label}`} aria-pressed={active === x.key}
      className={`block h-full ${cls} ${active != null && active !== x.key ? 'opacity-30' : ''} hover:opacity-80`} style={{ width: `${w}%` }} />
  );
  return (
    <div className="grid gap-1.5">
      <div className="flex h-3 rounded-full overflow-hidden bg-sand">
        {seg(a, pa, 'bg-ink/75')}
        {seg(b, 100 - pa, 'bg-gold/45')}
      </div>
      <div className="flex justify-between text-xs num">
        {[[a, 'bg-ink/75'], [b, 'bg-gold/45']].map(([x, c]) => (
          <button key={x.key} onClick={() => onPick(active === x.key ? null : x.key)}
            className={`rounded px-1 ${active === x.key ? 'bg-sand text-ink font-medium' : 'text-sub hover:text-ink'}`}>
            <span className={`inline-block w-2 h-2 rounded-full ml-1 ${c}`} />{x.label} {x.value}
          </button>
        ))}
      </div>
    </div>
  );
}

function Fact({ title, big, sub, children }) {
  return (
    <div className="rounded-2xl border border-rule bg-paper p-5 grid gap-3 content-start">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-2xl leading-none">{title}</h3>
        {big != null && <span className="font-title text-5xl leading-none num">{big}</span>}
      </div>
      {sub && <p className="text-xs text-sub -mt-2">{sub}</p>}
      {children}
    </div>
  );
}

export function FindMK({ mks, partyById }) {
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


export default function Who() {
  return <Composition />;
}

/** The composition explorer. With `party`, it covers only that list's members (used on the party page). */
export function Composition({ party = null }) {
  const { data: allMks } = useMKs();
  const mks = useMemo(() => (allMks && party ? allMks.filter((m) => m.party === party) : allMks), [allMks, party]);
  const { data: parties } = useParties();
  const { data: meta } = useMeta();
  const [f, setF] = useState({}); // facet -> value
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  const setFacet = (k, v) => setF((o) => { const n = { ...o }; if (v == null || v === '') delete n[k]; else n[k] = v; return n; });
  const active = Object.entries(f);
  const passes = (m, except) => active.every(([k, v]) => k === except || TEST[k](m, v));
  const match = useMemo(() => (active.length ? (m) => passes(m, null) : null), [f]);  
  const label = active.map(([k, v]) => facetLabel(k, v, partyById)).join(' · ');
  const sel = useMemo(() => (mks ? (match ? mks.filter(match) : mks) : []), [mks, match]);

  // each card is counted over everyone who passes the OTHER filters, so its own bars stay comparable
  const facts = useMemo(() => {
    if (!mks) return null;
    const base = (k) => mks.filter((m) => passes(m, k));
    const bg = base('gender'), bt = base('tenure'), ba = base('age'), be = base('edu'), bs = base('sector'), bp = base('per');
    const ages = ba.map((m) => m.age).filter((x) => x != null);
    const degree = be.filter((m) => ['PhD', 'MD', 'LLB/LLM', 'MA', 'BA'].includes(m.education_level)).length;
    const knownEdu = be.filter((m) => m.education_level !== 'unknown').length;
    const sc = {};
    bs.forEach((m) => m.sectors.forEach((x) => (sc[x] = (sc[x] || 0) + 1)));
    const per = { periphery: 0, middle: 0, center: 0 };
    bp.forEach((m) => { const x = PER_B(m.residence?.periphery_cluster); if (x) per[x] += 1; });
    const lc = {};
    sel.forEach((m) => { if (m.residence?.name) lc[m.residence.name] = (lc[m.residence.name] || 0) + 1; });
    return {
      gN: bg.length, women: bg.filter((m) => m.gender === 'female').length, men: bg.filter((m) => m.gender === 'male').length,
      tN: bt.length, fresh: bt.filter((m) => m.is_new).length,
      age: AGE_BINS.map((x) => ({ key: x, label: x, value: ba.filter((m) => m.age_group === x).length })),
      med: median(ages), min: ages.length ? Math.min(...ages) : null, max: ages.length ? Math.max(...ages) : null,
      edu: EDU_ORDER.filter((e) => e !== 'unknown').map((e) => ({ key: e, label: EDU_LABEL[e], value: be.filter((m) => m.education_level === e).length })).filter((d) => d.value || f.edu === d.key),
      degreePct: knownEdu ? Math.round((degree / knownEdu) * 100) : null,
      sectors: Object.entries(sc).filter(([x]) => x !== 'politics_party' && x !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x, v]) => ({ key: x, label: SECTOR_LABEL[x] || x, value: v })),
      per: Object.keys(PER_LABELS).map((x) => ({ key: x, label: PER_LABELS[x], value: per[x] })),
      perKnown: per.periphery + per.middle + per.center,
      towns: Object.entries(lc).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [mks, f, sel]);  

  if (!mks || !parties || !facts) return <Loading />;
  const seated = parties.filter((p) => p.seats > 0);

  const Wrap = party ? 'div' : Page;
  return (
    <Wrap className={party ? 'grid gap-8' : undefined}>
      {!party && <header className="grid gap-3 max-w-3xl">
        <p className="text-sm text-gold font-semibold">מי הם</p>
        <h1 className="text-4xl sm:text-5xl leading-tight">מי בכנסת ה-26: תמונה כללית</h1>
        <p className="text-sub leading-relaxed">נשים וגברים, חדשים וותיקים, גיל, השכלה, רקע מקצועי ומקום מגורים. כל עמודה היא גם מסנן: לחצו כדי לראות מי עונה עליה.</p>
      </header>}

      {/* The chamber is the page's only filter. */}
      <section className="grid gap-5">
        {!party && <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => setF({})} aria-pressed={!active.length}
            className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${!active.length ? 'border-ink bg-ink text-paper' : 'border-rule text-sub hover:border-ink/40 hover:text-ink'}`}>כל הכנסת</button>
          {CHIPS.map(([k, v, l]) => (
            <button key={v} onClick={() => setFacet(k, f[k] === v ? null : v)} aria-pressed={f[k] === v}
              className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${f[k] === v ? 'border-ink bg-ink text-paper' : 'border-rule text-sub hover:border-ink/40 hover:text-ink'}`}>{l}</button>
          ))}
          <select value={f.party || ''} onChange={(e) => setFacet('party', e.target.value)} aria-label="בחירת מפלגה"
            className={`px-3 py-1.5 rounded-full border text-sm bg-paper ${f.party ? 'border-ink text-ink' : 'border-rule text-sub'}`}>
            <option value="">כל המפלגות</option>
            {seated.map((p) => <option key={p.id} value={p.id}>{p.name_he}</option>)}
          </select>
        </div>}
        {active.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs -mt-2">
            <span className="text-sub">מסונן לפי:</span>
            {active.map(([k, v]) => (
              <button key={k} onClick={() => setFacet(k, null)} className="flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 hover:bg-rule">
                {facetLabel(k, v, partyById)} <span aria-hidden>×</span>
              </button>
            ))}
            <button onClick={() => setF({})} className="underline text-sub">ניקוי הכל</button>
          </div>
        )}
        {!party && <Hemicycle mks={mks} parties={parties} groups={meta?.groups} match={match} label={label} />}
        {!party && meta?.groups_source && <p className="text-[11px] text-sub text-center">{meta.groups_source}. הקבוצות מוצגות בצבעים בלבד, ללא שמות.</p>}
        {match && (
          <div id="names" className="grid gap-2 scroll-mt-24">
            <h2 className="text-xl">{label}: {sel.length} חברי כנסת</h2>
            {sel.length ? (
              <div className="flex flex-wrap gap-1.5 text-sm">
                {sel.slice().sort((a, b) => a.party.localeCompare(b.party) || a.list_position - b.list_position).map((m) => (
                  <MKLink key={m.id} id={m.id} className="flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1 hover:border-ink/40">
                    <span className="w-2 h-2 rounded-full" style={{ background: partyById[m.party]?.color }} />{m.name_he}
                  </MKLink>
                ))}
              </div>
            ) : <p className="text-sm text-sub">אין חברי כנסת שעונים על כל הסינונים.</p>}
          </div>
        )}
      </section>

      <Section title={match ? `הפרופיל של: ${label}` : party ? 'מי ברשימה' : 'מי בכנסת ה-26'}
        aside={match
          ? <button onClick={() => document.getElementById('names')?.scrollIntoView({ behavior: 'smooth' })} className="text-xs underline text-sub hover:text-ink">↑ לרשימת השמות</button>
          : <span className="text-xs text-sub">לחצו על כל עמודה כדי לסנן את העמוד</span>}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Fact title="נשים וגברים" big={facts.gN ? `${Math.round((facts.women / facts.gN) * 100)}%` : '—'} sub="שיעור הנשים">
            <Split a={{ key: 'female', label: 'נשים', value: facts.women }} b={{ key: 'male', label: 'גברים', value: facts.men }} total={facts.gN}
              active={f.gender} onPick={(v) => setFacet('gender', v)} />
          </Fact>
          <Fact title="חדשים בכנסת" big={facts.fresh} sub={`מתוך ${facts.tN} · השאר כיהנו בכנסת קודמת`}>
            <Split a={{ key: 'new', label: 'חדשים', value: facts.fresh }} b={{ key: 'returning', label: 'כיהנו בעבר', value: facts.tN - facts.fresh }} total={facts.tN}
              active={f.tenure} onPick={(v) => setFacet('tenure', v)} />
          </Fact>
          <Fact title="גיל ביום הבחירות" big={facts.med ?? '—'} sub={facts.min != null ? `גיל חציוני · הצעיר/ה ${facts.min}, המבוגר/ת ${facts.max}` : ''}>
            <Bars rows={facts.age} active={f.age} onPick={(v) => setFacet('age', v)} />
          </Fact>
          <Fact title="השכלה" big={facts.degreePct != null ? `${facts.degreePct}%` : '—'} sub="בעלי תואר אקדמי, מתוך הידועים">
            <Bars rows={facts.edu} active={f.edu} onPick={(v) => setFacet('edu', v)} />
          </Fact>
          <Fact title="רקע מקצועי" sub="אדם נספר בכל תחום שעבד בו">
            <Bars rows={facts.sectors} active={f.sector} onPick={(v) => setFacet('sector', v)} />
          </Fact>
          <Fact title="מקום מגורים" sub="לפי מדד הפריפריאליות של הלמ״ס ליישוב">
            <Bars rows={facts.per} total={facts.perKnown} active={f.per} onPick={(v) => setFacet('per', v)} />
            <div className="text-xs text-sub pt-1 border-t border-rule">
              היישובים הנפוצים: {facts.towns.map(([t, v]) => `${t} (${v})`).join(' · ')}
            </div>
          </Fact>
        </div>
      </Section>



    </Wrap>
  );
}
