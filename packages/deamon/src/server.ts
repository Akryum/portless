import http from 'http'
import express from 'express'
import { getPortPromise } from 'portfinder'
import consola from 'consola'
import { updateGlobalConfig } from '@portless/util'

export async function startServer () {
  const port = await getPortPromise()
  await updateGlobalConfig({
    port,
  })

  const app = express()

  app.post('/api/stop', (req, res) => {
    res.json({ success: true })
    server.close()
    process.exit(0)
  })

  const server = http.createServer(app)
  server.listen(port, '0.0.0.0', () => {
    consola.success('Deamon server listening on', `0.0.0.0:${port}`)
  })
}
