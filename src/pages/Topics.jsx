import { Link, useSearchParams } from 'react-router-dom';
import { useData, useBillSummaries } from '@/lib/data';
import { Loading, Page, Section } from '@/components/bits';
import ClusterExplorer, { GROUP_NAMES } from '@/components/ClusterExplorer';
import { MKCompare, Sides } from '@/components/ClusterDetail';

const fmtDate = (d) => (d ? d.split('-').reverse().join('.') : '');

export default function Topics() {
  const { data: clusters } = useData('topics/clusters.json');
  const { data: topics } = useData('topics/topics.json');
  const { data: summaries } = useBillSummaries();
  const [sp, setSp] = useSearchParams();
  const t = sp.get('t') || 'all';
  const pick = sp.get('p') ? Number(sp.get('p')) : null;
  if (!clusters || !topics) return <Loading />;
  const d = clusters[t];

  return (
    <Page>
      <header className="grid gap-3 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl">מי מצביע עם מי</h1>
        <p className="text-sub leading-relaxed">
          המפה נבנית רק מההצבעות עצמן, בלי לדעת לאיזו מפלגה כל אחד שייך: חברי כנסת שהצביעו באופן דומה על חוקים שנויים במחלוקת
          קרובים זה לזה, והקבוצות נקבעות אוטומטית. רק אחר כך צובעים כל נקודה בצבע המפלגה – כדי לראות איך המפלגות מתחלקות בין הקבוצות.
          כולל רק מי שכיהן בכנסות קודמות (מאז 2003).
        </p>
        <a href="#how" className="text-sm underline text-sub hover:text-ink justify-self-start">איך זה מחושב, ומה אפשר ואי אפשר ללמוד מזה ↓</a>
      </header>

      <ClusterExplorer topic={t} onTopic={(k) => setSp(k === 'all' ? {} : { t: k })}
        pickedPid={pick} onPickMK={(p) => setSp((cur) => { const n = new URLSearchParams(cur); n.set('p', p); return n; }, { replace: true })}
        below={pick && d && d.points.some((x) => x[0] === pick) && (
          <MKCompare key={`${t}-${pick}`} topic={t} pid={pick}
            groups={d.clusters.map((c) => ({ id: c.id, own: d.points.find((x) => x[0] === pick)?.[3] === c.id }))}
            onClose={() => setSp((cur) => { const n = new URLSearchParams(cur); n.delete('p'); return n; }, { replace: true })} />
        )} />

      {d?.clusters?.length > 1 && (
        <Section title="מה מבדיל בין הקבוצות">
          <p className="text-sm text-sub -mt-2 max-w-3xl">לכל קבוצה: הצעות שרובה תמך בהן ורוב הקבוצות האחרות התנגד להן. השורה הראשונה היא מה פירוש ההצבעה "בעד". לחצו על נקודה במפה כדי לראות איפה חבר/ת כנסת מסוים/ת שונה מכל קבוצה.</p>
          <Sides topic={t} groups={d.clusters.map((c) => ({ id: c.id }))} />
        </Section>
      )}

      {d?.separating?.length > 0 && (
        <Section title="הטבלה המלאה: שיעור התומכים בכל קבוצה">
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
      <HowItWorks d={d} />
    </Page>
  );
}

const sepLabel = (s) => (s == null ? null : s >= 0.5 ? 'הפרדה ברורה' : s >= 0.25 ? 'הפרדה בינונית' : 'הפרדה חלשה');

function Step({ n, title, children }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3">
      <span className="font-title text-3xl text-gold leading-none">{n}</span>
      <div className="grid gap-1">
        <h3 className="text-lg">{title}</h3>
        <div className="text-sm text-ink/85 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

function HowItWorks({ d }) {
  return (
    <Section title="איך זה מחושב">
      <div id="how" className="grid gap-6 max-w-3xl scroll-mt-24">
        {d && (
          <p className="text-sm rounded-xl bg-sand/60 px-4 py-3 leading-relaxed">
            במפה שמוצגת עכשיו: <strong className="num">{d.points.length}</strong> חברי כנסת,{' '}
            <strong className="num">{d.n_votes}</strong> הצבעות שנויות במחלוקת, <strong className="num">{d.clusters.length}</strong> קבוצות.
            {d.silhouette != null && <> מדד ההפרדה (silhouette): <strong className="num">{d.silhouette}</strong> – {sepLabel(d.silhouette)}.</>}
          </p>
        )}
        <ol className="grid gap-5">
          <Step n="1" title="אילו הצבעות נכללות">
            רק הצבעות במליאה על הצעת חוק בשלמותה – קריאה טרומית, ראשונה, העברה לוועדה ואישור סופי – מאז הכנסת ה-16 (2003). הצבעות על סעיפים
            והסתייגויות לא נכללות. מתוכן נלקחות רק הצבעות <strong>שנויות במחלוקת</strong>: לפחות 20 חברי כנסת הצביעו בעד או נגד, ולפחות רבע מהם בכל צד.
            הצבעה שכמעט כולם תמכו בה לא מלמדת על הבדלים. בבחירת נושא, נכללים רק חוקים שסווגו לנושא הזה (כנושא ראשי או משני).
          </Step>
          <Step n="2" title="מי נכלל">
            חברי הכנסת ה-26 שכיהנו בכנסת קודמת, והצביעו בעד או נגד בלפחות 15 מההצבעות בנושא (40 במפה של כל הנושאים). חברי כנסת חדשים לא מופיעים,
            כי עוד אין להם הצבעות. "נמנע" או היעדרות לא נספרים.
          </Step>
          <Step n="3" title="כמה רחוקים כל שניים">
            לכל זוג חברי כנסת בודקים את ההצבעות שבהן שניהם הצביעו, ומחשבים באיזה אחוז מהן הם הצביעו <strong>אחרת</strong> זה מזה. 0 = תמיד הצביעו
            אותו דבר, 1 = תמיד הפוך. זוג שיש לו פחות מ-10 הצבעות משותפות (25 במפה הכללית) מקבל ערך אמצעי, 0.5 – כלומר "לא ידוע".
          </Step>
          <Step n="4" title="איך נבנית המפה">
            בשיטה סטטיסטית בשם MDS (סקיילינג רב-ממדי), שמסדרת את כל הנקודות על דף כך שהמרחקים ביניהן יהיו קרובים ככל האפשר למרחקי ההצבעה.
            <strong> לצירים אין משמעות</strong> – הם לא ימין ושמאל, ואפשר לסובב או להפוך את המפה בלי לשנות דבר. מה שחשוב הוא רק מי קרוב למי.
            מאחר שהמפה דו-ממדית, היא קירוב: ייתכן ששתי נקודות נראות קרובות למרות שהן רחוקות קצת יותר בפועל.
          </Step>
          <Step n="5" title="איך נקבעות הקבוצות">
            אשכול היררכי (average linkage) על אותם מרחקים – כל פעם מחברים את שתי הקבוצות הקרובות ביותר, עד שנשארות 2, 3 או 4. מספר הקבוצות נבחר
            לפי מדד <strong>silhouette</strong>, שבודק עד כמה כל אחד קרוב לקבוצה שלו יותר מאשר לקבוצה השכנה (בין 1- ל-1; ככל שגבוה יותר, הקבוצות
            מובחנות יותר). מספר קבוצות גדול יותר נבחר רק אם הוא משפר את ההפרדה בבירור. הקבוצות נקבעות לכל נושא בנפרד, ולכן אותו אדם יכול להיות
            בקבוצה אחרת בנושא אחר.
          </Step>
          <Step n="6" title="רק בסוף: צבע המפלגה">
            החישוב לא יודע לאיזו מפלגה כל אחד שייך. הצבע מתווסף אחרי שהמפה והקבוצות כבר נקבעו – כדי לראות איך המפלגות של היום מתחלקות ביניהן.
          </Step>
          <Step n="7" title="החוקים שמבדילים בין הקבוצות">
            לכל הצבעה מחשבים את שיעור התומכים בכל קבוצה, ומציגים את ההצבעות שבהן הפער בין הקבוצות הכי גדול (חוק אחד פעם אחת, ורק כשבכל קבוצה
            הצביעו לפחות 5).
          </Step>
        </ol>

        <div className="grid gap-2">
          <h3 className="text-lg">מה אי אפשר ללמוד מזה</h3>
          <ul className="list-disc pr-5 text-sm text-ink/85 leading-relaxed grid gap-1">
            <li><strong>משמעת קואליציונית.</strong> חברי כנסת מצביעים פעמים רבות לפי עמדת הקואליציה או האופוזיציה באותה כנסת, ולא בהכרח לפי עמדה אישית. מי שעבר בין קואליציה לאופוזיציה יכול להיראות "באמצע".</li>
            <li><strong>זמנים שונים מעורבבים.</strong> ההצבעות נאספו לאורך יותר מ-20 שנה; אנשים ומפלגות משנים עמדות.</li>
            <li><strong>מה שלא נספר.</strong> הימנעות והיעדרות הן לפעמים אמירה בפני עצמה, אבל הן לא נכנסות לחישוב.</li>
            <li><strong>סיווג הנושאים</strong> נעשה אוטומטית לפי שם החוק, וייתכנו בו טעויות.</li>
            <li><strong>מעט הצבעות = פחות ודאות.</strong> כשמצביעים על נקודה במפה מופיע מספר ההצבעות שעליהן היא מבוססת.</li>
          </ul>
        </div>
        <p className="text-xs text-sub">הנתונים: מאגר הנתונים הפתוחים של הכנסת, דרך המראה של "הכנסת הפתוחה". פרטים נוספים בעמוד <Link to="/about" className="underline">מקורות ושיטה</Link>.</p>
      </div>
    </Section>
  );
}
