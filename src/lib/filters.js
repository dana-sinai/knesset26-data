import { useMemo, useState } from 'react';

export const EMPTY = { q: '', parties: [], gender: '', ageMin: 20, ageMax: 90, edu: [], sectors: [], tenure: '', district: '' };

export function useMKFilters(mks, initial = {}) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const reset = () => setF({ ...EMPTY, ...initial });
  const toggle = (key, val) => setF((s) => ({ ...s, [key]: s[key].includes(val) ? s[key].filter((x) => x !== val) : [...s[key], val] }));

  const filtered = useMemo(() => {
    if (!mks) return [];
    const q = f.q.trim().toLowerCase();
    return mks.filter((m) => {
      if (q) {
        const hay = [m.name_he, m.name_en, m.residence?.name, m.bio_he, ...(m.career || []).map((c) => `${c.role} ${c.organization}`),
          ...(m.education || []).map((e) => `${e.field || ''} ${e.institution || ''}`)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.parties.length && !f.parties.includes(m.party)) return false;
      if (f.gender && m.gender !== f.gender) return false;
      const ageActive = f.ageMin > EMPTY.ageMin || f.ageMax < EMPTY.ageMax;
      if (ageActive && (m.age == null || m.age < f.ageMin || m.age > f.ageMax)) return false;
      if (f.edu.length && !f.edu.includes(m.education_level)) return false;
      if (f.sectors.length && !f.sectors.some((s) => m.sectors.includes(s))) return false;
      if (f.tenure === 'new' && !m.is_new) return false;
      if (f.tenure === 'returning' && m.is_new) return false;
      if (f.district && m.residence?.district !== f.district) return false;
      return true;
    });
  }, [mks, f]);

  const active = JSON.stringify({ ...f }) !== JSON.stringify({ ...EMPTY, ...initial });
  return { f, set, toggle, reset, filtered, active };
}
