#!/usr/bin/env node

import cac from 'cac'
import updateCheck from 'update-check'
import consola from 'consola'
import { startDaemon, stopDaemon } from './daemon'
import { addApp, removeApp, restartApp } from './app'
import { tailLogs } from './logs.js'

process.env.NODE_ENV = 'production'

const pkg = require('../package.json')

const cli = cac()

cli.command('start', 'Start Daemon')
  .action(async () => {
    await startDaemon()
  })

cli.command('start-inline', 'Start server directly (no-daemon)')
  .action(async () => {
    await stopDaemon()
    require('./start-server')
  })

cli.command('stop', 'Stop Daemon')
  .action(async () => {
    await stopDaemon()
  })

cli.command('restart', 'Restart Daemon')
  .action(async () => {
    await startDaemon()
    await stopDaemon()
  })

cli.command('add', 'Add project in current folder')
  .action(async () => {
    await addApp(process.cwd())
  })

cli.command('remove', 'Remove project in current folder')
  .action(async () => {
    await removeApp(process.cwd())
  })

cli.command('refresh', 'Restart project in current folder')
  .action(async () => {
    await restartApp(process.cwd())
  })

cli.command('logs', 'Display the daemon logs and watch for new log messages')
  .action(() => {
    tailLogs()
  })

cli.help()
cli.version(pkg.version)
cli.parse()

// Check for updates
updateCheck(pkg).then((update) => {
  if (update) {
    consola.info(`[cli] Update available: ${update.latest} (current: ${pkg.version})\nRun \`npm i -g ${pkg.name}\`, \`yarn global add ${pkg.name}\`, or \`pnpm i -g ${pkg.name}\` to update`)
  }
}).catch(e => {
  // noop
})
