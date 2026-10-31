import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NAV_GROUPS } from '@/lib/nav';
import { useMKs, useParties, useMeta, dataBuilt } from '@/lib/data';
import { Loading, Page } from '@/components/bits';
import Hemicycle from '@/components/Hemicycle';
import ClusterExplorer from '@/components/ClusterExplorer';
import LeadMap from '@/components/LeadMap';
import { FindMK } from '@/pages/Who';

const group = (k) => NAV_GROUPS.find((g) => g.key === k);

function Door({ g, lead, to, children, linkBody = true }) {
  return (
    <section className="rounded-2xl border border-rule p-5 sm:p-6 grid gap-4 content-start bg-paper">
      <div className="grid gap-1">
        <Link to={to} className="group flex items-center justify-between">
          <h2 className="text-4xl">{g.title}</h2>
          <ArrowLeft size={20} className="text-sub group-hover:text-ink transition-transform group-hover:-translate-x-1" />
        </Link>
        <p className="text-sm text-sub leading-relaxed">{lead}</p>
      </div>
      {linkBody ? <Link to={to} className="block">{children}</Link> : children}
      <ul className="grid gap-1 border-t border-rule pt-3">
        {g.items.map(([href, label, desc]) => (
          <li key={href}>
            <Link to={href} className="group grid grid-cols-[1fr_auto] gap-2 items-center rounded-lg px-2 py-1.5 -mx-2 hover:bg-sand/70">
              <span className="grid">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-sub leading-snug">{desc}</span>
              </span>
              <ArrowLeft size={14} className="text-sub group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Num({ v, label }) {
  return (
    <div className="grid">
      <span className="font-title text-4xl leading-none num">{v}</span>
      <span className="text-xs text-sub">{label}</span>
    </div>
  );
}

export default function Home() {
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const { data: meta } = useMeta();
  const [built, setBuilt] = useState(null);
  useEffect(() => { dataBuilt().then(setBuilt); }, []);
  const partyById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  if (!mks || !parties) return <Loading />;

  const women = mks.filter((m) => m.gender === 'female').length;
  const fresh = mks.filter((m) => m.is_new).length;
  const ages = mks.map((m) => m.age).filter((a) => a != null).sort((a, b) => a - b);
  const med = ages.length ? ages[Math.floor(ages.length / 2)] : '—';

  return (
    <Page>
      {/* desktop: intro and chamber side by side; phones: stacked */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8 lg:gap-12 items-center">
      <header className="grid gap-4 max-w-3xl">
        <p className="text-sm text-gold font-semibold">הבחירות לכנסת ה-26 · 27.10.2026</p>
        <h1 className="text-4xl sm:text-6xl lg:text-5xl xl:text-6xl leading-tight">מי נבחר לכנסת, ומה אנחנו יודעים עליהם</h1>
        <p className="text-sub leading-relaxed">
          כל מה שידוע בנתונים פתוחים על 120 הנבחרים: מי הם, מי בחר בהם, ומה הם עושים – כל הצבעה במליאה מאז 2003, הצעות חוק וּועדות.
          כל נתון מקושר למקורו.
        </p>
        <FindMK mks={mks} partyById={partyById} />
      </header>

      <section className="grid gap-4">
        <Hemicycle mks={mks} parties={parties} groups={meta?.groups} />
      </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Door g={group('who')} to="/who" lead="הרקע של הנבחרים: מגדר, גיל, השכלה, קריירה ומקום מגורים, וכל אחד מהם בנפרד.">
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-sand/50 p-4">
            <Num v={women} label="נשים" />
            <Num v={fresh} label="חדשים בכנסת" />
            <Num v={med} label="גיל חציוני" />
          </div>
        </Door>

        <Door g={group('voters')} to="/voters" lead="מי הצביע לכל רשימה ומאיפה, ומה מאפיין את הרשויות שבהן כל מפלגה חזקה.">
          <LeadMap height={300} />
        </Door>

        <Door g={group('do')} to="/clusters" linkBody={false} lead="איך הצביעו, בכל נושא: מי בעד מה, מי מצביע כמו מי, וכל הצבעה במליאה.">
          <ClusterExplorer preview />
        </Door>
      </div>

      <p className="text-xs text-sub text-center">
        הנתונים מתעדכנים אוטומטית כל בוקר מהמאגר הפתוח של הכנסת
        {built ? ` · עודכנו לאחרונה ב-${new Date(built).toLocaleDateString('he-IL')}` : ''}.
        {' '}<Link to="/about" className="underline">מקורות ושיטה</Link>
      </p>
    </Page>
  );
}
