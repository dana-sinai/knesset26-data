import { useMemo, useState } from 'react';

export const EMPTY = {
  q: '', parties: [], gender: '', ageMin: 20, ageMax: 90, edu: [], sectors: [], tenure: '', district: '',
  place: 'residence', ses: [], periphery: [], popType: [], haredi: '', bornAbroad: '', met: {},
  initTopic: '', initMin: 1, likeParty: '', likeMin: 50,
};

/** Numbers we know about each MK's record (m.metrics). Every one is a filter and a sort key. */
export const METRICS = [
  { key: 'faction_rate', label: 'הצבעה כמו רוב הסיעה', unit: '%', pct: true, max: 100, step: 1 },
  { key: 'participation', label: 'השתתפות בהצבעות במליאה', unit: '%', pct: true, max: 100, step: 1 },
  { key: 'bills_per_k', label: 'הצעות חוק שיזם/ה, בממוצע לכנסת', max: 400, step: 5 },
  { key: 'bills_passed', label: 'הצעות חוק שיזם/ה והפכו לחוק', max: 120, step: 1 },
  { key: 'cmt_rate', label: 'נוכחות בוועדות שבהן היה/תה חבר/ה', unit: '%', pct: true, max: 100, step: 1 },
  { key: 'cmt_per_k', label: 'ישיבות ועדה, בממוצע לכנסת', max: 650, step: 10 },
  { key: 'terms', label: 'מספר כנסות קודמות', max: 14, step: 1, all: true },
];
export const metricValue = (m, def) => {
  const v = m.metrics?.[def.key];
  return v == null ? null : def.pct ? v * 100 : v;
};

// Locality-level buckets (CBS). Used for MKs' home locality / birthplace and for voters.
export const SES_B = (c) => (c == null ? null : c <= 3 ? 'low' : c <= 6 ? 'mid' : 'high');
export const PER_B = (c) => (c == null ? null : c <= 3 ? 'periphery' : c <= 6 ? 'middle' : 'center');
export const POP_B = (a) => (a == null ? null : a >= 90 ? 'arab' : a >= 10 ? 'mixed' : 'jewish');
export const SES_LABEL = { low: 'אשכול 1–3', mid: 'אשכול 4–6', high: 'אשכול 7–10' };
export const PER_LABEL = { periphery: 'פריפריה (1–3)', middle: 'ביניים (4–6)', center: 'מרכז (7–10)' };
export const POP_LABEL = { jewish: 'יישוב יהודי', mixed: 'יישוב מעורב', arab: 'יישוב ערבי' };

export const placeOf = (m, place) => (place === 'birthplace' ? m.birthplace_loc : m.residence);

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
        const hay = [m.name_he, m.name_en, m.residence?.name, m.birthplace, m.bio_he, ...(m.career || []).map((c) => `${c.role} ${c.organization}`),
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
      if (f.bornAbroad === 'yes' && m.born_abroad !== true) return false;
      if (f.bornAbroad === 'no' && m.born_abroad !== false) return false;
      const P = placeOf(m, f.place);
      if (f.district && P?.district !== f.district) return false;
      if (f.ses.length && !f.ses.includes(SES_B(P?.socioeconomic_cluster))) return false;
      if (f.periphery.length && !f.periphery.includes(PER_B(P?.periphery_cluster))) return false;
      if (f.popType.length && !f.popType.includes(POP_B(P?.arab_pct))) return false;
      for (const [key, [lo, hi]] of Object.entries(f.met)) {
        const def = METRICS.find((d) => d.key === key);
        const v = def && metricValue(m, def);
        if (v == null || v < lo || v > hi) return false;
      }
      if (f.initTopic && ((m.initiated_topics || {})[f.initTopic] || 0) < f.initMin) return false;
      if (f.likeParty) {
        const r = (m.agreement || {})[f.likeParty];
        if (r == null || r * 100 < f.likeMin) return false;
      }
      if (f.haredi === 'yes' && !((P?.haredi_hh_pct ?? 0) >= 50 || P?.religiosity_main === 'Haredi')) return false;
      return true;
    });
  }, [mks, f]);

  const active = JSON.stringify(f) !== JSON.stringify({ ...EMPTY, ...initial });
  return { f, set, toggle, reset, filtered, active };
}
