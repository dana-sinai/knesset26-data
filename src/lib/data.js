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
export const useTopics = () => useData('topics/topics.json');
export const useBillTopics = () => useData('topics/bill_topics.json');

/** The bill's page on the Knesset website. */
export const knessetBillUrl = (billId) =>
  `https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=${billId}`;

export const VOTE_CODE = { 1: 'בעד', 2: 'נגד', 3: 'נמנע', 4: 'נוכח' };
export const VOTE_CLASS = {
  1: 'bg-[#E3E9E4] text-[#2F4A3A] dark:bg-[#2F4A3A]/50 dark:text-[#D3E0D6]',
  2: 'bg-[#EEE2E2] text-[#6A3036] dark:bg-[#6A3036]/50 dark:text-[#EAD3D5]',
  3: 'bg-[#ECE7DC] text-[#5F5236] dark:bg-[#5F5236]/50 dark:text-[#E6DCC6]',
  4: 'bg-sand text-sub',
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

const SOURCE_HE = {
  'en.wikipedia.org': 'ויקיפדיה באנגלית', 'he.wikipedia.org': 'ויקיפדיה', 'ar.wikipedia.org': 'ויקיפדיה בערבית',
  'wikidata.org': 'ויקינתונים', 'i24news.tv': 'i24NEWS', 'idi.org.il': 'המכון הישראלי לדמוקרטיה',
  'israelhayom.co.il': 'ישראל היום', 'ynetnews.com': 'ynet', 'ynet.co.il': 'ynet', 'srugim.co.il': 'סרוגים', 'kipa.co.il': 'כיפה',
  'maariv.co.il': 'מעריב', 'globes.co.il': 'גלובס', 'makorrishon.co.il': 'מקור ראשון', 'timesofisrael.com': 'טיימס אוף ישראל',
  'israelnationalnews.com': 'ערוץ 7', 'inn.co.il': 'ערוץ 7', 'mako.co.il': 'מאקו', 'kikar.co.il': 'כיכר השבת', 'walla.co.il': 'וואלה',
  'calcalist.co.il': 'כלכליסט', 'jpost.com': 'ג׳רוזלם פוסט', 'haaretz.co.il': 'הארץ', 'knesset.gov.il': 'אתר הכנסת',
  'main.knesset.gov.il': 'אתר הכנסת', 'oknesset.org': 'כנסת פתוחה', 'cyclowiki.org': 'ציקלוויקי', 'zman.co.il': 'זמן ישראל',
  'kohelet.org.il': 'פורום קהלת', 'ice.co.il': 'ice', 'jdn.co.il': 'JDN', 'br7news.co.il': 'חדשות באר שבע',
};
/** Short Hebrew name for a source URL (falls back to the domain). */
export function sourceName(u) {
  const s = String(u);
  if (/KNS_Person/i.test(s)) return 'מאגר הכנסת';
  if (!s.startsWith('http')) return s;
  const h = hostname(s);
  return SOURCE_HE[h] || h;
}
export const FIELD_HE = {
  party_he: 'מפלגה', list_position: 'מקום ברשימה', name_he: 'שם', name_en: 'שם באנגלית', gender: 'מגדר', birth_date: 'תאריך לידה',
  birth_year: 'שנת לידה', birthplace: 'מקום לידה', education: 'השכלה', highest_education_level: 'השכלה (גבוהה)', career: 'קריירה',
  military_service: 'שירות צבאי', government_roles: 'תפקידים בממשלה', family_status: 'מצב משפחתי', bio_summary_he: 'תקציר',
  wikipedia_en: 'ויקיפדיה באנגלית', wikipedia_he: 'ויקיפדיה', prior_knesset_terms: 'כנסות קודמות', is_new_mk: 'חדש/ה בכנסת',
  languages: 'שפות', residence_locality_he: 'מקום מגורים', residence_note: 'הערה על מקום המגורים', residence: 'מקום מגורים',
};

export function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
