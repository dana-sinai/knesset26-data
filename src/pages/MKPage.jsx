import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { useMKs, useParties, useData, EDU_LABEL, SECTOR_LABEL, pct, fmt } from '@/lib/data';
import { Initials, Src, Loading, Page, Section } from '@/components/bits';
import VoteTable from '@/components/VoteTable';
import BillList from '@/components/BillList';

const fmtDate = (d) => (d ? d.slice(0, 10).split('-').reverse().join('.') : '');
const yrs = (s, e) => [s, e].filter(Boolean).join('–') || '';

function Fact({ label, children, src }) {
  if (children == null || children === '' || children === false) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-rule text-sm">
      <dt className="text-sub">{label}</dt>
      <dd>{children}<Src urls={src} /></dd>
    </div>
  );
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-rule overflow-x-auto">
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${value === k ? 'border-ink font-semibold' : 'border-transparent text-sub hover:text-ink'}`}>{l}</button>
      ))}
    </div>
  );
}

export function MKProfile({ id, compact = false }) {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const { data: parl } = useData('parliament.json');
  const [tab, setTab] = useState('profile');
  const m = useMemo(() => mks?.find((x) => x.id === id), [mks, id]);
  const party = parties?.find((p) => p.id === m?.party);
  if (!mks || !parties) return <Loading />;
  if (!m) return <p>לא נמצא חבר כנסת. <Link className="underline" to="/mks">לרשימה</Link></p>;

  const pr = m.person_id ? parl?.[String(m.person_id)] : null;
  const s = m.sources || {};
  const voteKs = pr?.vote_stats ? Object.keys(pr.vote_stats).map(Number).sort() : [];
  const tabs = [['profile', 'פרופיל'], ['knesset', 'פעילות בכנסת']];
  if (m.has_votes) tabs.push(['votes', 'הצבעות במליאה']);
  if (m.has_bills) tabs.push(['bills', 'הצעות חוק']);
  tabs.push(['sources', 'מקורות']);

  return (
    <div className={compact ? 'grid gap-6' : 'grid gap-10'}>
      <header className="grid grid-cols-[auto_1fr] gap-5 items-center">
        <Initials name={m.name_he} color={party?.color} size={compact ? 64 : 84} />
        <div className="grid gap-1">
          <Link to={`/party/${party.id}`} className="text-sm font-semibold hover:underline" style={{ color: party.color }}>
            {party.name_he} · מקום {m.list_position} ברשימה
          </Link>
          <h1 className={compact ? 'text-3xl font-black' : 'text-4xl font-black'}>{m.name_he}</h1>
          {m.name_en && <p className="text-sub" dir="ltr" style={{ textAlign: 'right' }}>{m.name_en}</p>}
          <div className="flex flex-wrap gap-2 text-xs mt-1">
            {m.is_new ? <span className="px-2 py-0.5 rounded-full bg-gold/20 text-ink">חדש/ה בכנסת</span>
              : <span className="px-2 py-0.5 rounded-full bg-sand">כנסות קודמות: {m.prior_terms.join(', ')}</span>}
            {m.age != null && <span className="px-2 py-0.5 rounded-full bg-sand">גיל {m.age_approx ? '~' : ''}{m.age}</span>}
            {m.residence?.name && <span className="px-2 py-0.5 rounded-full bg-sand">{m.residence.name}</span>}
          </div>
        </div>
      </header>

      {m.conflicts?.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-700" />
          <div><strong>מקורות סותרים: </strong>{m.conflicts.join(' · ')}</div>
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'profile' && (
        <div className={compact ? 'grid gap-8' : 'grid lg:grid-cols-[1fr_1.2fr] gap-10'}>
          <div className="grid gap-6 content-start">
            {m.bio_he && <p className="leading-relaxed">{m.bio_he}</p>}
            <dl>
              <Fact label="מגדר" src={s.gender}>{m.gender === 'female' ? 'אישה' : m.gender === 'male' ? 'גבר' : null}</Fact>
              <Fact label="תאריך לידה" src={s.birth_date || s.birth_year}>{m.birth_date ? fmtDate(m.birth_date) : m.birth_year}</Fact>
              <Fact label="מקום לידה" src={s.birthplace}>{m.birthplace}</Fact>
              <Fact label="מקום מגורים" src={s.residence_locality_he}>
                {m.residence?.name}{m.residence?.note && <span className="text-xs text-sub"> ({m.residence.note})</span>}
              </Fact>
              <Fact label="השכלה (גבוהה)" src={s.highest_education_level}>{EDU_LABEL[m.education_level]}</Fact>
              <Fact label="שירות צבאי" src={s.military_service}>{m.military_service}</Fact>
              <Fact label="שפות" src={s.languages}>{m.languages?.join(', ')}</Fact>
              <Fact label="מצב משפחתי" src={s.family_status}>{m.family_status}</Fact>
              <Fact label="ויקיפדיה">
                {m.wikipedia_he && <a className="underline" href={m.wikipedia_he} target="_blank" rel="noreferrer">עברית</a>}
                {m.wikipedia_he && m.wikipedia_en && ' · '}
                {m.wikipedia_en && <a className="underline" href={m.wikipedia_en} target="_blank" rel="noreferrer">English</a>}
                {!m.wikipedia_he && !m.wikipedia_en && null}
              </Fact>
            </dl>
          </div>
          <div className="grid gap-8 content-start">
            <div className="grid gap-3">
              <h3 className="text-xl font-bold">השכלה<Src urls={s.education} /></h3>
              {m.education.length ? (
                <ul className="grid gap-2">
                  {m.education.map((e, i) => (
                    <li key={i} className="text-sm border-r-2 border-rule pr-3">
                      <strong>{e.degree}</strong>{e.field && ` · ${e.field}`}
                      <div className="text-sub text-xs">{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-sub">אין מידע מבוסס מקור.</p>}
            </div>
            <div className="grid gap-3">
              <h3 className="text-xl font-bold">קריירה<Src urls={s.career} /></h3>
              {m.career.length ? (
                <ol className="grid gap-2">
                  {m.career.map((c, i) => (
                    <li key={i} className="text-sm grid grid-cols-[84px_1fr] gap-3">
                      <span className="text-sub num text-xs pt-0.5">{yrs(c.start_year, c.end_year)}</span>
                      <span>
                        {c.role}{c.organization && <span className="text-sub"> · {c.organization}</span>}
                        {c.sector && <span className="mr-2 text-[11px] px-1.5 py-0.5 rounded bg-sand">{SECTOR_LABEL[c.sector] || c.sector}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-sub">אין מידע מבוסס מקור.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'knesset' && (
        <div className="grid gap-10">
          {!pr ? (
            <p className="text-sub">{m.is_new ? 'חבר/ת כנסת חדש/ה – אין עדיין רשומות פעילות בכנסת. נתוני ועדות ותפקידים יתווספו אחרי השבעת הכנסת ה-26.' : 'אין נתונים זמינים.'}</p>
          ) : (
            <>
              {pr.vote_stats && (
                <Section title="הצבעות במליאה לפי כנסת">
                  <div className="overflow-x-auto rounded-xl border border-rule">
                    <table className="w-full text-sm">
                      <thead className="bg-sand/60 text-xs text-sub"><tr>
                        {['כנסת', 'הצבעות שהתקיימו בזמן כהונה', 'הצביע/ה', 'השתתפות', 'בעד', 'נגד', 'נמנע', 'הצבעה כמו רוב הסיעה', 'הצעות חוק (יוזם/ת)', 'התקבלו'].map((h) => <th key={h} className="text-right font-medium px-3 py-2 whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {Object.entries(pr.vote_stats).sort((a, b) => b[0] - a[0]).map(([k, v]) => {
                          const b = pr.bill_stats?.[k];
                          return (
                            <tr key={k} className="border-t border-rule num">
                              <td className="px-3 py-1.5 font-semibold">{k}</td>
                              <td className="px-3 py-1.5">{fmt(v.votes_held_while_serving)}</td>
                              <td className="px-3 py-1.5">{fmt(v.votes_cast)}</td>
                              <td className="px-3 py-1.5">{pct(v.participation)}</td>
                              <td className="px-3 py-1.5">{fmt(v.for_)}</td>
                              <td className="px-3 py-1.5">{fmt(v.against)}</td>
                              <td className="px-3 py-1.5">{fmt(v.abstain)}</td>
                              <td className="px-3 py-1.5">{pct(v.with_faction_rate, 1)}</td>
                              <td className="px-3 py-1.5">{fmt(b?.initiated)}</td>
                              <td className="px-3 py-1.5">{fmt(b?.passed)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-sub leading-relaxed">
                    <strong>השתתפות</strong> = הצבעות שבהן נרשמה הצבעה ÷ הצבעות שהתקיימו בזמן הכהונה. שרים וראש הממשלה משתתפים פחות מטבע תפקידם, ורבות מההצבעות הן על הסתייגויות.
                    {' '}<strong>הצבעה כמו רוב הסיעה</strong> = חלק ההצבעות שבהן הצביע/ה כמו רוב חברי הסיעה שהצביעו (סיעות של 2+ מצביעים).
                  </p>
                </Section>
              )}
              {pr.gov_roles?.length > 0 && (
                <Section title="תפקידים בממשלה">
                  <ul className="grid gap-1 text-sm">{pr.gov_roles.map((r, i) => (
                    <li key={i}><span className="num text-sub text-xs ml-2">{fmtDate(r.start)}–{fmtDate(r.finish) || 'היום'}</span>{r.role}{r.government ? <span className="text-sub"> · ממשלה {r.government}</span> : ''}</li>
                  ))}</ul>
                </Section>
              )}
              {pr.knesset_roles?.length > 0 && (
                <Section title="תפקידים בכנסת">
                  <ul className="grid gap-1 text-sm">{pr.knesset_roles.map((r, i) => (
                    <li key={i}><span className="num text-sub text-xs ml-2">כנסת {r.knesset} · {fmtDate(r.start)}–{fmtDate(r.finish) || 'היום'}</span>{r.role}</li>
                  ))}</ul>
                </Section>
              )}
              {pr.committees?.length > 0 && (
                <Section title="ועדות">
                  {[...new Set(pr.committees.map((c) => c.knesset))].sort((a, b) => b - a).map((k) => {
                    const cs = {};
                    pr.committees.filter((c) => c.knesset === k).forEach((c) => {
                      if (!cs[c.committee] || c.role === 'chair') cs[c.committee] = c.role;
                    });
                    return (
                      <div key={k} className="grid gap-1">
                        <h4 className="font-semibold text-sm">הכנסת ה-{k}</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(cs).sort((a, b) => (a[1] === 'chair' ? -1 : 1)).map(([c, r]) => (
                            <span key={c} className={`text-xs px-2 py-1 rounded-md ${r === 'chair' ? 'bg-ink text-paper' : 'bg-sand'}`}>
                              {r === 'chair' ? 'יו״ר · ' : r === 'alternate' ? 'ממלא/ת מקום · ' : ''}{c}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </Section>
              )}
              {pr.factions?.length > 0 && (
                <Section title="סיעות">
                  <ul className="grid gap-1 text-sm">{pr.factions.map((f, i) => (
                    <li key={i}><span className="num text-sub text-xs ml-2">כנסת {f.knesset} · {fmtDate(f.start)}–{fmtDate(f.finish) || 'היום'}</span>{f.faction}</li>
                  ))}</ul>
                </Section>
              )}
              <p className="text-[11px] text-sub">מקור: KNS_PersonToPosition – מאגר הנתונים הפתוח של הכנסת.</p>
            </>
          )}
        </div>
      )}

      {tab === 'votes' && m.has_votes && <VoteTable personId={m.person_id} knessets={voteKs} />}
      {tab === 'bills' && m.has_bills && <BillList personId={m.person_id} />}

      {tab === 'sources' && (
        <div className="grid gap-6 text-sm">
          <div className="grid gap-2">
            <h3 className="font-bold text-lg">מקורות לפי שדה</h3>
            <ul className="grid gap-2">
              {Object.entries(s).map(([field, urls]) => (
                <li key={field} className="grid grid-cols-[160px_1fr] gap-3">
                  <span className="text-sub">{field}</span>
                  <span className="grid gap-0.5 break-all">
                    {urls.map((u, i) => String(u).startsWith('http')
                      ? <a key={i} href={u} target="_blank" rel="noreferrer" className="underline flex items-center gap-1" dir="ltr" style={{ textAlign: 'right' }}>{u}<ExternalLink size={11} /></a>
                      : <span key={i} dir="ltr" style={{ textAlign: 'right' }}>{u}</span>)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {m.filled_from_wikidata?.length > 0 && <p className="text-sub">שדות שהושלמו מוויקינתונים: {m.filled_from_wikidata.join(', ')}</p>}
          {m.notes && (
            <div className="grid gap-1">
              <h3 className="font-bold text-lg">הערות אמינות</h3>
              <p className="text-sub leading-relaxed whitespace-pre-wrap">{m.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MKPage() {
  const { id } = useParams();
  return <Page><MKProfile id={id} /></Page>;
}
