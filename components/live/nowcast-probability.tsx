"use client";
import { majorityLabel } from "@/lib/nowcast/current";
import { useLocale } from "../localize";
import type { MajorityProbability } from "@/lib/nowcast/types";
export function NowcastProbabilityPanel({
  probability,
  complete = false,
}: {
  probability: MajorityProbability | null;
  complete?: boolean;
}) {
  const sv = useLocale() === "sv";
  const f = (n: number) =>
    n.toLocaleString(sv ? "sv-SE" : "en-GB", { maximumFractionDigits: 0 });
  const rate = (wins: number) => majorityLabel(wins, probability!.simulations, sv ? "sv-SE" : "en-GB");
  if (complete) return null;
  return (
    <div
      className="nowcast-probability"
      aria-labelledby="nowcast-probability-title"
    >
      <h3 id="nowcast-probability-title">
        {sv
          ? "Vinstsannolikhet · experimentell"
          : "Win probability · experimental"}
      </h3>
      <p className="nowcast-probability__caveat">
        {sv
          ? "Träffsäkerheten är inte belagd. Siffrorna beror på modellens antaganden."
          : "Predictive accuracy is unvalidated. The figures depend on the model’s assumptions."}
      </p>
      {probability && probability.unresolved < probability.simulations ? (
        <>
          <div className="nowcast-probability__groups">
            <div>
              <span>S · V · MP · C</span>
              <strong>{rate(probability.leftWins)}</strong>
            </div>
            <div>
              <span>M · KD · SD · L</span>
              <strong>{rate(probability.rightWins)}</strong>
            </div>
          </div>
          <p className="local-note">
            {sv
              ? `Minst 175 mandat i ${f(probability.simulations)} simuleringar. Det är mandatmajoritet, inte sannolikheten att bilda regering.`
              : `At least 175 seats across ${f(probability.simulations)} simulations. This means a seat majority, not the probability of forming a government.`}
          </p>
          {probability.unresolved > 0 && (
            <p className="local-note">
              {sv
                ? `${f(probability.unresolved)} av ${f(probability.simulations)} simuleringar kan inte mandatfördelas på grund av övriga partier. De ingår i nämnaren.`
                : `${f(probability.unresolved)} of ${f(probability.simulations)} simulations cannot be allocated because of other parties. They remain in the denominator.`}
            </p>
          )}
        </>
      ) : (
        <p className="local-note">
          {probability?.unresolved === probability?.simulations && probability
            ? sv
              ? "Simuleringarna kan inte mandatfördelas på grund av övriga partier."
              : "The simulations cannot be allocated because of other parties."
            : sv
              ? "Visas när valnattsprognosen har tillräckligt verifierat underlag och simuleringarna kan beräknas."
              : "Appears when the election-night projection has sufficient verified data and simulations can be calculated."}
        </p>
      )}
    </div>
  );
}
