import selfsigned from 'selfsigned'
import fs from 'fs-extra'
import consola from 'consola'
import { getRcFile, rcFolder } from '@portless/util'

const keyFile = getRcFile('key.pem')
const certFile = getRcFile('cert.pem')

export async function getCertificates () {
  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    consola.info(`[pem] Reading self-signed certificate in ${rcFolder}`)
    return {
      key: await fs.readFile(keyFile, 'utf-8'),
      cert: await fs.readFile(certFile, 'utf-8'),
    }
  } else {
    consola.info(`[pem] Generating self-signed certificate in ${rcFolder}`)
    const pems = selfsigned.generate([{ name: 'commonName', value: 'portless' }], {
      days: 365,
    })
    await fs.writeFile(keyFile, pems.private, 'utf-8')
    await fs.writeFile(certFile, pems.cert, 'utf-8')

    return { key: pems.private, cert: pems.cert }
  }
}
