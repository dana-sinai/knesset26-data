import { useQuery } from '@tanstack/react-query';

const cache = new Map();
export async function loadJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(`/data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`לא ניתן לטעון ${path}`);
      return r.json();
    }));
  }
  return cache.get(path);
}

export const useData = (path, opts = {}) =>
  useQuery({ queryKey: ['data', path], queryFn: () => loadJSON(path), staleTime: Infinity, ...opts });

export const useMKs = () => useData('mks.json');
export const useParties = () => useData('parties.json');
export const useMeta = () => useData('meta.json');

export const VOTE_CODE = { 1: 'בעד', 2: 'נגד', 3: 'נמנע', 4: 'נוכח' };
export const VOTE_CLASS = {
  1: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  2: 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200',
  3: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  4: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export const EDU_LABEL = {
  PhD: 'דוקטורט', MD: 'רפואה / רפואת שיניים', 'LLB/LLM': 'משפטים', MA: 'תואר שני', BA: 'תואר ראשון',
  post_secondary: 'על-תיכונית', yeshiva: 'ישיבה / כולל', high_school: 'תיכונית', unknown: 'לא ידוע',
};
export const EDU_ORDER = ['PhD', 'MD', 'LLB/LLM', 'MA', 'BA', 'post_secondary', 'yeshiva', 'high_school', 'unknown'];

export const SECTOR_LABEL = {
  military: 'צבא', security_services: 'שירותי ביטחון', police: 'משטרה', law: 'משפטים', academia: 'אקדמיה',
  business: 'עסקים', high_tech: 'הייטק', public_service: 'שירות ציבורי', local_government: 'שלטון מקומי',
  education: 'חינוך', media: 'תקשורת', health: 'בריאות', religious: 'דת', civil_society_ngo: 'חברה אזרחית',
  politics_party: 'פוליטיקה מפלגתית', agriculture: 'חקלאות', other: 'אחר',
};

export const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('he-IL'));
export const pct = (x, d = 0) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);

export function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
