import httpProxy from 'http-proxy'
import PacProxyAgent from 'pac-proxy-agent'
import consola from 'consola'
import path from 'path'
import { renderTemplate } from '@portless/template'

// fix ssl localhost
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const pacProxyAgent = new PacProxyAgent('http://localhost:2000/proxy.pac')

export function proxyTarget (port: number, target: string) {
  const [, domain] = /\w+:\/\/([\w._-]+)/.exec(target) || []
  const server = httpProxy.createProxyServer({
    target,
    agent: pacProxyAgent,
    changeOrigin: true,
    secure: false,
    cookieDomainRewrite: domain,
  })

  server.on('error', (err, req, res) => {
    res.writeHead(500, {
      ContentType: 'text/html; charset=utf-8',
    })
    let errorMessage = err.message
    if (errorMessage.startsWith('getaddrinfo ENOTFOUND')) {
      errorMessage = `Can't find host <b>${errorMessage.substr('getaddrinfo ENOTFOUND'.length + 1)}</b>`
    }

    res.end(renderTemplate(path.resolve(__dirname, '../templates/error.ejs'), {
      errorMessage,
      errorStack: err.stack,
    }))
    consola.error(err.stack)
  })

  server.listen(port)
  consola.success(port, '=>', target)
}
