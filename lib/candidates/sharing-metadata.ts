import { SHARE_DESIGN, shareDescription, shareTitle, type ShareLocale, type SharePerson, type ShareScope } from "./sharing";

export const shareProfileURL = (origin: string, person: SharePerson, scope: ShareScope, locale: ShareLocale) => `${origin}${locale === "en" ? "/en" : ""}/people/?${new URLSearchParams({ person: person.id, election: scope.election, area: scope.area })}`;
export const shareImageURL = (origin: string, person: SharePerson, scope: ShareScope, locale: ShareLocale) => `${origin}/share/candidate/${person.id}.png?${new URLSearchParams({ election: scope.election, area: scope.area, lang: locale, v: `${person.revision}-${SHARE_DESIGN}` })}`;
export type ShareTag = { tag: "meta" | "link"; selector: string; attributes: Record<string, string> };

export function candidateShareMetadata(origin: string, person: SharePerson, scope: ShareScope, locale: ShareLocale) {
  const title = shareTitle(person, scope), description = shareDescription(person, scope, locale);
  const url = shareProfileURL(origin, person, scope, locale), image = shareImageURL(origin, person, scope, locale);
  const tags: ShareTag[] = [{ tag: "link", selector: 'link[rel="canonical"]', attributes: { rel: "canonical", href: url } }];
  const meta = (key: string, content: string, attr = "property") => tags.push({ tag: "meta", selector: `meta[${attr}="${key}"]`, attributes: { [attr]: key, content } });
  meta("description", description, "name");
  for (const lang of ["sv", "en", "x-default"] as const) tags.push({ tag: "link", selector: `link[rel="alternate"][hreflang="${lang}"]`, attributes: { rel: "alternate", hreflang: lang, href: shareProfileURL(origin, person, scope, lang === "en" ? "en" : "sv") } });
  for (const [key, value] of [["og:type", "profile"], ["og:site_name", "Into the Politicalverse"], ["og:title", title], ["og:description", description], ["og:url", url], ["og:locale", locale === "sv" ? "sv_SE" : "en_GB"], ["og:image", image], ["og:image:secure_url", image], ["og:image:type", "image/png"], ["og:image:width", "1200"], ["og:image:height", "630"], ["og:image:alt", description]]) meta(key, value);
  for (const [key, value] of [["twitter:card", "summary_large_image"], ["twitter:title", title], ["twitter:description", description], ["twitter:image", image], ["twitter:image:alt", description]]) meta(key, value, "name");
  return { title, tags };
}
