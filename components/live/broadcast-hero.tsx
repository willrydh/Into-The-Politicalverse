"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "../localize";

const POLLS_CLOSE = Date.parse("2026-09-13T18:00:00Z");

export function ElectionBroadcastHero({
  state,
  checkedAt,
  countedDistricts,
  totalDistricts,
}: {
  state: "waiting" | "receiving" | "delayed";
  checkedAt: string;
  countedDistricts: number;
  totalDistricts: number;
}) {
  const sv = useLocale() === "sv";
  const locale = sv ? "sv-SE" : "en-GB";
  const root = useRef<HTMLElement>(null);
  const [now, setNow] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      if (document.hidden) return;
      const time = Date.now();
      setNow(time);
      if (time >= POLLS_CLOSE) clearInterval(timer);
    };
    const timer = setInterval(update, 1000);
    const first = setTimeout(update, 0);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [visible]);
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const remaining =
    now === null ? null : Math.max(0, Math.ceil((POLLS_CLOSE - now) / 1000));
  const countdown =
    remaining === null
      ? null
      : [
          Math.floor(remaining / 3600),
          Math.floor((remaining % 3600) / 60),
          remaining % 60,
        ]
          .map((n) => String(n).padStart(2, "0"))
          .join(":");
  const receiving = state === "receiving";
  const hasCounted = countedDistricts > 0;
  const closing = now !== null && now < POLLS_CLOSE;
  const status =
    state === "delayed"
      ? sv
        ? "Uppdatering fördröjd"
        : "Updates delayed"
      : receiving
        ? sv
          ? "Rösträkning pågår"
          : "Counting in progress"
        : sv
          ? "Inväntar valresultat"
          : "Awaiting results";
  return (
    <section
      ref={root}
      className="live-hero broadcast-hero"
      data-state={state}
      data-motion={visible ? "running" : "paused"}
    >
      <div className="broadcast-atmosphere" aria-hidden="true" />
      <div className="broadcast-masthead">
        <span>Politicalverse</span>
        <span className="broadcast-status">
          <i aria-hidden="true" />
          {status}
        </span>
      </div>
      <div className="broadcast-stage">
        <div className="broadcast-copy">
          <p className="broadcast-kicker">
            {sv
              ? "Riksdagsvalet · 13 september"
              : "Parliamentary election · 13 September"}
          </p>
          <h1>
            {sv ? "Valnatten" : "Election night"} <span>2026</span>
          </h1>
          <p className="broadcast-intro">
            {sv
              ? "Från första distriktet till sista mandatet."
              : "From the first district to the final seat."}
          </p>
          <p className="broadcast-description">
            {sv
              ? "Officiella röster och mandat från Valmyndigheten. Våra prognoser redovisas separat."
              : "Official votes and seats from the Swedish Election Authority. Our projections are shown separately."}
          </p>
        </div>
        <div className="broadcast-ident" aria-hidden="true">
          <div className="broadcast-orbit broadcast-orbit--outer" />
          <div className="broadcast-orbit broadcast-orbit--inner" />
          <div className="broadcast-crosshair" />
          <div className="broadcast-crown" />
          <span className="broadcast-ident__label">PV · 2026</span>
        </div>
        <div className="broadcast-clock" aria-live="off">
          <span>
            {hasCounted
              ? sv
                ? "Räknade distrikt"
                : "Counted districts"
              : closing
                ? sv
                  ? "Vallokalerna stänger om"
                  : "Polls close in"
                : now !== null
                  ? sv
                    ? "Vallokalerna stängde"
                    : "Polls closed"
                  : sv
                    ? "Vallokalerna stänger"
                    : "Polls close"}
          </span>
          <strong>
            {hasCounted ? (
              <>
                {countedDistricts.toLocaleString(locale)}
                <small> / {totalDistricts.toLocaleString(locale)}</small>
              </>
            ) : closing ? (
              countdown
            ) : (
              "20:00"
            )}
          </strong>
          <small>
            {hasCounted
              ? sv
                ? "Enligt Valmyndigheten"
                : "Swedish Election Authority"
              : now !== null && !closing
                ? sv
                  ? "13 september · svensk tid · inväntar nya resultat"
                  : "13 September · Swedish time · awaiting new results"
                : sv
                  ? "13 september · svensk tid"
                  : "13 September · Swedish time"}
          </small>
        </div>
      </div>
      <div className="broadcast-lower-third" role="status">
        <span className="broadcast-signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <div>
          <strong>
            {state === "delayed"
              ? sv
                ? "Senast verifierade uppgifter ligger kvar"
                : "Last verified figures are retained"
              : receiving
                ? sv
                  ? "Resultaten uppdateras automatiskt"
                  : "Results update automatically"
                : sv
                  ? "Här börjar valnatten"
                  : "Election night starts here"}
          </strong>
          <span>
            {state === "delayed"
              ? sv
                ? "Kontrollera källtiderna innan du tolkar siffrorna."
                : "Check the source timestamps before interpreting the figures."
              : receiving
                ? sv
                  ? "Uppgifterna uppdateras när en ny källversion är verifierad."
                  : "Figures refresh when a new source version is verified."
                : sv
                  ? "De första siffrorna visas när Valmyndigheten publicerar dem."
                  : "The first figures appear when the Election Authority publishes them."}
          </span>
        </div>
        <small>
          {sv ? "Senast kontrollerat" : "Last checked"}
          <time dateTime={checkedAt}>
            {new Date(checkedAt).toLocaleString(locale, {
              timeZone: "Europe/Stockholm",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          <span>{sv ? "svensk tid" : "Swedish time"}</span>
        </small>
      </div>
    </section>
  );
}
