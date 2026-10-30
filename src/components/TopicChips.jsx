import { useBillTopics, useTopics } from '@/lib/data';

/** Small topic labels for a bill (by BillID). */
export default function TopicChips({ billId, className = '' }) {
  const { data: bt } = useBillTopics();
  const { data: topics } = useTopics();
  const t = billId != null && bt?.[billId];
  if (!t || !topics) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {t.filter(Boolean).filter((x) => x !== 'other').map((x) => (
        <span key={x} className="text-[10.5px] leading-none px-1.5 py-1 rounded bg-sand text-sub whitespace-nowrap">{topics.labels[x] || x}</span>
      ))}
    </span>
  );
}

/** <select> of topics with counts. counts: {topic: n} */
export function TopicSelect({ value, onChange, counts, allLabel = 'כל הנושאים' }) {
  const { data: topics } = useTopics();
  if (!topics) return null;
  const keys = Object.keys(topics.labels).filter((k) => !counts || counts[k]);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-rule bg-paper px-2 py-1.5 text-sm max-w-[220px]">
      <option value="">{allLabel}</option>
      {keys.map((k) => <option key={k} value={k}>{topics.labels[k]}{counts ? ` (${counts[k]})` : ''}</option>)}
    </select>
  );
}
