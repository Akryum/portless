#!/usr/bin/env node

import cac from 'cac'
import { serve } from '.'

const cli = cac()

cli.command('serve', 'Start HTTP proxy')
  .action(async () => {
    await serve()
  })

cli.help()

cli.parse()
