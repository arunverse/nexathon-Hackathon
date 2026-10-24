import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { CANONICAL_DOMAIN, PUBLIC_PATHS, ROUTE_META } from '../../data/routeMeta'

function setMetaTag(selector: string, attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function CanonicalManager() {
  const { pathname } = useLocation()

  useEffect(() => {
    let canonicalUrl: string | null = null
    const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

    // Match exact public paths
    if (PUBLIC_PATHS[cleanPath] !== undefined) {
      const canonicalPath = PUBLIC_PATHS[cleanPath]
      canonicalUrl = canonicalPath === '/' ? `${CANONICAL_DOMAIN}/` : `${CANONICAL_DOMAIN}${canonicalPath}`
    } else if (cleanPath.startsWith('/careers/')) {
      // Clean dynamic career role pages (exclude query strings / hashes)
      canonicalUrl = `${CANONICAL_DOMAIN}${cleanPath}`
    } else {
      // Default to root canonical domain for general visits
      canonicalUrl = `${CANONICAL_DOMAIN}/`
    }

    // Update document title, meta description, and social metadata if configured
    if (ROUTE_META[cleanPath]) {
      const meta = ROUTE_META[cleanPath]
      document.title = meta.title
      setMetaTag("meta[name='description']", 'name', 'description', meta.desc)
      setMetaTag("meta[property='og:title']", 'property', 'og:title', meta.title)
      setMetaTag("meta[property='og:description']", 'property', 'og:description', meta.desc)
      setMetaTag("meta[name='twitter:title']", 'name', 'twitter:title', meta.title)
      setMetaTag("meta[name='twitter:description']", 'name', 'twitter:description', meta.desc)
    }

    // Ensure link[rel='canonical'] exists and is updated
    let link = document.querySelector<HTMLLinkElement>("link[rel='canonical']")
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }

    if (canonicalUrl) {
      link.setAttribute('href', canonicalUrl)
      setMetaTag("meta[property='og:url']", 'property', 'og:url', canonicalUrl)
    }

    // Protect private routes from search engine indexing
    const isPrivate =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/scan') ||
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/welcome' ||
      pathname === '/choose-plan'

    let robotsMeta = document.querySelector<HTMLMetaElement>("meta[name='robots']")
    if (isPrivate) {
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta')
        robotsMeta.setAttribute('name', 'robots')
        document.head.appendChild(robotsMeta)
      }
      robotsMeta.setAttribute('content', 'noindex, nofollow')
    } else if (robotsMeta) {
      robotsMeta.setAttribute('content', 'index, follow')
    }
  }, [pathname])

  return null
}
