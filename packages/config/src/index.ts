import { cosmiconfig } from 'cosmiconfig'

export interface PortlessConfig {
  proxy?: ProxyConfig
}

export interface ProxyConfig {
  redirects: ProxyRedirectConfig[]
}

export interface ProxyRedirectConfig {
  port: number
  target: string
}

export async function loadConfig (): Promise<PortlessConfig> {
  const configExplorer = cosmiconfig('portless')
  const result = await configExplorer.search()
  if (!result || result.isEmpty) {
    throw new Error('No portless config found')
  }
  return result.config
}
