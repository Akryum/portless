import { PortlessConfig, ProxyRedirectConfig } from '@portless/config'
import { getPortPromise } from 'portfinder'
import { loadGlobalConfig } from '@portless/global-config'

export async function addAutoReverseProxy (config: PortlessConfig) {
  if (config.domains) {
    let redirects: ProxyRedirectConfig[]
    if (config.reverseProxy) {
      redirects = config.reverseProxy.redirects
    } else {
      redirects = []
    }

    const globalConfig = await loadGlobalConfig()
    let port = globalConfig.port
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
