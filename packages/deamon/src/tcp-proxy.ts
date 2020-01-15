import net, { Socket } from 'net'
import consola from 'consola'

export function proxy (source: Socket, targetPort: number) {
  const target = net.connect(targetPort)
  source.pipe(target).pipe(source)

  const handleError = (err: Error) => {
    consola.error('TCP Proxy - Error', err)
    source.destroy()
    target.destroy()
  }

  source.on('error', handleError)
  target.on('error', handleError)

  source.write(
    'HTTP/1.1 200 Connection Established\r\n' +
    'Proxy-agent: Portless\r\n' +
    '\r\n'
  )

  return target
}
