import { getRcFile } from '@portless/util'
import { Tail } from 'tail'
import consola from 'consola'
import fs from 'fs-extra'

export function tailLogs () {
  const logFile = getRcFile('daemon.log')
  consola.info(`[cli] Tailing ${logFile}...`)
  console.log(fs.readFileSync(logFile, 'utf8'))
  const t = new Tail(logFile)
  t.on('line', (data: string) => {
    console.log(data)
  })
  t.on('error', (error: string) => {
    console.error(error)
  })
}
