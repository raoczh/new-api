const FALLBACK_SITE_URL = 'https://api.tokencome.org'

export function resolveSiteUrl(configuredAddress: string | undefined): string {
  if (!configuredAddress?.trim()) return FALLBACK_SITE_URL

  try {
    const url = new URL(configuredAddress.trim())
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)
    ) {
      return FALLBACK_SITE_URL
    }

    url.search = ''
    url.hash = ''
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/v1$/, '')
    return url.toString().replace(/\/$/, '')
  } catch {
    return FALLBACK_SITE_URL
  }
}
