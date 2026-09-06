"use client";
import { Localize } from "@/components/localize";
import Link from "next/link";

export default function NotFound() {
  return <Localize>{<div className="not-found"><span>404 / OUTSIDE THE DATASET</span><h1>This coordinate does not exist.</h1><Link className="button button--acid" href="/">Return to overview</Link></div>}</Localize>;
}
