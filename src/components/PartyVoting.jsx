import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useMKs, useParties, fmt } from '@/lib/data';
import { useOpenMK } from '@/components/MKDrawer';
import { ClusterMap } from '@/components/ClusterExplorer';
import { Section } from '@/components/bits';

// Party-level voting, from topics/cluster_votes_all.json: every contested plenum vote on a whole bill since 2003 (at least
// 20 voted, at least a quarter on each side), and how each of today's MKs who served before voted ("1" for, "2" against,
// "0" did not vote). A list's position in a vote = what most of its voting members did (ties count as no position).
// Members are grouped by the list they were elected on now, even if they sat in another party back then.
const MIN_SHARED = 30;

export function usePartyVotes() {
  const { data: cv } = useData('topics/cluster_votes_all.json');
  const { data: mks } = useMKs();
  return useMemo(() => {
    if (!cv || !mks) return null;
    const N = cv.votes.length;
    const partyOf = Object.fromEntries(mks.filter((m) => m.person_id).map((m) => [String(m.person_id), m.party]));
    const members = {};
    Object.keys(cv.mk).forEach((pid) => { const p = partyOf[pid]; if (p) (members[p] = members[p] || []).push(pid); });
    const pos = {}, cohesion = {}, loyalty = {};
    Object.entries(members).forEach(([party, pids]) => {
      const m = new Array(N).fill(0); let s = 0, n = 0;
      const lo = Object.fromEntries(pids.map((pid) => [pid, [0, 0]]));
      for (let i = 0; i < N; i += 1) {
        let f = 0, a = 0;
        pids.forEach((pid) => { const c = cv.mk[pid][i]; if (c === '1') f += 1; else if (c === '2') a += 1; });
        m[i] = f > a ? 1 : a > f ? 2 : 0;
        if (f + a >= 2) { s += Math.max(f, a) / (f + a); n += 1; }
        // each member against the majority of the OTHER members (so a member is not compared with themselves)
        pids.forEach((pid) => {
          const c = cv.mk[pid][i]; if (c !== '1' && c !== '2') return;
          const fo = f - (c === '1' ? 1 : 0), ao = a - (c === '2' ? 1 : 0);
          if (fo === ao) return;
          lo[pid][1] += 1; if ((fo > ao ? '1' : '2') === c) lo[pid][0] += 1;
        });
      }
      pos[party] = m;
      cohesion[party] = n ? { share: s / n, n } : null;
      loyalty[party] = Object.entries(lo).filter(([, [, t]]) => t >= MIN_SHARED).map(([pid, [k, t]]) => ({ pid, share: k / t, n: t })).sort((x, y) => x.share - y.share);
    });
    const agree = {};
    Object.keys(pos).forEach((A) => {
      agree[A] = {};
      Object.keys(pos).forEach((B) => {
        if (A === B) return;
        let same = 0, both = 0;
        for (let i = 0; i < N; i += 1) if (pos[A][i] && pos[B][i]) { both += 1; if (pos[A][i] === pos[B][i]) same += 1; }
        agree[A][B] = both >= MIN_SHARED ? { share: same / both, n: both } : null;
      });
    });
    return { N, members, cohesion, loyalty, agree };
  }, [cv, mks]);
}

const Pct = ({ v }) => <span className="num">{Math.round(v * 100)}%</span>;

function HBar({ share, color, label, right, onClick }) {
  return (
    <div className="grid grid-cols-[minmax(110px,150px)_1fr_auto] items-center gap-3 text-sm">
      {onClick ? <button onClick={onClick} className="text-right hover:underline truncate">{label}</button> : <span className="truncate">{label}</span>}
      <span className="h-3 rounded-full bg-sand overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: color }} /></span>
      <span className="text-xs w-20 text-left">{right}</span>
    </div>
  );
}

const NOTE = 'לפי ההצבעות של הנבחרים הנוכחיים בכנסות קודמות (מאז 2003), גם אם אז כיהנו במפלגה אחרת. רק הצבעות על הצעות חוק שנויות במחלוקת: לפחות 20 מצביעים, ולפחות רבע מהם בכל צד.';

