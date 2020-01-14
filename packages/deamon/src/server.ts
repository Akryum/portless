import http from 'http'
import express from 'express'
import bodyParser from 'body-parser'
import { getPortPromise } from 'portfinder'
import fs from 'fs-extra'
import path from 'path'
import consola from 'consola'
import chalk from 'chalk'
import { loadGlobalConfig } from '@portless/global-config'
import { getRcFile } from '@portless/util'
import { renderTemplate } from '@portless/template'
import { addApp, stopAllApps, restartApp, getAppByCwd, removeApp, restoreApps } from './app'
import { getProxy } from './proxy'

export async function startServer () {
  /** Exposes the actual port where the server is listening */
  const portFile = getRcFile('port.json')
  const portData = fs.existsSync(portFile) ? await fs.readJson(portFile) : null

  const config = await loadGlobalConfig()
  const port = await getPortPromise({
    port: config.port,
  })

  const host = config.host || 'localhost'

  const app = express()

  app.use((req, res, next) => {
    const host = req.get('host')
    if (host) {
      const proxy = getProxy(host)
      if (proxy) {
        consola.log(req.protocol, host, req.path, chalk.cyan('PROXY'), proxy.targetDomain)
        proxy.webMiddleware(req, res)
        return
      }
    }
    next()
  })

  app.use(bodyParser.json())
  
  app.get('/.well-known/status', (req, res) => {
    res.json({ status: 'live' })
  })

  app.get('/proxy.pac', async (req, res) => {
    const config = await loadGlobalConfig()
    res.status(200)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(renderTemplate(path.resolve(__dirname, `../templates/pac${config.proxy ? '-with-proxy' : ''}.ejs`), {
      config,
      host,
      port,
    }))
    res.end()
  })

  app.post('/api/stop', async (req, res) => {
    await stopAllApps()
    res.json({ success: true })
    server.close()
    process.exit(0)
  })

  app.post('/api/apps', async (req, res) => {
    console.log(req.body)
    const app = await addApp(req.body.cwd)
    res.json({
      success: true,
      data: {
        projectName: app.config.projectName,
      },
    })
  })

  app.post('/api/apps/restart', async (req, res) => {
    const app = getAppByCwd(req.body.cwd)
    if (!app) {
      res.status(404).json({ error: 'App not found' })
      return
    }
    await restartApp(app)
    res.json({
      success: true,
    })
  })

  app.delete('/api/apps', async (req, res) => {
    const app = getAppByCwd(req.body.cwd)
    if (!app) {
      res.status(404).json({ error: 'App not found' })
      return
    }
    await removeApp(app)
    res.json({
      success: true,
    })
  })

  const server = http.createServer(app)
  server.listen(port, host, async () => {
    consola.info('Deamon server listening on', `${host}:${port}`)

    await restoreApps()

    if (portData) {
      await fs.writeJson(portFile, {
        ...portData,
        liveVersion: portData.requestVersion,
        port,
      })
    }  
  })

  server.on('upgrade', (req, socket, head) => {
    const host = req.get('host')
    if (host) {
      const proxy = getProxy(host)
      if (proxy) {
        consola.log(`${req.protocol}://${host}${req.path}`, chalk.cyan('PROXY'), proxy.targetDomain)
        proxy.wsMiddleware(req, socket, head)
        return
      }
    }
  })
}
