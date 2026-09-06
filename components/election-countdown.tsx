"use client";
import { Localize } from "@/components/localize";


import { daysUntilElection, electionCycleProgress } from "@/lib/elections/calendar";

export function ElectionCountdown() {
  const days = daysUntilElection(new Date());

  return <Localize>{(
    <div className="countdown" aria-label={`${days} days to election`} suppressHydrationWarning>
      <span className="countdown__number">{days}</span>
      <span className="countdown__copy">
        <strong>days</strong>
        <span>to election</span>
      </span>
    </div>
  )}</Localize>;
}

export function ElectionCycleProgress() {
  const progress = electionCycleProgress(new Date());

  return <Localize>{(
    <div className="election-progress" aria-label={`${progress}% of the 2022 to 2026 election cycle elapsed`} suppressHydrationWarning>
      <div><span style={{ width: `${progress}%` }} /></div>
      <small><b>11 Sep 2022</b><b>13 Sep 2026</b></small>
    </div>
  )}</Localize>;
}
