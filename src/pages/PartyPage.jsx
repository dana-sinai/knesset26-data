import { useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useMKs, useParties, useData, fmt, EDU_LABEL, EDU_ORDER } from '@/lib/data';
import { SES_B } from '@/lib/filters';
import { MKCard, Loading, Page, Section, Stat } from '@/components/bits';
import Electorate from '@/components/Electorate';
import VoteShareMap from '@/components/VoteShareMap';
import TopicRecord from '@/components/TopicRecord';
import { Composition } from '@/pages/Who';

function MKvsVoters({ mks, e, color }) {
  // compares where the party's MKs live with where its voters voted (both by CBS socio-economic cluster of the locality)
  const known = mks.filter((m) => m.residence?.socioeconomic_cluster != null);
  const share = (b) => (known.length ? (100 * known.filter((m) => SES_B(m.residence.socioeconomic_cluster) === b).length) / known.length : 0);
  const rows = [['low', '1–3', 'אשכול 1–3'], ['mid', '4–6', 'אשכול 4–6'], ['high', '7–10', 'אשכול 7–10']];
  return (
    <div className="grid gap-3">
      <p className="text-sm text-sub">האם הנבחרים גרים במקומות דומים למצביעים? אשכול חברתי-כלכלי של יישוב המגורים של {known.length} מתוך {mks.length} הנבחרים, מול היישובים שבהם הצביעו מצביעי המפלגה.</p>
      <div className="grid gap-2">
        {rows.map(([b, k, l]) => {
          const mk = share(b), v = e?.dims?.ses?.[k] || 0;
          return (
            <div key={b} className="grid grid-cols-[90px_1fr] gap-3 items-center text-xs">
              <span>{l}</span>
              <div className="grid gap-1">
                <div className="flex items-center gap-2"><div className="h-3 rounded" style={{ width: `${mk}%`, background: color }} /><span className="num">נבחרים {mk.toFixed(0)}%</span></div>
                <div className="flex items-center gap-2"><div className="h-3 rounded bg-ink/40" style={{ width: `${v}%` }} /><span className="num">מצביעים {v.toFixed(0)}%</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PartyPage() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const { data: el } = useData('electorate.json');
  const p = parties?.find((x) => x.id === id);
  const g = useMemo(() => (mks || []).filter((m) => m.party === id).sort((a, b) => a.list_position - b.list_position), [mks, id]);
  if (!mks || !parties) return <Loading />;
  if (!p) return <Page><p>לא נמצאה מפלגה. <Link className="underline" to="/parties">לרשימה</Link></p></Page>;
  const e = el?.electorate?.[id];
  const ages = g.map((m) => m.age).filter((a) => a != null).sort((a, b) => a - b);
  const med = ages.length ? ages[Math.floor(ages.length / 2)] : null;

  return (
    <Page>
      <header className="grid gap-2 border-r-8 pr-4" style={{ borderColor: p.color }}>
        <p className="text-xs text-sub">אותיות הפתק: {p.letters}</p>
        <h1 className="text-4xl font-black">{p.name_he}</h1>
        <p className="text-sub">{p.full_name_he}</p>
      </header>
      {(() => {
        const tabs = [...(p.seats > 0 ? [['people', 'מי ברשימה']] : []), ['voters', 'מי הצביע לה'], ...(p.seats > 0 ? [['record', 'איך הצביעו']] : [])];
        const tab = tabs.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : tabs[0][0];
        return (
          <>
            <div role="tablist" className="flex gap-1 border-b border-rule overflow-x-auto">
              {tabs.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setSp(k === tabs[0][0] ? {} : { tab: k }, { replace: true })}
                  className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === k ? 'border-ink text-ink font-medium' : 'border-transparent text-sub hover:text-ink'}`}>{l}</button>
              ))}
            </div>

            {tab === 'people' && (
              <>
                <Composition party={id} />
                <Section title={`הנבחרים (${g.length})`}>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{g.map((m) => <MKCard key={m.id} m={m} party={p} />)}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {EDU_ORDER.map((k) => {
                      const n = g.filter((m) => m.education_level === k).length;
                      return n ? <span key={k} className="px-2 py-1 rounded bg-sand">{EDU_LABEL[k]}: {n}</span> : null;
                    })}
                  </div>
                </Section>
              </>
            )}

            {tab === 'voters' && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label="קולות" value={fmt(p.votes)} />
                  <Stat label="מהקולות הכשרים" value={`${p.pct.toFixed(2)}%`} />
                  <Stat label="מנדטים" value={p.seats} />
                </div>
                <Section title="מי הצביע למפלגה">
                  {el ? <Electorate data={el} partyId={id} color={p.color} /> : <p className="text-sub text-sm">טוען…</p>}
                </Section>
                <Section title="מפת קולות">
                  <VoteShareMap partyId={id} color={p.color} mks={g} />
                </Section>
                {p.seats > 0 && (
                  <Section title="נבחרים מול מצביעים">
                    <MKvsVoters mks={g} e={e} color={p.color} />
                  </Section>
                )}
                {e?.top_localities?.length > 0 && (
                  <Section title="היישובים עם הכי הרבה קולות למפלגה">
                    <div className="overflow-x-auto rounded-xl border border-rule">
                      <table className="w-full text-sm">
                        <thead className="bg-sand/60 text-xs text-sub"><tr><th className="text-right px-3 py-2 font-medium">יישוב</th><th className="text-right px-3 py-2 font-medium">קולות</th><th className="text-right px-3 py-2 font-medium">שיעור ביישוב</th></tr></thead>
                        <tbody>{e.top_localities.map((t) => (
                          <tr key={t.code} className="border-t border-rule num"><td className="px-3 py-1.5">{t.name}</td><td className="px-3 py-1.5">{fmt(t.votes)}</td><td className="px-3 py-1.5">{t.share}%</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Section>
                )}
              </>
            )}

            {tab === 'record' && (
              <Section title="בעד ונגד, בפועל" aside={<Link to={`/record?p=${id}`} className="text-xs underline text-sub hover:text-ink">השוואה למפלגות אחרות ←</Link>}>
                <p className="text-sm text-sub -mt-2">לפי מה שעשו בכנסות קודמות מי שנבחרו היום מטעם המפלגה. רוב המפלגה = רוב חבריה הנוכחיים שהצביעו באותה הצבעה.</p>
                <TopicRecord partyId={id} />
              </Section>
            )}
          </>
        );
      })()}
    </Page>
  );
}
