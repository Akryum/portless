import http from 'http'
import express from 'express'
import bodyParser from 'body-parser'
import { getPortPromise } from 'portfinder'
import consola from 'consola'
import { loadGlobalConfig } from '@portless/global-config'
import { addApp, stopAllApps, restartApp, getAppByCwd, removeApp, restoreApps } from './app'

export async function startServer () {
  const config = await loadGlobalConfig()
  const port = await getPortPromise({
    port: config.port,
  })

  const app = express()

  app.use(bodyParser.json())

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
  const host = config.host || '0.0.0.0'
  server.listen(port, host, async () => {
    consola.info('Deamon server listening on', `${host}:${port}`)

    await restoreApps()
  })
}
