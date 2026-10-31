import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMKs, useParties, useData, fmt } from '@/lib/data';
import { Loading, Page, Section } from '@/components/bits';
import LeadMap from '@/components/LeadMap';
import { CorrTable, SectorSelect } from '@/pages/VoterProfile';

// "מי בחר בהם" overview: the map of localities, every list against every CBS characteristic, then one card per list.
function VotersOverview() {
  const { data } = useData('voter_profile.json');
  const { data: parties } = useParties();
  const [sector, setSector] = useState('jewish');
  const nav = useNavigate();
  return (
    <div className="grid xl:grid-cols-[300px_minmax(0,1fr)] gap-x-10 gap-y-12 items-start">
      <Section title="מפת היישובים">
        <p className="text-sm text-sub -mt-2 max-w-md xl:max-w-[300px]">כל יישוב בצבע הרשימה הגדולה בו, בגודל לפי מספר הקולות. מפה לכל מפלגה בנפרד – בעמוד המפלגה ובעמוד <Link to="/represent" className="underline hover:text-ink">„מה מאפיין את הבוחרים״</Link>.</p>
        <LeadMap height={560} stack />
      </Section>
      {data && parties && (
        <Section title="כל המפלגות מול כל המאפיינים" aside={<Link to="/represent" className="text-xs underline text-sub hover:text-ink">ניתוח לכל מפלגה ←</Link>}>
          <p className="text-sm text-sub -mt-2 max-w-3xl">
            המתאם (r) בין שיעור ההצבעה למפלגה ברשות לבין כל מאפיין של הרשות לפי הלמ״ס. כחול = המפלגה חזקה יותר ברשויות שבהן המאפיין גבוה,
            אדום = חלשה יותר, לבן = קשר חלש מאוד. הנתונים של רשויות ולא של אנשים. לחצו על משבצת לפירוט.
          </p>
          <SectorSelect data={data} value={sector} onChange={setSector} />
          <CorrTable data={data} parties={parties} sector={sector} onPick={(pid, k) => nav(`/represent?p=${pid}&x=${k}&g=${sector}`)} />
        </Section>
      )}
    </div>
  );
}

// mode "people": who was elected on each list (default). mode "voters": who voted for each list.
export default function Parties({ mode = 'people' }) {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  if (!mks || !parties) return <Loading />;
  const voters = mode === 'voters';
  const list = voters ? parties : parties.filter((p) => p.seats > 0);
  return (
    <Page>
      <header className="grid gap-2 max-w-3xl">
        <p className="text-sm text-gold font-semibold">{voters ? 'מי בחר בהם' : 'מי הם'}</p>
        <h1 className="text-4xl">{voters ? 'מי בחר בכל מפלגה' : 'הרכב המפלגות'}</h1>
        <p className="text-sub leading-relaxed">
          {voters
            ? 'איפה כל רשימה חזקה, ומה מאפיין את הרשויות שבהן הצביעו לה לפי נתוני הלמ״ס. למטה – כרטיס לכל רשימה, כולל רשימות שלא עברו את אחוז החסימה.'
            : '11 רשימות עברו את אחוז החסימה (3.25%). לחצו על מפלגה כדי לראות את כל הנבחרים שלה.'}
        </p>
      </header>
      {voters && <VotersOverview />}
      {voters && <h2 className="text-2xl -mb-4">לכל רשימה</h2>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((p) => {
          const g = mks.filter((m) => m.party === p.id);
          const w = g.filter((m) => m.gender === 'female').length;
          const n = g.filter((m) => m.is_new).length;
          return (
            <Link key={p.id} to={`/party/${p.id}${voters ? '?tab=voters' : ''}`} className="rounded-xl border border-rule p-4 hover:border-ink/40 grid gap-2 bg-paper">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: p.color }} /><h2 className="text-xl font-bold">{p.name_he}</h2></div>
              <p className="text-xs text-sub">{p.full_name_he} · בראשות {p.leader_he}</p>
              {voters ? (
                <div className="flex items-baseline gap-3">
                  <span className="font-title text-4xl num">{fmt(p.votes)}</span><span className="text-sub text-sm">קולות</span>
                  <span className="text-sm num mr-auto">{p.pct.toFixed(2)}%{p.seats ? ` · ${p.seats} מנדטים` : ' · לא עברה'}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="font-title text-4xl num">{p.seats}</span><span className="text-sub text-sm">נבחרים</span>
                  </div>
                  <p className="text-xs text-sub">{w} נשים · {n} חדשים בכנסת · {g.length - n} כיהנו בעבר</p>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
