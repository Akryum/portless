import { loadConfig } from '@portless/config'
import { proxyTarget } from './proxy'

export async function startProxy () {
  const config = await loadConfig()
  if (config.proxy) {
    for (const redirect of config.proxy.redirects) {
      proxyTarget(redirect.port, redirect.target)
    }
  }
}
