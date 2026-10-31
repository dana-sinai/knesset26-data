import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import MKDrawer from '@/components/MKDrawer';
import { NAV_GROUPS, groupOf } from '@/lib/nav';

const pill = (on) => `px-3 py-1.5 rounded-md transition-colors ${on ? 'bg-ink text-paper' : 'hover:bg-sand'}`;

function GroupMenu({ g, active }) {
  return (
    <DropdownMenu dir="rtl" modal={false}>
      <DropdownMenuTrigger className={`${pill(active)} flex items-center gap-1 outline-none`}>
        {g.title}<ChevronDown size={14} className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[1200] w-72 bg-paper border-rule p-1.5">
        {g.items.map(([to, label, desc]) => (
          <DropdownMenuItem key={to} asChild className="cursor-pointer rounded-md focus:bg-sand">
            <Link to={to} className="grid gap-0.5 px-2.5 py-2 text-right">
              <span className="text-sm font-medium text-ink">{label}</span>
              <span className="text-xs text-sub leading-snug">{desc}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const cur = groupOf(pathname === '/topics' ? '/clusters' : pathname.startsWith('/party/') ? '/parties' : pathname.startsWith('/mk/') ? '/mks' : pathname);
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="sticky top-0 z-[1100] border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-baseline gap-2 shrink-0" onClick={() => setOpen(false)}>
            <span className="font-title text-2xl leading-none">הכנסת ה-26</span>
            <span className="text-xs text-sub hidden sm:inline">מאגר נתונים פתוח</span>
          </Link>
          <nav className="hidden md:flex gap-1 text-sm items-center">
            <NavLink to="/" end className={({ isActive }) => pill(isActive)}>סקירה</NavLink>
            {NAV_GROUPS.map((g) => <GroupMenu key={g.key} g={g} active={cur === g.key} />)}
            <NavLink to="/about" className={({ isActive }) => pill(isActive)}>מקורות ושיטה</NavLink>
          </nav>
          <button className="md:hidden mr-auto p-2" aria-label="תפריט" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-rule px-4 py-3 grid gap-3 max-h-[80vh] overflow-y-auto">
            <NavLink to="/" end onClick={() => setOpen(false)} className={({ isActive }) => `px-3 py-2 rounded-md ${isActive ? 'bg-ink text-paper' : ''}`}>סקירה</NavLink>
            {NAV_GROUPS.map((g) => (
              <div key={g.key} className="grid gap-0.5">
                <p className="px-3 text-xs text-gold font-semibold">{g.title}</p>
                {g.items.map(([to, label]) => (
                  <NavLink key={to} to={to} onClick={() => setOpen(false)}
                    className={({ isActive }) => `px-3 py-2 rounded-md ${isActive ? 'bg-ink text-paper' : ''}`}>{label}</NavLink>
                ))}
              </div>
            ))}
            <NavLink to="/about" onClick={() => setOpen(false)} className={({ isActive }) => `px-3 py-2 rounded-md ${isActive ? 'bg-ink text-paper' : ''}`}>מקורות ושיטה</NavLink>
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <MKDrawer />
      <footer className="border-t border-rule mt-16">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-sub grid gap-2">
          <p>
            הנתונים נאספו ועובדו ע״י <strong className="text-ink">ד״ר דנה סיני</strong>. כל עובדה מקושרת למקור; מצאתם טעות?
            {' '}<Link className="underline" to="/about">ראו איך לדווח</Link>.
          </p>
          <p className="text-xs">
            הכותרות באתר כתובות בגופן <a className="underline" href="https://www.ot-hayim.co.il/fonts/amit-man/" target="_blank" rel="noreferrer">״עמית מן״</a>,
            {' '}שנוצר מכתב ידה של עמית מן ז״ל, פרמדיקית שנרצחה בבארי ב-7 באוקטובר 2023 בעודה מטפלת בפצועים, במסגרת <a className="underline" href="https://www.ot-hayim.co.il/" target="_blank" rel="noreferrer">מיזם אות.חיים</a>. לזכרה.
          </p>
          <p className="text-xs">
            ניתוח עצמאי של ד״ר דנה סיני, שנעשה באופן אישי. אינו מייצג, ואינו קשור, לאף מעסיק בהווה או בעבר.
          </p>
        </div>
      </footer>
    </div>
  );
}
