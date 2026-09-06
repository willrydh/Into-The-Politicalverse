"use client";
import { Localize } from "@/components/localize";
import type { ReactNode } from "react";

export function SectionHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return <Localize>{(
    <div className="section-heading">
      <div>
        <p className="eyebrow eyebrow--dark">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {aside ? <div className="section-heading__aside">{aside}</div> : null}
    </div>
  )}</Localize>;
}
