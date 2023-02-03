import startup from 'user-startup'
import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'
import { get, post } from './rest'
import { getRcFile, wait } from '@portless/util'
import { loadGlobalConfig } from '@portless/global-config'

const portFile = getRcFile('port.json')

// Start daemon in background
export async function startDaemon () {
  let requestVersion: string | undefined
  const config = await loadGlobalConfig()

  const host = config.host || 'localhost'
  let port = config.port

  if (!checkServerIsLive(port, host)) {
    requestVersion = `${Date.now()}.${Math.round(Math.random() * 10000)}`
    await fs.writeJson(portFile, {
      requestVersion,
    })
  }

  // Start script and register on user session login
  const node = process.execPath
  const daemonFile = path.join(__dirname, './start-server')
  startup.create('portless', node, [daemonFile], getRcFile('daemon.log'))

  if (requestVersion) {
    port = await checkPortFile(requestVersion)
  }

  consola.info(`[cli] Started http://${host}:${port}`)
}

// Stop daemon
export async function stopDaemon () {
  try {
    await post('/api/stop')
  } catch (e) {
    consola.warn('[cli] Daemon server doesn\'t seem to be live')
  }
  startup.remove('portless')
  consola.info('[cli] Stopped')
}

async function checkServerIsLive (port: number, host: string) {
  try {
    const data = await get('/.well-known/status')
    return data && data.status === 'live'
  } catch (e) {
    return false
  }
}

async function checkPortFile (requestVersion: string): Promise<number> {
  if (fs.existsSync(portFile)) {
    const portData = await fs.readJson(portFile)
    if (portData && portData.liveVersion === requestVersion) {
      return portData.port
    }
  }
  await wait(100)
  return checkPortFile(requestVersion)
}
