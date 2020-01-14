import { cosmiconfig } from 'cosmiconfig'
import path from 'path'

export interface PortlessProjectConfig {
  projectName: string
  reverseProxy?: ReverseProxyConfig
  domains?: DomainConfig[]
  targetProxy?: string
  greenlock?: GreenlockConfig
  ngrok?: NgrokConfig
}

export interface PortlessConfig extends PortlessProjectConfig {
  cwd: string
  projectRoot: string
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
  configDir?: string
  packageAgent: string
  maintainerEmail: string
  /** Use Let's encrypt staging server */
  staging?: boolean
}

export interface NgrokConfig {
  authtoken: string
  region: 'us' | 'eu' | 'au' | 'ap'
}

export async function loadConfig (cwd: string): Promise<PortlessConfig> {
  const configExplorer = cosmiconfig('portless')
  const result = await configExplorer.search(cwd)
  if (!result || result.isEmpty) {
    throw new Error('No portless config found')
  }
  return {
    cwd,
    projectRoot: path.dirname(result.filepath),
    ...result.config,
  }
}
