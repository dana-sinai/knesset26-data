import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { appParams } from '@/lib/app-params';

export const APP_ID = appParams?.appId || '6ae471d76106749b2b96d473';

/** Adds a record to one of the app's tables (anyone may add; only the admin can read error reports). */
export async function addRecord(entity, record) {
  const r = await fetch(`/api/apps/${APP_ID}/entities/${entity}`, {
    method: 'POST', headers: { 'X-App-Id': APP_ID, 'Content-Type': 'application/json' }, body: JSON.stringify(record),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/** Opens the error-report form from anywhere. `context` = what the report is about (a member, a vote…). */
export const openReport = (context) => window.dispatchEvent(new CustomEvent('open-report', { detail: { context } }));

export function ReportLink({ context, className = 'underline', children = 'דיווח על טעות' }) {
  return <button type="button" onClick={() => openReport(context)} className={className}>{children}</button>;
}

/** Mounted once (in the layout). Records the page (path + query) and what was being looked at. */
export default function ReportDialog() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  useEffect(() => {
    const h = (e) => { setContext(e.detail?.context || document.title); setMessage(''); setState('idle'); setOpen(true); };
    window.addEventListener('open-report', h);
    return () => window.removeEventListener('open-report', h);
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setState('sending');
    try {
      await addRecord('ErrorReport', { page: `${loc.pathname}${loc.search}`, context, message: message.trim(), contact: contact.trim() || null, status: 'new' });
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="z-[1600] bg-paper border-rule max-w-lg text-right">
        <DialogTitle className="text-2xl">מצאתם טעות?</DialogTitle>
        <DialogDescription className="text-sm text-sub">
          תודה! הדיווח נשמר יחד עם העמוד שבו אתם נמצאים, כדי שנדע בדיוק על מה מדובר.
        </DialogDescription>
        {state === 'sent' ? (
          <div className="grid gap-3">
            <p>הדיווח התקבל. נבדוק ונתקן אם צריך.</p>
            <button onClick={() => setOpen(false)} className="justify-self-start rounded-full bg-ink text-paper px-4 py-1.5 text-sm">סגירה</button>
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-3 text-sm">
            <div className="rounded-lg bg-sand/60 px-3 py-2 text-xs text-sub">
              <div>עמוד: <span className="text-ink" dir="ltr">{loc.pathname}{loc.search}</span></div>
              {context && <div>נושא: <span className="text-ink">{context}</span></div>}
            </div>
            <label className="grid gap-1">
              <span>מה לא נכון? (רצוי עם קישור למקור)</span>
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                className="rounded-lg border border-rule bg-paper p-2 focus:outline-none focus:border-ink/50" />
            </label>
            <label className="grid gap-1">
              <span>דרך לחזור אליכם <span className="text-sub">(לא חובה; לא יפורסם)</span></span>
              <input type="email" dir="ltr" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="email@example.com"
                className="rounded-lg border border-rule bg-paper p-2 text-left focus:outline-none focus:border-ink/50" />
            </label>
            {state === 'error' && <p className="text-[#6A3036]">השליחה לא הצליחה. נסו שוב בעוד רגע.</p>}
            <button type="submit" disabled={state === 'sending'} className="justify-self-start rounded-full bg-ink text-paper px-4 py-1.5 disabled:opacity-60">
              {state === 'sending' ? 'שולח…' : 'שליחה'}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
