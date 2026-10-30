import { sourceName } from '@/lib/data';
import { MKLink } from '@/components/MKDrawer';

export function PartyDot({ party, size = 10 }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: party?.color }} />;
}

export function Initials({ name, color, size = 44, photo }) {
  if (photo?.url) {
    return (
      <img src={photo.url} alt={name} loading="lazy" title={[photo.credit, photo.license].filter(Boolean).join(' · ')}
        className="rounded-full object-cover shrink-0 bg-sand" style={{ width: size, height: size, boxShadow: `0 0 0 2px ${color || 'transparent'}` }} />
    );
  }
  const parts = (name || '').split(' ').filter(Boolean);
  const ini = (parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  return (
    <div className="rounded-full grid place-items-center font-medium text-ink bg-sand shrink-0"
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 2px ${color || 'transparent'}`, fontSize: size * 0.36 }} aria-hidden>
      {ini}
    </div>
  );
}

export function Src({ urls }) {
  if (!urls || !urls.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 mr-1 align-super text-[10px] leading-none">
      {urls.slice(0, 3).map((u, i) => (
        String(u).startsWith('http')
          ? <a key={i} href={u} target="_blank" rel="noreferrer" title={u} className="text-gold hover:underline">[{sourceName(u)}]</a>
          : <span key={i} title={u} className="text-gold">[{sourceName(u)}]</span>
      ))}
    </span>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-rule bg-paper p-4">
      <div className="text-xs text-sub">{label}</div>
      <div className="text-3xl font-light num mt-1">{value}</div>
      {hint && <div className="text-[11px] text-sub mt-1">{hint}</div>}
    </div>
  );
}

export function MKCard({ m, party }) {
  return (
    <MKLink id={m.id} className="group flex gap-3 items-center rounded-xl border border-rule bg-paper p-3 hover:border-ink/40 transition-colors">
      <Initials name={m.name_he} color={party?.color} photo={m.photo} />
      <div className="min-w-0">
        <div className="font-semibold truncate group-hover:underline">{m.name_he}</div>
        <div className="text-xs text-sub truncate">
          {party?.name_he} · מקום {m.list_position}
          {m.age != null && <> · גיל {m.age_approx ? '~' : ''}{m.age}</>}
          {m.residence?.name && <> · {m.residence.name}</>}
        </div>
        <div className="text-[11px] mt-0.5">
          {m.is_new ? <span className="text-gold font-semibold">חדש/ה בכנסת</span>
            : <span className="text-sub">כנסות קודמות: {m.prior_terms.join(', ')}</span>}
        </div>
      </div>
    </MKLink>
  );
}

export function Loading() {
  return <div className="py-24 grid place-items-center text-sub text-sm">טוען נתונים…</div>;
}

export function Section({ title, children, aside, id }) {
  return (
    <section id={id} className="grid gap-4">
      <div className="flex items-end justify-between gap-4 border-b border-rule pb-2">
        <h2 className="text-2xl font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Page({ children, className = '' }) {
  return <div className={`mx-auto max-w-7xl px-4 py-8 grid gap-10 ${className}`}>{children}</div>;
}
