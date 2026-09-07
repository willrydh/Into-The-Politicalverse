import GlobalNotFoundPage from "./global-not-found-document";
import { siteViewport } from "@/lib/viewport";
import "./globals.css";

export const viewport = siteViewport;

export default function GlobalNotFound() {
  return <GlobalNotFoundPage />;
}
