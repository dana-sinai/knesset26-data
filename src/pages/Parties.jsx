import { Link } from 'react-router-dom';
import { useMKs, useParties, fmt } from '@/lib/data';
import { Loading, Page } from '@/components/bits';

export default function Parties() {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  if (!mks || !parties) return <Loading />;
  return (
    <Page>
      <header className="grid gap-2">
        <h1 className="text-4xl font-black">מפלגות</h1>
        <p className="text-sub">11 רשימות עברו את אחוז החסימה (3.25%). לחצו על מפלגה לפרופיל המצביעים, הרכב הנבחרים והמפה.</p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {parties.map((p) => {
          const g = mks.filter((m) => m.party === p.id);
          const w = g.filter((m) => m.gender === 'female').length;
          const n = g.filter((m) => m.is_new).length;
          return (
            <Link key={p.id} to={`/party/${p.id}`} className="rounded-xl border border-rule p-4 hover:border-ink/40 grid gap-2 bg-paper">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: p.color }} /><h2 className="text-xl font-bold">{p.name_he}</h2></div>
              <p className="text-xs text-sub">{p.full_name_he} · אותיות: {p.letters}</p>
              <div className="flex items-baseline gap-4">
                <span className="font-title text-4xl num">{p.seats}</span><span className="text-sub text-sm">מנדטים</span>
                <span className="text-sm num mr-auto">{fmt(p.votes)} קולות · {p.pct.toFixed(2)}%</span>
              </div>
              {p.seats > 0 && <p className="text-xs text-sub">{w} נשים · {n} חדשים · בראשות {p.leader_he}</p>}
              {p.seats === 0 && <p className="text-xs text-sub">לא עברה את אחוז החסימה · בראשות {p.leader_he}</p>}
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
