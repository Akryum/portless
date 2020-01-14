import fs from 'fs-extra'
import joi from '@hapi/joi'
import { merge } from 'lodash'
import consola from 'consola'
import { getRcFile } from '@portless/util'

export interface PortlessGlobalConfig {
  port: number
  apps?: GlobalAppConfig[]
}

export interface GlobalAppConfig {
  cwd: string
  projectName: string
}

export const DEFAULT_GLOBAL_CONFIG = {
  port: 5678,
}

const globalConfigFile = getRcFile('config.json')

const schema = joi.object({
  port: joi.number(),
  apps: joi.array().items(joi.object({
    cwd: joi.string(),
    projectName: joi.string(),
  })).optional(),
})

async function validateConfig (data: any) {
  const { error } = schema.validate(data)
  if (error) {
    consola.error(`Global config error (${globalConfigFile}):`, error)
    consola.info('Using default config')
    return DEFAULT_GLOBAL_CONFIG
  }
  return data
}

async function writeDefaultConfig () {
  await fs.writeJson(globalConfigFile, DEFAULT_GLOBAL_CONFIG)
  return DEFAULT_GLOBAL_CONFIG
}

export async function loadGlobalConfig (): Promise<PortlessGlobalConfig> {
  if (!fs.existsSync(globalConfigFile)) {
    return writeDefaultConfig()
  } else {
    const data = fs.readJson(globalConfigFile)
    return validateConfig(data)
  }
}

export async function saveGlobalConfig (config: PortlessGlobalConfig): Promise<void> {
  await fs.writeJson(globalConfigFile, config)
}

export async function updateGlobalConfig (config: Partial<PortlessGlobalConfig>): Promise<PortlessGlobalConfig> {
  const currentConfig = await loadGlobalConfig()
  const newConfig = merge({}, currentConfig, config)
  await saveGlobalConfig(newConfig)
  return newConfig
}
