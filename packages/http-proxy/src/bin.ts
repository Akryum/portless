#!/usr/bin/env node

import cac from 'cac'
import { startProxy } from '.'

const cli = cac()

cli.command('start', 'Start HTTP proxy')
  .action(async () => {
    await startProxy()
  })

cli.help()

cli.parse()