#!/usr/bin/env node

import cac from 'cac'
import { startDaemon, stopDaemon } from './daemon'
import { addApp, removeApp, restartApp } from './app'

process.env.NODE_ENV = 'production'

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

cli.help()
cli.version(require('../package.json').version)
cli.parse()
