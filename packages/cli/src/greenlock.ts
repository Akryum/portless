import Greenlock from 'greenlock'
import consola from 'consola'
import fs from 'fs-extra'
import path from 'path'
import { PortlessConfig } from '@portless/config'
import { getDomain } from './util/domain'
import { getRcFolder } from './util/rc-folder'

export interface GreenlockInfo {
  publicKeyId?: string
}

export async function setupGreenlock (config: PortlessConfig): Promise<GreenlockInfo> {
  const options = config.greenlock
  if (!options) return {}

  let publicDomains: string[]
  if (config.domains) {
    publicDomains = config.domains
      .filter(domainConfig => !!domainConfig.publicUrl)
      // @ts-ignore
      .map(domainConfig => getDomain(domainConfig.publicUrl))
  } else {
    consola.warn('No public domains defined.')
    return {}
  }

  const configDir = getRcFolder('greenlock-config')
  const packageRoot = getRcFolder('greenlock')

  const site = {
    subject: publicDomains[0],
    altnames: publicDomains,
  }

  const greenlock = Greenlock.create({
    configDir,
    packageRoot,
    packageAgent: options.packageAgent,
    maintainerEmail: options.maintainerEmail,
    server: options.staging,
    notify: (event: string, details: any) => {
      if (event === 'error') {
        consola.error(details)
      } else if (event === 'warning') {
        consola.warn(details)
      } else {
        consola.info(details)
      }
    },
  })

  await greenlock.manager.defaults({
    subscriberEmail: options.maintainerEmail,
    agreeToTerms: true,
  })

  await greenlock.add(site)

  const accountFile = path.resolve(configDir, 'accounts/acme-v02.api.letsencrypt.org/directory', `${options.maintainerEmail}.json`)
  const accountData = await fs.readJson(accountFile)
  const publicKeyId = accountData.publicKeyJwk.kid

  return {
    publicKeyId,
  }
}
