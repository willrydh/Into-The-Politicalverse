"use client";

import { createContext, useContext, type ReactNode } from "react";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";

const LocaleContext = createContext<Locale>("sv");
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) { return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>; }
export function useLocale() { return useContext(LocaleContext); }

export function Localize({ children }: { children: ReactNode }) { return localizeNode(children, useLocale()); }
