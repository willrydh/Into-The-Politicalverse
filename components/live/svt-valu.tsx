"use client";

import { useLocale } from "@/components/localize";
import { PartyMark } from "@/components/party-mark";
import type { SvtValu } from "@/lib/data/svt-valu";
import { translateText } from "@/lib/i18n/translate";
import { PARTIES } from "@/lib/parties";

export function SvtValuPanel({ survey }: { survey: SvtValu }) {
  const locale = useLocale();
  const sv = locale === "sv";
  const language = sv ? "sv-SE" : "en-GB";
  const percent = (value: number) =>
    `${value.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  const time = new Date(survey.retrievedAt).toLocaleString(language, {
    timeZone: "Europe/Stockholm",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <section
      className="product-section svt-valu"
      id="svt-valu"
      aria-labelledby="svt-valu-title"
      data-classification={survey.classification}
    >
      <div className="svt-valu__intro">
        <p className="eyebrow eyebrow--dark">
          POLL · {sv ? "Riksdagsvalet" : "Riksdag election"} 2026
        </p>
        <h2 id="svt-valu-title">{sv ? "SVT:s Valu" : "SVT Valu"}</h2>
        <p>
          {sv
            ? "Så svarade väljarna i SVT:s vallokalsundersökning. Siffrorna gäller hela Sverige."
            : "How voters answered SVT’s exit poll. These figures cover all of Sweden."}
        </p>
        <p className="svt-valu__sample">
          <strong>{survey.sampleSize.toLocaleString(language)}</strong>{" "}
          {sv
            ? "väljare · val- och förtidsröstningslokaler"
            : "voters · polling and advance-voting locations"}
        </p>
        <p className="svt-valu__note">
          {sv
            ? "En undersökning, inte räknade röster. Valu hålls separat från våra prognoser och Valmyndighetens resultat."
            : "A survey, not counted votes. Valu is kept separate from our forecasts and the Election Authority’s results."}
        </p>
        <a
          className="text-link"
          href={survey.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {sv ? "Se Valu hos SVT ↗" : "View Valu at SVT ↗"}
        </a>
      </div>
      <div className="svt-valu__results">
        <table
          aria-label={
            sv
              ? "SVT Valu 2026, uppskattad röstandel per parti"
              : "SVT Valu 2026, estimated vote share by party"
          }
        >
          <thead>
            <tr>
              <th scope="col">{sv ? "Parti" : "Party"}</th>
              <th scope="col">Valu, %</th>
            </tr>
          </thead>
          <tbody>
            {survey.parties.map(({ partyId, share }) => (
              <tr key={partyId}>
                <th scope="row">
                  <span className="svt-valu__party">
                    {partyId !== "OTHER" && (
                      <PartyMark party={PARTIES[partyId]} size="sm" />
                    )}
                    {partyId === "OTHER"
                      ? sv
                        ? "Övriga"
                        : "Other parties"
                      : translateText(PARTIES[partyId].name, locale)}
                  </span>
                  <span className="svt-valu__track" aria-hidden="true">
                    <span
                      style={{
                        width: `${share}%`,
                        backgroundColor: PARTIES[partyId].color,
                      }}
                    />
                  </span>
                </th>
                <td>{percent(share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="svt-valu__note">
          {sv ? "Hämtad" : "Retrieved"}{" "}
          <time dateTime={survey.retrievedAt}>{time}</time> ·{" "}
          {sv ? "avrundat till en decimal" : "rounded to one decimal"}
        </p>
      </div>
    </section>
  );
}
