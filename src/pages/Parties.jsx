import { Link } from 'react-router-dom';
import { useMKs, useParties, fmt } from '@/lib/data';
import { Loading, Page } from '@/components/bits';

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
        <h1 className="text-4xl">{voters ? 'מצביעי המפלגות' : 'הרכב המפלגות'}</h1>
        <p className="text-sub leading-relaxed">
          {voters
            ? 'מי הצביע לכל רשימה: פרופיל המצביעים לפי נתוני הלמ״ס על היישובים שבהם הצביעו, מפת הקולות, והיישובים החזקים של כל מפלגה. כולל גם רשימות שלא עברו את אחוז החסימה.'
            : '11 רשימות עברו את אחוז החסימה (3.25%). לחצו על מפלגה כדי לראות את כל הנבחרים שלה.'}
        </p>
      </header>
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
