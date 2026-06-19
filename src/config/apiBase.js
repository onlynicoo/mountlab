const DEFAULT_API_BASE = 'http://127.0.0.1:3001'

export function getApiBase() {
  const injectedBase = globalThis.window?.__MOUNTLAB_API_BASE__
    || globalThis.window?.mountlab?.apiBase
  const envBase = import.meta.env.VITE_API_BASE

  return (injectedBase || envBase || DEFAULT_API_BASE).replace(/\/+$/, '')
}

export const API_BASE = getApiBase()

export function absoluteApiUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${API_BASE}${url}`
}

export function projectFileUrl(pathname) {
  if (!pathname?.startsWith('/projects/')) return pathname

  const params = new URLSearchParams({ path: pathname })
  return `${API_BASE}/api/project-file?${params.toString()}`
}
