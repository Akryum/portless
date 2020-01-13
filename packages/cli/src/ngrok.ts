import path from 'path'
import fs from 'fs-extra'
import ngrok from 'ngrok'
import consola from 'consola'
import chalk from 'chalk'
import { PortlessConfig } from '@portless/config/src'
import { getRcFolder } from './util/rc-folder'
import { getDomain } from './util/domain'

export interface TunnelConfig {
  publicUrl: string
  targetUrl: string
}

const tunnels: TunnelConfig[] = []
let lastConfig: PortlessConfig

export async function addNgrokTunnel (config: PortlessConfig, tunnel: TunnelConfig) {
  lastConfig = config

  if (!config.ngrok || !config.domains) return
  const firstPublicDomainConfig = config.domains.find(d => d.publicUrl != null)
  if (!firstPublicDomainConfig) return
  const firstPublicDomain: string = firstPublicDomainConfig.publicUrl as string

  const configDir = getRcFolder('greenlock-config')
  const certDir = path.resolve(configDir, 'live', getDomain(firstPublicDomain))
  const keyFile = path.resolve(certDir, 'privkey.pem')
  const certFile = path.resolve(certDir, 'cert.pem')

  const useHttps = fs.existsSync(keyFile) && fs.existsSync(certFile)

  tunnels.push(tunnel)

  try {
    const url = await ngrok.connect({
      authtoken: config.ngrok.authtoken,
      region: config.ngrok.region,
      ...useHttps ? {
        proto: 'tls',
        addr: getDomain(tunnel.targetUrl),
        key: keyFile,
        crt: certFile,
      } : {
        proto: 'http',
        addr: tunnel.targetUrl,
        bind_tls: 'both',
      },
      hostname: getDomain(tunnel.publicUrl),
    })
    consola.success(chalk.yellow('Ngrok'), url, '=>', tunnel.targetUrl)
    return url
  } catch (e) {
    consola.error(e)
  }
}

let restarted = false

export async function restartNgrokTunnels () {
  if (!lastConfig || restarted) return
  restarted = true

  consola.info('Restarting Ngrok tunnels with new certificate...')

  await ngrok.kill()

  for (const tunnel of tunnels) {
    await addNgrokTunnel(lastConfig, tunnel)
  }
}
