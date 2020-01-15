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

export type IncomingDomainType = 'public' | 'local'

export interface ReverseProxy {
  targetDomain: string
  incomingDomains: { domain: string, type: IncomingDomainType }[]
  webMiddleware: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
  wsMiddleware: (req: IncomingMessage, socker: any, head: any) => Promise<void> | void
}

const proxies: ReverseProxy[] = []
const domainMap: { [key: string]: ReverseProxy } = {}

class Replacer {
  regValues: string[] = []
  reg: RegExp
  map: { [key: string]: string } = {}

  add (fromUrl: string, toUrl: string) {
    this.regValues.push(escapeReg(fromUrl))
    this.map[fromUrl] = toUrl
  }

  build () {
    this.reg = new RegExp(`(${this.regValues.join('|')})`, 'g')
  }

  replace (text: string) {
    return text.replace(this.reg, (matched) => this.map[matched])
  }
}

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
      consola.error(`Error proxying ${req.url}:`)
      consola.log(err.stack)
    })

    // Rewrite URL in responses
    const targetToPublic: Replacer = new Replacer()
    const publicToTarget: Replacer = new Replacer()
    const targetToLocal: Replacer = new Replacer()
    const localToTarget: Replacer = new Replacer()
    if (config.domains) {
      for (const domainConfig of config.domains) {
        // Replace urls
        if (domainConfig.public) {
          targetToPublic.add(domainConfig.target, domainConfig.public)
          publicToTarget.add(domainConfig.public, domainConfig.target)
          // Spacial syntax
          targetToPublic.add(`${domainConfig.id}.portless`, domainConfig.public)
        }
        if (domainConfig.local) {
          targetToLocal.add(domainConfig.target, domainConfig.local)
          localToTarget.add(domainConfig.local, domainConfig.target)
          // Spacial syntax
          targetToLocal.add(`${domainConfig.id}.portless`, domainConfig.local)
        }
      }
    }
    targetToPublic.build()
    publicToTarget.build()
    targetToLocal.build()
    localToTarget.build()

    function getDomainType (req: IncomingMessage) {
      const host = req.headers.host
      if (host) {
        const incomingDomain = proxyInfo.incomingDomains.find(d => d.domain === host)
        if (incomingDomain) {
          return incomingDomain.type
        }
      }
    }

    function getReplacer (req: IncomingMessage, publicReplacer: Replacer, localReplacer: Replacer) {
      const domainType = getDomainType(req)
      if (domainType === 'public') {
        return publicReplacer
      } else if (domainType === 'local') {
        return localReplacer
      }
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

      // Replace links
      const replacer = getReplacer(req, targetToPublic, targetToLocal)

      if (replacer) {
        // @TODO shouldRewrite was removed because `writeHead` is called after writting for some reason
        const _writeHead = res.writeHead.bind(res)
        res.writeHead = (...args: any) => {
          const headers = (args.length > 2) ? args[2] : args[1]

          // R<emove content-length heander since it will change
          res.removeHeader('content-length')
          if (headers) {
            delete headers['content-length']
          }

          // Replace CORS header
          const corsHeader = res.getHeader('access-control-allow-origin')
          if (corsHeader && typeof corsHeader === 'string') {
            res.setHeader('access-control-allow-origin', replacer.replace(corsHeader))
          }
          if (headers && headers['access-control-allow-origin']) {
            headers['access-control-allow-origin'] = replacer.replace(headers['access-control-allow-origin'])
          }

          return _writeHead(...args)
        }

        let rawBody: string = ''
        const _write = res.write.bind(res)
        res.write = (data: string | Buffer) => {
          let text: string
          if (data instanceof Buffer) {
            text = data.toString()
          } else {
            text = data
          }
          rawBody += text
          return true
        }

        const _end = res.end.bind(res)
        res.end = () => {
          _write(replacer.replace(rawBody))
          _end()
        }
      }

      // Proxy HTTP
      proxy.web(req, res)
    }

    const wsMiddleware = (req: IncomingMessage, socket: any, head: any) => {
      const replacer = getReplacer(req, publicToTarget, localToTarget)

      if (replacer) {
        if (req.headers.host) {
          req.headers.host = replacer.replace(req.headers.host)
        }
        if (Array.isArray(req.headers.origin)) {
          req.headers.origin = req.headers.origin.map(value => replacer.replace(value))
        } else if (req.headers.origin) {
          req.headers.origin = replacer.replace(req.headers.origin)
        }
      }

      // Proxy websockets
      proxy.ws(req, socket, head)
    }

    const proxyInfo: ReverseProxy = {
      targetDomain,
      incomingDomains: [],
      webMiddleware,
      wsMiddleware,
    }
    currentProxies.push(proxyInfo)
    proxies.push(proxyInfo)
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
    const incoming = { public: domainConfig.public, local: domainConfig.local }
    for (const key in incoming) {
      const type: IncomingDomainType = key as keyof typeof incoming
      const domain = incoming[type]
      if (domain) {
        if (domainMap[domain]) {
          consola.error(`Domain ${domain} is already mapped to a Proxy`)
        } else {
          domainMap[domain] = proxy
          proxy.incomingDomains.push({ domain, type })
          consola.log(chalk.cyan('PROXY'), chalk.bold(domain), '⇒', chalk.blue.bold(domainConfig.target))
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
      for (const incomingDomain of proxy.incomingDomains) {
        delete domainMap[incomingDomain.domain]
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
