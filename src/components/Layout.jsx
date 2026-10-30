import { NavLink, Link, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV = [
  ['/', 'סקירה'],
  ['/mks', 'חברי הכנסת'],
  ['/parties', 'מפלגות'],
  ['/map', 'מפה'],
  ['/votes', 'הצבעות'],
  ['/about', 'מקורות ושיטה'],
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="sticky top-0 z-[1100] border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-baseline gap-2 shrink-0" onClick={() => setOpen(false)}>
            <span className="font-display text-xl font-black tracking-tight">הכנסת ה-26</span>
            <span className="text-xs text-muted hidden sm:inline">מאגר נתונים פתוח</span>
          </Link>
          <nav className="hidden md:flex gap-1 text-sm">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-ink text-paper' : 'hover:bg-sand'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <button className="md:hidden mr-auto p-2" aria-label="תפריט" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-rule px-4 py-2 grid gap-1">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
                className={({ isActive }) => `px-3 py-2 rounded-md ${isActive ? 'bg-ink text-paper' : ''}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-rule mt-16">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted grid gap-2">
          <p>
            הנתונים נאספו ועובדו ע״י <strong className="text-ink">ד״ר דנה סיני</strong>. כל עובדה מקושרת למקור; מצאתם טעות?
            {' '}<Link className="underline" to="/about">ראו איך לדווח</Link>.
          </p>
          <p dir="ltr" className="text-xs text-left">
            Independent analysis by Dr. Dana Sinai, done in a personal capacity. It does not represent, and is not affiliated
            with, any current or past employer.
          </p>
        </div>
      </footer>
    </div>
  );
}
