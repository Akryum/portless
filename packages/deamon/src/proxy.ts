import { IncomingMessage, ServerResponse } from 'http'
import httpProxy from 'http-proxy'
import PacProxyAgent from 'pac-proxy-agent'
import consola from 'consola'
import chalk from 'chalk'
import path from 'path'
import { renderTemplate } from '@portless/template'
import { PortlessConfig } from '@portless/config'
import { escapeReg, ThenType } from '@portless/util'

const acmeChallengePath = '/.well-known/acme-challenge/'

export interface ReverseProxyOptions {
  publicKeyId?: string
}

export type PublicUrlCallback = (targetUrl: string, publicUrl: string) => void

export interface ReverseProxy {
  targetDomain: string
  incomingDomains: string[]
  webMiddleware: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
  wsMiddleware: (req: IncomingMessage, socker: any, head: any) => Promise<void> | void
}

const proxies: ReverseProxy[] = []
const domainMap: { [key: string]: ReverseProxy } = {}

export async function useReverseProxy (config: PortlessConfig, options: ReverseProxyOptions = {}) {
  if (!config.domains) return null

  const pacProxyAgent = config.targetProxy ? new PacProxyAgent(config.targetProxy) : undefined

  const currentProxies: ReverseProxy[] = []

  async function proxyTarget (targetDomain: string) {
    if (proxies.some(p => p.targetDomain === targetDomain)) {
      consola.error(`A proxy targetting ${targetDomain} is already defined`)
      return
    }
      
    const proxy = httpProxy.createProxyServer({
      target: `http://${targetDomain}`,
      agent: pacProxyAgent,
      changeOrigin: true,
      secure: false,
      cookieDomainRewrite: {
        // Remove cookie domains
        '*': '',
      },
      ws: true,
    })

    proxy.on('error', (err, req, res) => {
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

    // Rewrite URL in responses
    let replaceReg: RegExp
    let replaceMap: { [key: string]: string }
    let replaceFunc: (matched: string) => string
    let reverseReplaceReg: RegExp
    let reverseReplaceMap: { [key: string]: string }
    let reverseReplaceFunc: (matched: string) => string
    if (config.domains) {
      replaceMap = {}
      reverseReplaceMap = {}
      const escapedUrls: string[] = []
      const reverseEcapedUrls: string[] = []
      for (const domainConfig of config.domains) {
        const targetDomain = domainConfig.target
        if (domainConfig.public) {
          const publicDomain = domainConfig.public
          replaceMap[targetDomain] = publicDomain
          escapedUrls.push(escapeReg(targetDomain))
          reverseReplaceMap[publicDomain] = targetDomain
          reverseEcapedUrls.push(escapeReg(publicDomain))
        }
      }
      replaceReg = new RegExp(`(${escapedUrls.join('|')})`, 'g')
      replaceFunc = (matched: string) => replaceMap[matched]
      reverseReplaceReg = new RegExp(`(${reverseEcapedUrls.join('|')})`, 'g')
      reverseReplaceFunc = (matched: string) => reverseReplaceMap[matched]
    }

    const webMiddleware = (req: IncomingMessage, res: ServerResponse) => {
      // Acme challenge to issue certificates
      if (options.publicKeyId) {
        if (req.url && req.url.startsWith(acmeChallengePath)) {
          const id = req.url.substr(acmeChallengePath.length)
          res.write(`${id}.${options.publicKeyId}`)
          res.end()
          return
        }
      }

      if (replaceReg) {
        let shouldRewrite = false

        // Rewrite links
        const _writeHead = res.writeHead.bind(res)
        res.writeHead = (...args: any) => {
          const headers = (args.length > 2) ? args[2] : args[1]

          // Check content type to enable rewriting
          const contentType = res.getHeader('content-type') || (headers ? headers['content-type'] : undefined)
          shouldRewrite = contentType && [
            'text/html',
            'text/css',
            'application/javascript',
          ].some(type => contentType.includes(type))

          if (shouldRewrite) {
            // Remove content-length heander since it will change
            res.removeHeader('content-length')
            if (headers) {
              delete headers['content-length']
            }
          }

          // Replace CORS header
          const corsHeader = res.getHeader('access-control-allow-origin')
          if (corsHeader && typeof corsHeader === 'string') {
            res.setHeader('access-control-allow-origin', corsHeader.replace(replaceReg, replaceFunc))
          }
          if (headers && headers['access-control-allow-origin']) {
            headers['access-control-allow-origin'] = headers['access-control-allow-origin'].replace(replaceReg, replaceFunc)
          }

          return _writeHead(...args)
        }

        const _write = res.write.bind(res)
        res.write = (data: string | Buffer) => {
          if (shouldRewrite) {
            let text: string
            if (data instanceof Buffer) {
              text = data.toString()
            } else {
              text = data
            }
            const newText = text.replace(replaceReg, replaceFunc)
            return _write(newText)
          } else {
            return _write(data)
          }
        }

        const _end = res.end.bind(res)
        res.end = () => {
          _end()
        }
      }

      // Proxy HTTP
      proxy.web(req, res)
    }

    const wsMiddleware = (req: IncomingMessage, socket: any, head: any) => {
      if (req.headers.host) {
        req.headers.host = req.headers.host.replace(reverseReplaceReg, reverseReplaceFunc)
      }
      if (Array.isArray(req.headers.origin)) {
        req.headers.origin = req.headers.origin.map(value => value.replace(reverseReplaceReg, reverseReplaceFunc))
      } else if (req.headers.origin) {
        req.headers.origin = req.headers.origin.replace(reverseReplaceReg, reverseReplaceFunc)
      }

      // Proxy websockets
      proxy.ws(req, socket, head)
    }

    const proxyObj: ReverseProxy = {
      targetDomain,
      incomingDomains: [],
      webMiddleware,
      wsMiddleware,
    }
    currentProxies.push(proxyObj)
    proxies.push(proxyObj)
  }

  // Dedupe target urls
  const targetDomains = Array.from(new Set(config.domains.map(d => d.target)))

  // Create proxies
  for (const domain of targetDomains) {
    await proxyTarget(domain)
  }

  // Map Urls
  for (const domainConfig of config.domains) {
    const proxy = proxies.find(p => p.targetDomain === domainConfig.target)
    if (!proxy) {
      consola.error(`Proxy with target ${domainConfig.target} not found`)
      continue
    }
    for (const url of [domainConfig.public, domainConfig.local]) {
      if (url) {
        if (domainMap[url]) {
          consola.error(`Domain ${url} is already mapped to a Proxy`)
        } else {
          domainMap[url] = proxy
          proxy.incomingDomains.push(url)
          consola.log(chalk.cyan('PROXY'), chalk.bold(url), '⇒', chalk.blue.bold(domainConfig.target))
        }
      }
    }
  }

  function destroy () {
    // Remove current app proxies
    for (const proxy of currentProxies) {
      const index = proxies.indexOf(proxy)
      if (index !== -1) {
        proxies.splice(index, 1)
      }
      for (const incomingUrl of proxy.incomingDomains) {
        delete domainMap[incomingUrl]
      }
    }
  }

  return {
    destroy,
  }
}

export type UseReverseProxy = ThenType<typeof useReverseProxy>

export function getProxy (incoming: string): ReverseProxy | null {
  return domainMap[incoming]
}
