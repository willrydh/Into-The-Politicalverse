import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { localizedHref, translateText } from "./translate";
import type { Locale } from "./messages";

/** Translate rendered React text and accessible labels, preserving event handlers and values. */
export function localizeNode(node: ReactNode, locale: Locale): ReactNode {
  if (typeof node === "string") return translateText(node, locale);
  if (Array.isArray(node)) return node.map((child, index) => localizeNode(isValidElement(child) && child.key === null ? cloneElement(child, { key: `text-${index}` }) : child, locale));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  if (typeof element.type === "string" && ["script", "style", "code"].includes(element.type)) return node;
  const props: Record<string, unknown> = {};
  for (const name of ["aria-label", "title", "alt", "placeholder", "eyebrow", "label", "copy", "description"]) {
    if (typeof element.props[name] === "string") props[name] = translateText(element.props[name], locale);
  }
  if (typeof element.props.href === "string" && !element.props["data-language-switch"]) props.href = localizedHref(element.props.href, locale);
  if (element.props.children !== undefined) props.children = localizeNode(element.props.children as ReactNode, locale);
  return cloneElement(element, props);
}
