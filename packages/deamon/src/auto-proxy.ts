import { PortlessConfig, ProxyRedirectConfig } from '@portless/config'
import { getPortPromise } from 'portfinder'

export async function addAutoReverseProxy (config: PortlessConfig) {
  if (config.domains) {
    let redirects: ProxyRedirectConfig[]
    if (config.reverseProxy) {
      redirects = config.reverseProxy.redirects
    } else {
      redirects = []
    }

    let port = 2000
    for (const domainConfig of config.domains) {
      if (!redirects.some(r => r.target === domainConfig.targetUrl)) {
        port = await getPortPromise({
          port,
        })
        redirects.push({
          port,
          target: domainConfig.targetUrl,
        })
        port++
      }
    }

    if (redirects.length) {
      config.reverseProxy = {
        redirects,
      }
    }
  }
}