/** The party page's "what they do" tab. */
export default function PartyVoting({ partyId }) {
  const st = usePartyVotes();
  const { data: mks } = useMKs();
  const { data: parties } = useParties();
  const { data: clusters } = useData('topics/clusters.json');
  const openMK = useOpenMK();
  const [allMK, setAllMK] = useState(false);
  const pById = useMemo(() => Object.fromEntries((parties || []).map((p) => [p.id, p])), [parties]);
  const pidToMK = useMemo(() => Object.fromEntries((mks || []).filter((m) => m.person_id).map((m) => [Number(m.person_id), m])), [mks]);
  if (!st || !parties || !mks) return <p className="text-sub text-sm">טוען…</p>;
  const p = pById[partyId];
  const seated = mks.filter((m) => m.party === partyId);
  const served = st.members[partyId] || [];
  const coh = st.cohesion[partyId];
  const ag = Object.entries(st.agree[partyId] || {}).filter(([, v]) => v).sort((a, b) => b[1].share - a[1].share);
  const loy = st.loyalty[partyId] || [];
  const loyShown = allMK ? loy : loy.slice(0, 6);
  const highlight = new Set(served.map(Number));

  if (!served.length) {
    return <p className="text-sm text-sub max-w-2xl">אף אחד מ-{seated.length} הנבחרים של {p?.name_he} לא כיהן בכנסות קודמות, ולכן אין עדיין הצבעות במליאה. ההצבעות בכנסת ה-26 יופיעו כאן כשיתחילו.</p>;
  }

  return (
    <div className="grid gap-12">
      <p className="text-sm text-sub max-w-3xl -mb-6">
        {served.length} מתוך {seated.length} הנבחרים של {p?.name_he} כיהנו בעבר. {NOTE}
      </p>

      <Section title="כמה הרשימה מצביעה כגוש">
        {coh && (coh.n >= MIN_SHARED ? (
          <div className="grid gap-2 max-w-2xl">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-title text-5xl"><Pct v={coh.share} /></span>
              <span className="text-sm">בממוצע, מחברי הרשימה שהצביעו הצביעו כמו רוב חבריהם לרשימה</span>
            </div>
            <p className="text-xs text-sub">מתוך {fmt(coh.n)} הצבעות שבהן הצביעו לפחות שניים מהם.</p>
            {loy.length > 1 && (
              <div className="grid gap-1.5 mt-2">
                <p className="text-xs text-sub">כל חבר/ת כנסת: באיזה חלק מההצבעות הצביע/ה כמו רוב שאר חברי הרשימה (מהנמוך לגבוה).</p>
                {loyShown.map((x) => {
                  const m = pidToMK[Number(x.pid)];
                  return <HBar key={x.pid} share={x.share} color={p?.color} label={m?.name_he} onClick={() => openMK(m.id, { tab: 'map' })} right={<><Pct v={x.share} /> <span className="text-sub num">({fmt(x.n)})</span></>} />;
                })}
                {loy.length > 6 && <button onClick={() => setAllMK((v) => !v)} className="justify-self-start text-xs underline text-sub hover:text-ink">{allMK ? 'פחות' : `כל ${loy.length}`}</button>}
              </div>
            )}
          </div>
        ) : <p className="text-sm text-sub">רק חבר/ת כנסת אחד/ת מהרשימה כיהן/ה בעבר, אז אין עם מי להשוות.</p>)}
      </Section>

      {ag.length > 0 && (
        <Section title="עם מי הרשימה מצביעה" aside={<Link to="/party-votes" className="text-xs underline text-sub hover:text-ink">כל הרשימות ←</Link>}>
          <p className="text-sm text-sub -mt-2 max-w-3xl">באיזה חלק מההצבעות רוב חברי {p?.name_he} ורוב חברי הרשימה האחרת הצביעו אותו דבר (מתוך ההצבעות שבהן לשתיהן הייתה עמדה).</p>
          <div className="grid gap-1.5 max-w-2xl">
            {ag.map(([id, v]) => (
              <HBar key={id} share={v.share} color={pById[id]?.color} label={<Link to={`/party/${id}?tab=record`} className="hover:underline">{pById[id]?.name_he}</Link>} right={<><Pct v={v.share} /> <span className="text-sub num">({fmt(v.n)})</span></>} />
            ))}
          </div>
        </Section>
      )}

      {clusters?.all && (
        <Section title="איפה הם במפת מי עם מי" aside={<Link to="/clusters" className="text-xs underline text-sub hover:text-ink">למפה המלאה, לפי נושא ←</Link>}>
          <p className="text-sm text-sub -mt-2 max-w-3xl">כל נקודה היא חבר/ת כנסת, ומי שמצביעים דומה קרובים זה לזה. מודגשים חברי {p?.name_he}. לחיצה על נקודה פותחת את הכרטיס.</p>
          <div className="max-w-3xl"><ClusterMap data={clusters.all} pidToMK={pidToMK} partyById={pById} highlight={highlight} topic="all" /></div>
        </Section>
      )}

      <p className="text-sm"><Link to="/votes" className="underline text-sub hover:text-ink">כל ההצבעות במליאה, ואיך הצביע כל אחד ←</Link></p>
    </div>
  );
}

