import http, { IncomingMessage } from 'http'
import https from 'https'
import httpProxy from 'http-proxy'
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
import { getCertificates } from './pem'
import { tcpProxy } from './tcp-proxy'
import net from 'net'

const acmeChallengePath = '/.well-known/acme-challenge/'

// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

export async function startServer () {
  /** Exposes the actual port where the server is listening */
  const portFile = getRcFile('port.json')
  const portData = fs.existsSync(portFile) ? await fs.readJson(portFile) : null

  const config = await loadGlobalConfig()
  const port = await getPortPromise({
    port: config.port,
  })
  // @ts-ignore
  process.env.PORTLESS_DAEMON_PORT = port

  const host = config.host || 'localhost'
  // @ts-ignore
  process.env.PORTLESS_DAEMON_HOST = port

  // Listen on all interfaces if host is localhost
  const serverHost = host === 'localhost' ? '0.0.0.0' : host
  const serverUrl = `http://${serverHost}:${port}`
  // @ts-ignore
  process.env.PORTLESS_DAEMON_URL = serverUrl

  // Proxy for child processes
  process.env.HTTP_PROXY = `${process.env.PORTLESS_DAEMON_URL}/proxy.pac`
  // Exclude ngrok client
  process.env.NO_PROXY = '127.0.0.1'

  const app = express()

  app.use((req, res, next) => {
    const vhost = req.get('host')
    if (vhost && !vhost.endsWith(`:${port}`)) {
      const proxy = getProxy(vhost)
      if (proxy) {
        // Acme challenge to issue certificates
        if (proxy.publicKeyId && req.url && req.url.startsWith(acmeChallengePath)) {
          const id = req.url.substring(acmeChallengePath.length)
          consola.log('[greenlock]', chalk.green('Certificate ACME challenge', `${vhost}${req.url}`))
          res.write(`${id}.${proxy.publicKeyId}`)
          res.end()
          return
        }

        consola.log(`[proxy] ${req.protocol}://${vhost}${req.path}`, chalk.cyan('PROXY'), proxy.targetDomain)
        proxy.webMiddleware(req, res)
        return
      }

      // Host not found
      consola.error(`[server] VHost ${vhost} not found`)
      res.status(500)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(renderTemplate(path.resolve(__dirname, '../templates/vhost-not-found.ejs'), {
        host: vhost,
      }))
      res.end()
      return
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
    httpServer.close()
    process.exit(0)
  })

  app.post('/api/apps', async (req, res) => {
    let app = getAppByCwd(req.body.cwd)
    if (app) {
      consola.error('[server] App already exists', req.body.cwd)
      res.status(500).json({ error: 'App already exists' })
      return
    }
    app = await addApp(req.body.cwd)
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
      consola.error('[server] App not found', req.body.cwd)
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

  app.use((req, res) => {
    res.status(404)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(renderTemplate(path.resolve(__dirname, '../templates/error.ejs'), {
      errorMessage: 'Not found',
      errorStack: `${req.protocol}://${host}${req.path}`,
    }))
    res.end()
  })

  const httpServer = http.createServer(app)

  // Main network server

  httpServer.listen(port, serverHost, async () => {
    consola.info('[daemon] server listening on', serverUrl)

    await restoreApps()

    if (portData) {
      await fs.writeJson(portFile, {
        ...portData,
        liveVersion: portData.requestVersion,
        port,
      })
    }
  })

  httpServer.on('connect', (req: IncomingMessage, socket: net.Socket, head: any) => {
    const result = /([\w.:_-]+):(\d+)/.exec(req.url || req.headers.host || '')
    if (result) {
      if (result[2] === '443') {
        tcpProxy(socket, port + 1, head, req.url || req.headers.host || '')
        return
      }
    }
  })

  // Websocket
  httpServer.on('upgrade', (req: IncomingMessage, socket: net.Socket, head: any) => {
    const host = req.headers.host
    if (host) {
      const proxy = getProxy(host)
      if (proxy) {
        consola.log(`[proxy] ${host}${req.url}`, chalk.cyan('WEBSOCKET'), proxy.targetDomain)
        proxy.wsMiddleware(req, socket, head)
      }
    }
  })

  // HTTPS

  const certs = await getCertificates()

  const httpsProxy = httpProxy.createProxyServer({
    target: {
      host: serverHost,
      port,
    },
    ws: true,
    xfwd: true,
    ssl: certs,
  })

  httpsProxy.on('error', error => {
    consola.error('[https-proxy]', error.stack || error)
    consola.log(`[https-proxy] target: ${serverHost}:${port}`)
  })

  const httpsServer = https.createServer({
    ...certs,
  }, (req, res) => {
    httpsProxy.web(req, res)
  })

  httpsServer.on('upgrade', (req, socket, head) => {
    httpsProxy.ws(req, socket, head)
  })

  httpsServer.listen(port + 1, serverHost, () => {
    consola.info(`[https-proxy] Listening on port ${port + 1}`)
  })
}
