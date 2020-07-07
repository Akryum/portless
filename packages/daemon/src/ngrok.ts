import path from 'path'
import fs from 'fs-extra'
import ngrok from 'ngrok'
import consola from 'consola'
import chalk from 'chalk'
import { PortlessConfig } from '@portless/config'
import { ThenType, getDomain } from '@portless/util'

export interface TunnelConfig {
  publicDomain: string
  targetDomain: string
}

export async function useNgrok (config: PortlessConfig, disableTls = false) {
  let tunnels: TunnelConfig[] = []
  let restarting = false

  async function addTunnel (tunnel: TunnelConfig) {
    if (!config.ngrok || !config.domains) return
    const firstPublicDomainConfig = config.domains.find(d => d.public != null)
    if (!firstPublicDomainConfig) return
    const firstPublicDomain: string = firstPublicDomainConfig.public as string

    const configDir = path.resolve(config.projectRoot, (config.greenlock && config.greenlock.configDir) || 'greenlock-config')
    const certDir = path.resolve(configDir, config.greenlock && config.greenlock.staging ? 'staging' : 'live', firstPublicDomain)
    const keyFile = path.resolve(certDir, 'privkey.pem')
    const certFile = path.resolve(certDir, 'cert.pem')

    const useTls = !disableTls && fs.existsSync(keyFile) && fs.existsSync(certFile)
    consola.info('NGROK tls enabled:', useTls ? 'Yes' : 'No')

    tunnels.push(tunnel)

    try {
      const url = await ngrok.connect({
        authtoken: config.ngrok.authtoken,
        region: config.ngrok.region,
        ...useTls ? {
          proto: 'tls',
          addr: getDomain(tunnel.targetDomain),
          key: keyFile,
          crt: certFile,
        } : {
          proto: 'http',
          addr: tunnel.targetDomain,
          bind_tls: 'both',
        },
        hostname: tunnel.publicDomain,
      })
      consola.log(chalk.magenta('NGROK'), chalk.bold(url), '⇒', chalk.blue.bold(tunnel.targetDomain))
      return {
        ...tunnel,
        ngrokUrl: url,
        useTls,
      }
    } catch (e) {
      consola.error(e)
    }
  }

  async function stopTunnels () {
    await ngrok.disconnect()
    tunnels = []
  }

  async function restartTunnels () {
    if (restarting) return
    restarting = true

    consola.info('Restarting Ngrok tunnels with new certificate...')

    const lastTunnels = tunnels.slice()
    await stopTunnels()

    for (const tunnel of lastTunnels) {
      await addTunnel(tunnel)
    }

    restarting = false
  }

  return {
    addTunnel,
    stopTunnels,
    restartTunnels,
  }
}

export type UseNgrok = ThenType<typeof useNgrok>
