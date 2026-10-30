import { Link, useSearchParams } from 'react-router-dom';
import { useData, useBillSummaries } from '@/lib/data';
import { Loading, Page, Section } from '@/components/bits';
import ClusterExplorer, { GROUP_NAMES } from '@/components/ClusterExplorer';

const fmtDate = (d) => (d ? d.split('-').reverse().join('.') : '');

export default function Topics() {
  const { data: clusters } = useData('topics/clusters.json');
  const { data: topics } = useData('topics/topics.json');
  const { data: summaries } = useBillSummaries();
  const [sp, setSp] = useSearchParams();
  const t = sp.get('t') || 'all';
  if (!clusters || !topics) return <Loading />;
  const d = clusters[t];

  return (
    <Page>
      <header className="grid gap-3 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl">מי מצביע עם מי, לפי נושא</h1>
        <p className="text-sub leading-relaxed">
          המפה נבנית רק מההצבעות עצמן, בלי לדעת לאיזו מפלגה כל אחד שייך: חברי כנסת שהצביעו באופן דומה על חוקים שנויים במחלוקת
          קרובים זה לזה, והקבוצות נקבעות אוטומטית. רק אחר כך צובעים כל נקודה בצבע המפלגה – כדי לראות איך המפלגות מתחלקות בין הקבוצות.
          כולל רק מי שכיהן בכנסות קודמות (מאז 2003).
        </p>
      </header>

      <ClusterExplorer topic={t} onTopic={(k) => setSp(k === 'all' ? {} : { t: k })} />

      {d?.separating?.length > 0 && (
        <Section title="החוקים שהכי מבדילים בין הקבוצות">
          <div className="overflow-x-auto rounded-xl border border-rule">
            <table className="w-full text-sm">
              <thead className="bg-sand/60 text-xs text-sub"><tr>
                <th className="text-right font-medium px-3 py-2">הצעת החוק</th>
                <th className="text-right font-medium px-3 py-2 whitespace-nowrap">תאריך</th>
                {d.clusters.map((c) => <th key={c.id} className="text-right font-medium px-3 py-2 whitespace-nowrap">{GROUP_NAMES[c.id]}: בעד</th>)}
              </tr></thead>
              <tbody>
                {d.separating.map(([vid, k, date, name, stage, shares, meaning, billId]) => (
                  <tr key={vid} className="border-t border-rule align-top">
                    <td className="px-3 py-2">
                      <Link to={`/votes?k=${k}&id=${vid}`} className="hover:underline">{name}</Link>
                      {meaning && <div className="text-xs text-ink/80 mt-0.5">{meaning}</div>}
                      {summaries?.[billId] && (
                        <details className="text-xs text-ink/80 mt-0.5">
                          <summary className="cursor-pointer text-sub">תקציר החוק</summary>
                          <span className="block mt-1 leading-relaxed">{summaries[billId]}</span>
                        </details>
                      )}
                      <div className="text-[11px] text-sub">{{ final: 'אישור סופי', early: 'קריאה טרומית / ראשונה', whole: 'הצבעה על ההצעה' }[stage]}</div>
                    </td>
                    <td className="px-3 py-2 num text-sub whitespace-nowrap">{fmtDate(date)}</td>
                    {shares.map((s, i) => <td key={i} className="px-3 py-2 num">{Math.round(s * 100)}%</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-sub">שיעור המצביעים בעד בכל קבוצה (מתוך מי שהצביע בעד או נגד). מוצגות רק הצבעות שבהן הצביעו לפחות 5 מכל קבוצה.</p>
        </Section>
      )}
    </Page>
  );
}
