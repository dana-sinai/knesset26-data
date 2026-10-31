import { useMemo, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { EDU_LABEL, EDU_ORDER, SECTOR_LABEL, useTopics } from '@/lib/data';
import { SES_LABEL, PER_LABEL, METRICS, placeOf } from '@/lib/filters';

function Chip({ on, onClick, children, color }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${on ? 'bg-ink text-paper border-ink' : 'border-rule hover:border-ink/40'}`}>
      {color && <span className="inline-block w-2 h-2 rounded-full ml-1.5 align-middle" style={{ background: color }} />}
      {children}
    </button>
  );
}

function Group({ title, children, hint }) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-semibold text-sub">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {hint && <p className="text-[11px] text-sub">{hint}</p>}
    </div>
  );
}

export default function FilterPanel({ mks, parties, filters, count, hideParty = false }) {
  const { f, set, toggle, reset, active } = filters;
  const [open, setOpen] = useState(false);
  const { data: topics } = useTopics();
  const sectors = useMemo(() => {
    const c = {};
    (mks || []).forEach((m) => m.sectors.forEach((s) => (c[s] = (c[s] || 0) + 1)));
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [mks]);
  const districts = useMemo(() => [...new Set((mks || []).map((m) => placeOf(m, f.place)?.district).filter(Boolean))].sort(), [mks, f.place]);

  return (
    <div className="grid gap-5">
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-sub" />
        <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="חיפוש: שם, עיר, תפקיד, מוסד לימודים…"
          className="w-full rounded-lg border border-rule bg-paper pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-ink/50" />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span><strong className="num">{count}</strong> <span className="text-sub">חברי כנסת תואמים</span></span>
        {active && <button onClick={reset} className="flex items-center gap-1 text-xs underline text-sub"><RotateCcw size={12} />איפוס</button>}
      </div>
      {/* on phones the filters are folded, so the list / map is visible right away */}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="lg:hidden flex items-center justify-between rounded-lg border border-rule px-3 py-2 text-sm">
        <span>סינון לפי מפלגה, מגדר, גיל, השכלה, רקע ומגורים{active ? ' · מסונן' : ''}</span>
        <span aria-hidden className="text-sub">{open ? '▴' : '▾'}</span>
      </button>
      <div className={`${open ? 'grid' : 'hidden'} lg:grid gap-5`}>
      {!hideParty && (
        <Group title="מפלגה">
          {parties.filter((p) => p.seats > 0).map((p) => (
            <Chip key={p.id} on={f.parties.includes(p.id)} onClick={() => toggle('parties', p.id)} color={p.color}>{p.name_he}</Chip>
          ))}
        </Group>
      )}
      <Group title="מגדר">
        {[['', 'הכול'], ['female', 'נשים'], ['male', 'גברים']].map(([v, l]) => (
          <Chip key={v} on={f.gender === v} onClick={() => set({ gender: v })}>{l}</Chip>
        ))}
      </Group>
      <Group title="ותק בכנסת">
        {[['', 'הכול'], ['new', 'חדשים'], ['returning', 'כיהנו בעבר']].map(([v, l]) => (
          <Chip key={v} on={f.tenure === v} onClick={() => set({ tenure: v })}>{l}</Chip>
        ))}
      </Group>
      <div className="grid gap-2">
        <div className="text-xs font-semibold text-sub flex justify-between">
          <span>גיל ביום הבחירות</span><span className="num">{f.ageMin}–{f.ageMax}</span>
        </div>
        <Slider dir="rtl" min={20} max={90} step={1} value={[f.ageMin, f.ageMax]} onValueChange={([a, b]) => set({ ageMin: a, ageMax: b })} />
        <p className="text-[11px] text-sub">סינון לפי גיל מסתיר חברי כנסת שגילם לא ידוע.</p>
      </div>
      <Group title="השכלה (התואר הגבוה)">
        {EDU_ORDER.map((e) => (
          <Chip key={e} on={f.edu.includes(e)} onClick={() => toggle('edu', e)}>{EDU_LABEL[e]}</Chip>
        ))}
      </Group>
      <Group title="רקע מקצועי">
        {sectors.map((s) => (
          <Chip key={s} on={f.sectors.includes(s)} onClick={() => toggle('sectors', s)}>{SECTOR_LABEL[s] || s}</Chip>
        ))}
      </Group>

      <div className="grid gap-4 rounded-lg border border-rule p-3 bg-paper">
        <div className="grid gap-2">
          <div className="text-xs font-semibold">מאפייני היישוב (למ״ס) לפי</div>
          <div className="grid grid-cols-2 rounded-md border border-rule overflow-hidden text-xs">
            {[['residence', 'מקום מגורים'], ['birthplace', 'מקום לידה']].map(([v, l]) => (
              <button key={v} onClick={() => set({ place: v })} className={`py-1.5 ${f.place === v ? 'bg-ink text-paper' : ''}`}>{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-sub">ברמת יישוב בלבד. מי שנולד/ה בחו״ל לא נכלל/ת בסינון לפי מקום לידה.</p>
        </div>
        <Group title="אשכול חברתי-כלכלי של היישוב">
          {Object.entries(SES_LABEL).map(([k, l]) => <Chip key={k} on={f.ses.includes(k)} onClick={() => toggle('ses', k)}>{l}</Chip>)}
        </Group>
        <Group title="מדד פריפריאליות">
          {Object.entries(PER_LABEL).map(([k, l]) => <Chip key={k} on={f.periphery.includes(k)} onClick={() => toggle('periphery', k)}>{l}</Chip>)}
        </Group>
        {districts.length > 0 && (
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-sub">מחוז</div>
            <select value={f.district} onChange={(e) => set({ district: e.target.value })}
              className="rounded-lg border border-rule bg-paper px-2 py-1.5 text-sm">
              <option value="">כל המחוזות</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="grid gap-4 rounded-lg border border-rule p-3 bg-paper">
        <div className="grid gap-1">
          <div className="text-xs font-semibold">פעילות בכנסות קודמות</div>
          <p className="text-[11px] text-sub">סינון לפי מדד מציג רק מי שיש לו/ה נתונים (מי שכיהן/ה מהכנסת ה-16 ואילך). חוץ ממספר הכנסות.</p>
        </div>
        {topics && (
          <div className="grid gap-2">
            <div className={`text-xs ${f.initTopic ? 'text-ink font-semibold' : 'text-sub'}`}>יזם/ה הצעות חוק בנושא</div>
            <select value={f.initTopic} onChange={(e) => set({ initTopic: e.target.value })} className="rounded-lg border border-rule bg-paper px-2 py-1.5 text-sm">
              <option value="">כל נושא</option>
              {Object.entries(topics.labels).filter(([k]) => k !== 'other').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {f.initTopic && (
              <>
                <div className="text-xs text-sub flex justify-between"><span>לפחות</span><span className="num">{f.initMin} הצעות</span></div>
                <Slider dir="rtl" min={1} max={60} step={1} value={[f.initMin]} onValueChange={([v]) => set({ initMin: v })} />
              </>
            )}
          </div>
        )}
        <div className="grid gap-2">
          <div className={`text-xs ${f.likeParty ? 'text-ink font-semibold' : 'text-sub'}`}>מצביע/ה כמו רוב המפלגה</div>
          <select value={f.likeParty} onChange={(e) => set({ likeParty: e.target.value })} className="rounded-lg border border-rule bg-paper px-2 py-1.5 text-sm">
            <option value="">בחרו מפלגה</option>
            {parties.filter((p) => p.seats > 0).map((p) => <option key={p.id} value={p.id}>{p.name_he}</option>)}
          </select>
          {f.likeParty && (
            <>
              <div className="text-xs text-sub flex justify-between"><span>לפחות</span><span className="num">{f.likeMin}% מההצבעות השנויות במחלוקת</span></div>
              <Slider dir="rtl" min={0} max={100} step={5} value={[f.likeMin]} onValueChange={([v]) => set({ likeMin: v })} />
            </>
          )}
        </div>
        {METRICS.map((d) => {
          const cur = f.met[d.key] || [0, d.max];
          const on = !!f.met[d.key];
          return (
            <div key={d.key} className="grid gap-2">
              <div className={`text-xs flex justify-between gap-2 ${on ? 'text-ink font-semibold' : 'text-sub'}`}>
                <span>{d.label}</span>
                <span className="num whitespace-nowrap">{cur[0]}–{cur[1]}{d.unit || ''}</span>
              </div>
              <Slider dir="rtl" min={0} max={d.max} step={d.step} value={cur}
                onValueChange={(v) => {
                  const full = v[0] <= 0 && v[1] >= d.max;
                  const met = { ...f.met };
                  if (full) delete met[d.key]; else met[d.key] = v;
                  set({ met });
                }} />
            </div>
          );
        })}
      </div>
      <Group title="ארץ לידה">
        {[['', 'הכול'], ['no', 'נולדו בישראל'], ['yes', 'נולדו בחו״ל']].map(([v, l]) => (
          <Chip key={v} on={f.bornAbroad === v} onClick={() => set({ bornAbroad: v })}>{l}</Chip>
        ))}
      </Group>
      </div>
    </div>
  );
}
