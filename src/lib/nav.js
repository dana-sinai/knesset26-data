import { useLocation } from 'react-router-dom';

// The site's sections, used by the header menu and by the home page.
export const NAV_GROUPS = [
  {
    key: 'who', title: 'מי הם', lead: 'האנשים והרשימות',
    items: [
      ['/who', 'תמונה כללית', 'נשים וגברים, גיל, השכלה, קריירה ומגורים – וכל נתון הוא גם מסנן'],
      ['/mks', 'חברי הכנסת', 'רקע, השכלה, קריירה ותפקידים של כל אחד מ-120 הנבחרים'],
      ['/parties', 'הרכב המפלגות', 'מי נבחר בכל רשימה: נשים, חדשים, גילאים והשכלה'],
      ['/map', 'מפה', 'איפה גרים ואיפה נולדו חברי הכנסת, ברמת יישוב'],
    ],
  },
  {
    key: 'voters', title: 'מי בחר בהם', lead: 'הבוחרים',
    items: [
      ['/voters', 'תמונה כללית', 'מפת היישובים, וכל המפלגות מול כל מאפייני הלמ״ס בטבלה אחת'],
      ['/represent', 'מה מאפיין את הבוחרים', 'לכל מפלגה: איפה היא חזקה, מפת הקולות, ומה מנבא את ההצבעה לה'],
    ],
  },
  {
    key: 'do', title: 'מה הם עושים', lead: 'הצבעות וחקיקה',
    items: [
      ['/clusters', 'מי עם מי', 'מפת חברי הכנסת לפי ההצבעות שלהם, בלי קשר למפלגה'],
      ['/party-votes', 'המפלגות בהצבעות', 'כמה כל רשימה מצביעה כגוש, ועם אילו רשימות היא מצביעה'],
      ['/votes', 'כל ההצבעות', 'כל הצבעה במליאה מאז 2003, ואיך הצביע כל אחד'],
    ],
  },
];

export const groupOf = (path) => NAV_GROUPS.find((g) => g.items.some(([to]) => path === to || path.startsWith(`${to}/`)))?.key;

// A party page has one tab per section, and a member page's tabs belong to a section too, so wherever a page is
// opened from, the header shows the section it is about.
export const PARTY_TAB = { who: 'people', voters: 'voters', do: 'record' };
const TAB_SECTION = { people: 'who', voters: 'voters', record: 'do' };
const MK_TAB_SECTION = { profile: 'who', sources: 'who', knesset: 'do', votes: 'do', bills: 'do', committees: 'do', practice: 'do', map: 'do' };

export function sectionOf(pathname, search = '') {
  const tab = new URLSearchParams(search).get('tab');
  if (pathname.startsWith('/party/')) return TAB_SECTION[tab] || 'who';
  if (pathname.startsWith('/mk/')) return MK_TAB_SECTION[tab] || 'who';
  if (pathname === '/topics') return 'do';
  return groupOf(pathname);
}

/** Link to a party page, opened on the tab of the section the visitor is in now. */
export function usePartyHref() {
  const { pathname, search } = useLocation();
  const tab = PARTY_TAB[sectionOf(pathname, search)];
  return (id, section) => `/party/${id}${(section ? PARTY_TAB[section] : tab) ? `?tab=${section ? PARTY_TAB[section] : tab}` : ''}`;
}
