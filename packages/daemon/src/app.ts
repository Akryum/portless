import consola from 'consola'
import { loadConfig, PortlessConfig } from '@portless/config'
import { loadGlobalConfig, saveGlobalConfig } from '@portless/global-config'
import { UseGreenlock, useGreenlock } from './greenlock'
import { UseReverseProxy, useReverseProxy, forceHttps } from './proxy'
import { UseNgrok, useNgrok } from './ngrok'

export class App {
  config: PortlessConfig
  greenlock: UseGreenlock
  reverseProxy: UseReverseProxy
  ngrok: UseNgrok | null

  async start (cwd: string) {
    this.config = await loadConfig(cwd)
    this.greenlock = await useGreenlock(this.config)
    if (this.config.ngrok) {
      this.ngrok = await useNgrok(this.config, this.greenlock?.needsRenewing)
    } else {
      this.ngrok = null
    }
    this.reverseProxy = await useReverseProxy(this.config, {
      publicKeyId: this.greenlock ? this.greenlock.publicKeyId : undefined,
    })

    if (this.config.domains && this.ngrok) {
      for (const domainConfig of this.config.domains) {
        if (domainConfig.public) {
          const result = await this.ngrok.addTunnel({
            publicDomain: domainConfig.public,
            targetDomain: process.env.PORTLESS_DAEMON_URL as string,
          })
          if (result) {
            forceHttps(domainConfig.public, result.useTls)
          }
        }
      }
    }

    if (this.greenlock && this.ngrok) {
      this.greenlock.onCertificateIssued(() => {
        this.ngrok?.restartTunnels()
      })
    }

    consola.success(`[daemon] Service fo app ${this.config.projectName} started`)
  }

  async stop () {
    if (this.greenlock) {
      await this.greenlock.destroy()
    }

    if (this.ngrok) {
      await this.ngrok.stopTunnels()
    }

    if (this.reverseProxy) {
      await this.reverseProxy.destroy()
    }

    consola.success(`[daemon] Service fo app ${this.config.projectName} stopped`)
  }
}

const apps: App[] = []

export function getAppByProjectName (projectName: string) {
  return apps.find(app => app.config.projectName === projectName)
}

export function getAppByCwd (cwd: string) {
  return apps.find(app => app.config.cwd === cwd)
}

export async function addApp (cwd: string) {
  const app = new App()
  await app.start(cwd)
  apps.push(app)
  await saveApps()
  return app
}

export async function removeApp (app: App) {
  await app.stop()
  const index = apps.indexOf(app)
  if (index !== -1) apps.splice(index, 1)
  await saveApps()
}

export async function restartApp (app: App) {
  const cwd = app.config.cwd
  await app.stop()
  await app.start(cwd)
}

export async function stopAllApps () {
  for (const app of apps) {
    await app.stop()
  }
}

async function saveApps () {
  const config = await loadGlobalConfig()
  config.apps = apps.map(app => ({
    projectName: app.config.projectName,
    projectRoot: app.config.projectRoot,
  }))
  await saveGlobalConfig(config)
}

export async function restoreApps () {
  const config = await loadGlobalConfig()
  if (config.apps) {
    for (const app of config.apps) {
      await addApp(app.projectRoot)
    }
  }
}
