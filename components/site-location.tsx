"use client";

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type LocationCrumb = { label: string; href: string };
type SiteLocation = { route: string; query: string; crumbs: LocationCrumb[] } | null;
const LocationContext = createContext<SiteLocation>(null);
const PublishContext = createContext<Dispatch<SetStateAction<SiteLocation>>>(() => {});

export function SiteLocationProvider({ children }: { children: ReactNode }) {
  const [location, publish] = useState<SiteLocation>(null);
  return <PublishContext.Provider value={publish}><LocationContext.Provider value={location}>{children}</LocationContext.Provider></PublishContext.Provider>;
}

export function useSiteLocation() { return useContext(LocationContext); }

// Only the page that owns the geographic selection supplies its verified names.
export function usePublishSiteLocation(route: string, query: string, crumbs: LocationCrumb[]) {
  const publish = useContext(PublishContext);
  const serialized = JSON.stringify(crumbs);
  useEffect(() => {
    publish({ route, query, crumbs: JSON.parse(serialized) });
    return () => publish(null);
  }, [publish, route, query, serialized]);
}
