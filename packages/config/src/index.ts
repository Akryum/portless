import { cosmiconfig } from 'cosmiconfig'

export interface PortlessConfig {
  projectName: string
  reverseProxy?: ReverseProxyConfig
  domains?: DomainConfig[]
  targetProxy?: string
  greenlock?: GreenlockConfig
}

export interface ReverseProxyConfig {
  redirects: ProxyRedirectConfig[]
}

export interface ProxyRedirectConfig {
  port: number
  target: string
}

export interface DomainConfig {
  publicUrl?: string
  localUrl?: string
  targetUrl: string
}

export interface GreenlockConfig {
  packageAgent: string
  maintainerEmail: string
  /** Use Let's encrypt staging server */
  staging?: boolean
}

export async function loadConfig (): Promise<PortlessConfig> {
  const configExplorer = cosmiconfig('portless')
  const result = await configExplorer.search()
  if (!result || result.isEmpty) {
    throw new Error('No portless config found')
  }
  return result.config
}
