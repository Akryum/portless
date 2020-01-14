import fs from 'fs-extra'
import joi from '@hapi/joi'
import { merge } from 'lodash'
import consola from 'consola'
import { getRcFile } from '@portless/util'

export interface PortlessGlobalConfig {
  port: number
  host?: string
  apps?: GlobalAppConfig[]
}

export interface GlobalAppConfig {
  projectName: string
  projectRoot: string
}

export const DEFAULT_GLOBAL_CONFIG = {
  port: 5656,
  host: '0.0.0.0',
}

const globalConfigFile = getRcFile('config.json')

const schema = joi.object({
  port: joi.number().required(),
  host: joi.string().optional(),
  apps: joi.array().items(joi.object({
    projectName: joi.string().required(),
    projectRoot: joi.string().required(),
  })).optional(),
})

async function validateConfig (data: any) {
  const { error } = schema.validate(data)
  if (error) {
    consola.error(`Global config error (${globalConfigFile}):`, error)
    consola.info(`Overriding with default config, backed up to ${globalConfigFile}.bak`)
    await fs.writeJson(`${globalConfigFile}.bak`, data, {
      spaces: 2,
    })
    return writeDefaultConfig()
  }
  return data
}

async function writeDefaultConfig () {
  await fs.writeJson(globalConfigFile, DEFAULT_GLOBAL_CONFIG, {
    spaces: 2,
  })
  return DEFAULT_GLOBAL_CONFIG
}

export async function loadGlobalConfig (): Promise<PortlessGlobalConfig> {
  if (!fs.existsSync(globalConfigFile)) {
    return writeDefaultConfig()
  } else {
    const data = await fs.readJson(globalConfigFile)
    return validateConfig(data)
  }
}

export async function saveGlobalConfig (config: PortlessGlobalConfig): Promise<void> {
  await fs.writeJson(globalConfigFile, config, {
    spaces: 2,
  })
}

export async function updateGlobalConfig (config: Partial<PortlessGlobalConfig>): Promise<PortlessGlobalConfig> {
  const currentConfig = await loadGlobalConfig()
  const newConfig = merge({}, currentConfig, config)
  await saveGlobalConfig(newConfig)
  return newConfig
}