/** /party-votes: every list against every list, and how much each votes as a bloc. */
export function PartyVotesOverview() {
  const st = usePartyVotes();
  const { data: parties } = useParties();
  if (!st || !parties) return <p className="text-sub text-sm">טוען…</p>;
  const list = parties.filter((p) => p.seats > 0 && st.members[p.id]?.length);
  const heat = (v) => (v == null ? {} : { background: `rgba(74,110,140,${0.08 + v * 0.8})`, color: v > 0.6 ? '#fff' : 'inherit' });
  return (
    <div className="grid gap-12">
      <Section title="כמה כל רשימה מצביעה כגוש">
        <p className="text-sm text-sub -mt-2 max-w-3xl">בממוצע, איזה חלק מחברי הרשימה שהצביעו הצביעו כמו רוב חבריהם לרשימה. לחצו על רשימה לפירוט לפי חבר/ת כנסת.</p>
        <div className="grid gap-1.5 max-w-2xl">
          {[...list].filter((p) => st.cohesion[p.id]?.n >= MIN_SHARED).sort((a, b) => st.cohesion[b.id].share - st.cohesion[a.id].share).map((p) => (
            <HBar key={p.id} share={st.cohesion[p.id].share} color={p.color} label={<Link to={`/party/${p.id}?tab=record`} className="hover:underline">{p.name_he}</Link>}
              right={<><Pct v={st.cohesion[p.id].share} /> <span className="text-sub num">({st.members[p.id].length})</span></>} />
          ))}
        </div>
        <p className="text-[11px] text-sub">בסוגריים: כמה מהנבחרים כיהנו בעבר. רשימה שחבריה הגיעו ממפלגות שונות תיראה פחות מגובשת, כי בעבר הם הצביעו במפלגות שונות.</p>
      </Section>
      <Section title="מי מצביע עם מי">
        <p className="text-sm text-sub -mt-2 max-w-3xl">באיזה חלק מההצבעות רוב חברי שתי הרשימות הצביעו אותו דבר. כהה יותר = מסכימות יותר.</p>
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="text-xs border-separate border-spacing-0.5">
            <thead><tr><th className="sticky right-0 bg-paper z-10" />{list.map((x) => <th key={x.id} className="font-medium text-sub px-0.5 align-bottom"><span className="block w-14 leading-tight">{x.name_he}</span></th>)}</tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <th className="sticky right-0 bg-paper z-10 text-right font-normal pl-2 whitespace-nowrap"><Link to={`/party/${a.id}?tab=record`} className="hover:underline">{a.name_he}</Link></th>
                  {list.map((b) => {
                    const v = a.id === b.id ? null : st.agree[a.id]?.[b.id];
                    return <td key={b.id} className="p-0"><span className="num w-14 h-7 rounded grid place-items-center" style={a.id === b.id ? { background: 'rgb(var(--sand))' } : heat(v?.share)} title={v ? `${a.name_he} · ${b.name_he}: ${Math.round(v.share * 100)}% מתוך ${v.n} הצבעות` : ''}>{v ? Math.round(v.share * 100) : ''}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-sub max-w-3xl">{NOTE}</p>
      </Section>
    </div>
  );
}
