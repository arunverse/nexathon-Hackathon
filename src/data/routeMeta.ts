import routeData from './routeMeta.json'

export interface RouteMetaItem {
  title: string
  desc: string
  canonicalPath: string
}

export const CANONICAL_DOMAIN: string = routeData.CANONICAL_DOMAIN

export const PUBLIC_ROUTES: Record<string, RouteMetaItem> = routeData.PUBLIC_ROUTES

// Helper mapping for canonical path lookup
export const PUBLIC_PATHS: Record<string, string> = Object.fromEntries(
  Object.entries(PUBLIC_ROUTES).map(([path, data]) => [path, data.canonicalPath])
)

// Helper mapping for document title and meta description
export const ROUTE_META: Record<string, { title: string; desc: string }> = Object.fromEntries(
  Object.entries(PUBLIC_ROUTES).map(([path, data]) => [path, { title: data.title, desc: data.desc }])
)
