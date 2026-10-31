import { forwardRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Maximize2 } from 'lucide-react';
import { MKProfile } from '@/pages/MKPage';

/** Search string for the current page with ?mk=<id> added (or removed when id is null). */
export function withMK(search, id, opts = {}) {
  const sp = new URLSearchParams(search);
  sp.delete('mktab'); sp.delete('mkt');
  if (id == null) sp.delete('mk'); else sp.set('mk', id);
  if (id != null && opts.tab) sp.set('mktab', opts.tab);
  if (id != null && opts.topic) sp.set('mkt', opts.topic);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * Link to a member that opens the side drawer over the current page.
 * The drawer lives in the URL (?mk=…), so the browser Back button closes it,
 * and ctrl/cmd-click still opens the full page in a new tab.
 */
export const MKLink = forwardRef(function MKLink({ id, children, onClick, ...rest }, ref) {
  const loc = useLocation();
  const navigate = useNavigate();
  return (
    <a
      ref={ref}
      href={`/mk/${id}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate({ pathname: loc.pathname, search: withMK(loc.search, id) }, { preventScrollReset: true, state: { drawer: true } });
      }}
      {...rest}
    >
      {children}
    </a>
  );
});

export function useOpenMK() {
  const loc = useLocation();
  const navigate = useNavigate();
  // opts: { tab, topic } — open the card on a given tab (e.g. the "who with whom" tab for a topic)
  return (id, opts) => navigate({ pathname: loc.pathname, search: withMK(loc.search, id, opts) }, { preventScrollReset: true, state: { drawer: true } });
}

export default function MKDrawer() {
  const [sp] = useSearchParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const id = sp.get('mk');

  const close = () => {
    // Opened from inside the site → step back in history (keeps Back/Forward natural).
    if (loc.state?.drawer) navigate(-1);
    else navigate({ pathname: loc.pathname, search: withMK(loc.search, null) }, { replace: true, preventScrollReset: true });
  };

  return (
    <Dialog.Root open={!!id} onOpenChange={(o) => { if (!o) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1500] bg-ink/25 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          dir="rtl"
          className="fixed z-[1501] inset-y-0 left-0 w-full sm:w-[min(760px,92vw)] bg-paper text-ink border-r border-rule shadow-2xl flex flex-col
                     data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=open]:duration-300 focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-2 px-5 h-12 border-b border-rule shrink-0">
            <Dialog.Title className="text-xs text-sub">כרטיס חבר/ת כנסת</Dialog.Title>
            <div className="flex items-center gap-1">
              {id && (
                <Link to={`/mk/${id}`} className="flex items-center gap-1 text-xs text-sub hover:text-ink px-2 py-1 rounded-md hover:bg-sand">
                  <Maximize2 size={13} /> עמוד מלא
                </Link>
              )}
              <Dialog.Close className="p-1.5 rounded-md hover:bg-sand" aria-label="סגירה"><X size={18} /></Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {id && <MKProfile key={`${id}-${sp.get('mktab') || ''}-${sp.get('mkt') || ''}`} id={id} compact initialTab={sp.get('mktab')} initialTopic={sp.get('mkt')} />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
