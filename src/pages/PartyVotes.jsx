import { Page } from '@/components/bits';
import { PartyVotesOverview } from '@/components/PartyVoting';

export default function PartyVotes() {
  return (
    <Page>
      <header className="grid gap-2 max-w-3xl">
        <p className="text-sm text-gold font-semibold">מה הם עושים</p>
        <h1 className="text-4xl">המפלגות בהצבעות</h1>
        <p className="text-sub leading-relaxed">
          איך מצביעות הרשימות שנבחרו לכנסת ה-26, לפי מה שעשו חבריהן בכנסות קודמות: כמה כל רשימה מצביעה כגוש, ואילו רשימות מצביעות יחד.
          לחיצה על רשימה פותחת את עמוד המפלגה בלשונית „מה הם עושים״.
        </p>
      </header>
      <PartyVotesOverview />
    </Page>
  );
}
