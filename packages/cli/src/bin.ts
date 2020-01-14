#!/usr/bin/env node

import cac from 'cac'
import { startServer, stopServer } from './server'

const cli = cac()

cli.command('start', 'Start Deamon')
  .action(async () => {
    await startServer()
  })

cli.command('stop', 'Stop Deamon')
  .action(async () => {
    await stopServer()
  })

cli.help()
cli.version(require('../package.json').version)
cli.parse()
