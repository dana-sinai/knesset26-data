import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/lib/data';
import { classify } from '@/lib/classify';
import { Page, Section } from '@/components/bits';

const EXAMPLES = [
  'הצעת חוק הביטוח הלאומי (תיקון - הגדלת קצבת זקנה לאזרחים ותיקים)',
  'הצעת חוק העונשין (תיקון - החמרת הענישה על עבירות נשק)',
  'הצעת חוק התכנון והבנייה (תיקון - קיצור הליכי רישוי לדיור בר השגה)',
  'הצעת חוק יום הזיכרון לחללי מערכות ישראל (תיקון)',
];

function Bars({ rows, n = 4 }) {
  return (
    <ul className="grid gap-1.5">
      {rows.slice(0, n).map((r, i) => (
        <li key={r.key} className="grid grid-cols-[minmax(120px,auto)_1fr_auto] items-center gap-2 text-sm">
          <span className={i === 0 ? 'font-medium' : 'text-sub'}>{r.label}</span>
          <span className="h-2.5 rounded-full bg-sand overflow-hidden"><span className="block h-full rounded-full bg-ink/70" style={{ width: `${r.p * 100}%` }} /></span>
          <span className="num text-xs text-sub w-10 text-left">{r.p > 0.99 ? '99%+' : r.p < 0.01 ? '<1%' : `${Math.round(r.p * 100)}%`}</span>
        </li>
      ))}
    </ul>
  );
}

function Result({ title, model, text }) {
  const rows = useMemo(() => (model && text.trim() ? classify(model, text) : []), [model, text]);
  if (!model) return null;
  const top = rows[0];
  return (
    <div className="rounded-xl border border-rule p-4 grid gap-3 content-start">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl">{title}</h3>
        {top && <span className={`text-xs rounded-full px-2 py-0.5 ${top.p >= 0.7 ? 'bg-[#E3E9E4] text-[#2F4A3A]' : 'bg-sand text-sub'}`}>{top.p >= 0.7 ? 'בטוח יחסית' : 'לא בטוח'}</span>}
      </div>
      {rows.length ? <Bars rows={rows} /> : <p className="text-sm text-sub">כתבו שם של הצעת חוק כדי לראות.</p>}
      <p className="text-[11px] text-sub">אומן על {model.n_train.toLocaleString('he-IL')} הצעות חוק · דיוק במבחן על הצעות שלא ראה: {Math.round(model.holdout_accuracy * 100)}%</p>
    </div>
  );
}

export default function Classify() {
  const [text, setText] = useState(EXAMPLES[0]);
  const { data: topic } = useData('models/topic.json');
  const { data: mech } = useData('models/mechanism.json', { retry: false });
  const { data: who } = useData('models/who.json', { retry: false });

  return (
    <Page>
      <header className="grid gap-3 max-w-3xl">
        <p className="text-sm text-gold font-semibold">מה הם עושים</p>
        <h1 className="text-4xl sm:text-5xl">המסווג של הצעות החוק</h1>
        <p className="text-sub leading-relaxed">
          כל הצעת חוק באתר מסווגת לפי נושא{mech ? ', מה היא עושה ועל מי היא משפיעה' : ''}. הצעות חדשות מסווגות אוטומטית בכל בוקר על ידי מודל קטן שרץ כאן,
          בדפדפן שלכם. נסו אותו: כתבו שם של הצעת חוק (אמיתית או מומצאת).
        </p>
      </header>

      <div className="grid gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} dir="rtl"
          className="w-full rounded-xl border border-rule bg-paper p-3 text-base leading-relaxed focus:outline-none focus:border-ink/50"
          placeholder="לדוגמה: הצעת חוק שעות עבודה ומנוחה (תיקון - …)" />
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-sub">דוגמאות:</span>
          {EXAMPLES.map((e) => <button key={e} onClick={() => setText(e)} className="rounded-full border border-rule px-2.5 py-1 hover:border-ink/40 text-right">{e.replace('הצעת חוק ', '')}</button>)}
        </div>
      </div>

      <div className={`grid gap-4 ${mech ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <Result title="נושא" model={topic} text={text} />
        <Result title="מה החוק עושה" model={mech} text={text} />
        <Result title="על מי הוא משפיע" model={who} text={text} />
      </div>

      <Section title="איך זה עובד">
        <div className="grid gap-3 max-w-3xl text-sm text-ink/85 leading-relaxed">
          <p>
            <strong>התיוג.</strong> כ-21,000 שמות של הצעות חוק מאז 2003 סווגו לנושאים אחד-אחד{mech ? ', ו-2,566 הצעות שהיו שנויות במחלוקת סווגו גם לפי מה שהן עושות ועל מי הן משפיעות' : ''}.
            הסיווג תיאורי בלבד – לא "ימין" או "שמאל", לא טוב או רע.
          </p>
          <p>
            <strong>המודל.</strong> לכל נושא המודל לומד משקל לכל אחד מ-12,000 צירופי אותיות נפוצים (כמו "קצב", "ביטוח", "עונש"), ולכן הוא מתמודד גם עם
            תחיליות ונטיות של עברית. זו שיטה קלאסית של למידת מכונה (TF-IDF ומכונת וקטורים תומכים לינארית), קלה מספיק כדי לרוץ בדפדפן בלי שרת.
          </p>
          <p>
            <strong>כל יום מחדש.</strong> בכל בוקר המודל מאומן מחדש על כל התוויות, כולל חדשות, ומסווג את ההצעות החדשות. רק סיווגים שהמודל בטוח בהם (70%
            ומעלה – ובהם הדיוק כ-95%) נכנסים לאתר; השאר מסומנים לבדיקה.
          </p>
          <p>
            <strong>מגבלות.</strong> המודל רואה רק את שם ההצעה, לא את תוכנה. שם כללי ("תיקון מס' 12") לא מספיק לו. ב-1 מכל 8 הצעות בערך הוא טועה.
            ראו גם <Link to="/about" className="underline">מקורות ושיטה</Link>.
          </p>
        </div>
      </Section>
    </Page>
  );
}
