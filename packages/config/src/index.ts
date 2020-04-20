import { cosmiconfig } from 'cosmiconfig'
import path from 'path'

export interface PortlessProjectConfig {
  projectName: string
  domains?: DomainConfig[]
  targetProxy?: string
  greenlock?: GreenlockConfig
  ngrok?: NgrokConfig
}

export interface PortlessConfig extends PortlessProjectConfig {
  cwd: string
  projectRoot: string
}

export interface DomainConfig {
  id: string
  public?: string
  local?: string
  target: string
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

export async function loadConfig (cwd: string = process.cwd()): Promise<PortlessConfig> {
  const configExplorer = cosmiconfig('portless', {
    cache: false,
  })
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
