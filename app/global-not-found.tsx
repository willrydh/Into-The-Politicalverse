import GlobalNotFoundPage from "@/components/global-not-found";
import { siteViewport } from "@/lib/viewport";
import "./globals.css";

export const viewport = siteViewport;

export default function GlobalNotFound() {
  return <GlobalNotFoundPage />;
}
