const supportedHosts = ['cfpy.ir', 'cafepay.app', 'cafehedayat.com', 'likardbistro.ir']
const reservedSubdomains = ['www', 'm', 'test', 't', 'en']

export function parseTableLink(value, currentUrl) {
  let url
  try {
    url = new URL(value)
  } catch (error) {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null
  const host = supportedHosts.find(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
  let sameOrigin = false
  try {
    sameOrigin = !!currentUrl && url.origin === new URL(currentUrl).origin
  } catch (error) {}
  if (!host && !sameOrigin) return null
  const token = url.searchParams.get('token')
  if (token && token.trim()) return { token: token.trim(), mode: 'link' }
  if (host) {
    const subdomain = url.hostname.slice(0, -(host.length + 1))
    if (subdomain && !subdomain.includes('.') && !reservedSubdomains.includes(subdomain)) {
      return { token: subdomain, mode: 'domain_name' }
    }
    if (['cafehedayat.com', 'likardbistro.ir'].includes(host)) {
      return { token: host.split('.')[0], mode: 'domain_name' }
    }
  }
  return null
}
