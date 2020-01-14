import Greenlock from 'greenlock'
import consola from 'consola'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import { PortlessConfig } from '@portless/config'
import { wait, ThenType } from '@portless/util'

export async function useGreenlock (config: PortlessConfig) {
  const greenlockConfig = config.greenlock
  if (!greenlockConfig) return null

  const secureDomains: string[] = []
  if (config.domains) {
    for (const domainConfig of config.domains) {
      if (domainConfig.public) {
        secureDomains.push(domainConfig.public)
      }
      if (domainConfig.local) {
        secureDomains.push(domainConfig.local)
      }
    }
  }
  
  if (!secureDomains.length) {
    consola.warn('No public or local domains defined.')
    return null
  }

  const configDir = path.resolve(config.projectRoot, greenlockConfig.configDir || 'greenlock-config')
  fs.ensureDirSync(configDir)

  const site = {
    subject: secureDomains[0],
    altnames: secureDomains,
  }

  const certificateIssuedCallbacks: Function[] = []

  const greenlock = Greenlock.create({
    configDir,
    packageRoot: config.projectRoot,
    packageAgent: greenlockConfig.packageAgent,
    maintainerEmail: greenlockConfig.maintainerEmail,
    staging: greenlockConfig.staging,
    notify: (event: string, details: any) => {
      if (event === 'error') {
        consola.error(details)
      } else if (event === 'warning') {
        consola.warn(details)
      } else if (event === 'certificate_order') {
        consola.info('Ordering certificate...', details.subject, details.altnames)
      } else if (event === 'challenge_select') {
        consola.info('Challenging', details.altname)
      } else if (event === 'challenge_status') {
        if (details.status === 'pending') {
          consola.info('Challenge pending', details.altname)
        } else if (details.status === 'valid') {
          consola.success(chalk.green('Challenge valid'), details.altname)
        } else {
          consola.info('Challenge status', details)
        }
      } else if (event === 'certificate_status') {
        if (details.status === 'valid') {
          consola.success(chalk.green('Certificate valid'), details.subject)
        } else {
          consola.info('Challenge status', details)
        }
      } else if (event === 'cert_issue') {
        consola.success(chalk.green('Certificate issued'), details)
        certificateIssuedCallbacks.forEach(cb => cb())
      } else {
        consola.info(chalk.blue(event), details)
      }
    },
  })

  await greenlock.manager.defaults({
    subscriberEmail: greenlockConfig.maintainerEmail,
    agreeToTerms: true,
    directoryUrl: greenlockConfig.staging ? 'https://acme-staging-v02.api.letsencrypt.org/directory' : 'https://acme-v02.api.letsencrypt.org/directory',
  })

  await greenlock.add(site)

  const accountFile = path.resolve(configDir, `accounts/acme${greenlockConfig.staging ? '-staging' : ''}-v02.api.letsencrypt.org/directory`, `${greenlockConfig.maintainerEmail}.json`)

  async function readAccountData (): Promise<any> {
    if (fs.existsSync(accountFile)) {
      return fs.readJson(accountFile)
    } else {
      await wait(500)
      return readAccountData()
    }
  }
  const accountData = await readAccountData()
  const publicKeyId = accountData.publicKeyJwk.kid

  async function destroy () {
    await greenlock.remove({
      subject: site.subject,
    })
  }

  function onCertificateIssued (callback: Function) {
    certificateIssuedCallbacks.push(callback)
  }

  return {
    publicKeyId,
    destroy,
    onCertificateIssued,
  }
}

export type UseGreenlock = ThenType<typeof useGreenlock>
