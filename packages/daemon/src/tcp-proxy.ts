import net, { Socket } from 'net'
import consola from 'consola'

export function tcpProxy (source: Socket, targetPort: number, head: any, url: string) {
  const target = net.connect(targetPort)

  const handleError = (err: Error, owner: string) => {
    consola.error(`[tcp-proxy] Error ${owner}:`, url, targetPort, err)
    source.destroy()
    target.destroy()
  }

  source.on('error', (err) => {
    handleError(err, 'source')
  })
  target.on('error', (err) => {
    handleError(err, 'target')
  })

  source.write(
    'HTTP/1.1 200 Connection Established\r\n' +
    'Proxy-agent: Portless\r\n' +
    '\r\n',
  )
  target.write(head)

  source.pipe(target)
  target.pipe(source)

  return target
}
