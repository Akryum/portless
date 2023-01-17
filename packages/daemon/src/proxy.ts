import { IncomingMessage, ServerResponse } from 'http'
import httpProxy from 'http-proxy'
import PacProxyAgent from 'pac-proxy-agent'
import consola from 'consola'
import chalk from 'chalk'
import path from 'path'
import { renderTemplate } from '@portless/template'
import { PortlessConfig } from '@portless/config'
import { escapeReg, ThenType, getParentLevelDomain } from '@portless/util'

export interface ReverseProxyOptions {
  publicKeyId?: string
}

export type IncomingDomainType = 'public' | 'local'

export interface ReverseProxy {
  publicKeyId?: string
  targetDomain: string
  incomingDomains: { domain: string, type: IncomingDomainType }[]
  webMiddleware: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
  wsMiddleware: (req: IncomingMessage, socker: any, head: any) => Promise<void> | void
}

const proxies: ReverseProxy[] = []
const domainMap: { [key: string]: ReverseProxy } = {}

const noReplaceReg = /\.(png|jpe?g|gif|webp|svg|mp4|webm|ogg|mp3|wav|flac|aac|woff2?|eot|ttf|otf)/

const forceHttpsMap: { [key: string]: boolean } = {}

type UrlMap = { [key: string]: string[] }

class Replacer {
  regValues: string[] = []
  reg: RegExp
  map: UrlMap = {}

  add (fromUrl: string, toUrl: string) {
    this.regValues.push(escapeReg(fromUrl))
    const mapUrls = this.map[fromUrl] = this.map[fromUrl] || []
    mapUrls.push(toUrl)
  }

  build () {
    const dedupedValues = Array.from(new Set(this.regValues))
    this.reg = new RegExp(`((http|ws)s?://)?(${dedupedValues.join('|')})`, 'g')
  }

  getReplace (req: IncomingMessage) {
    if (!this.reg) this.build()

    const secure = isSecure(req)

    // Put req host first (it has priority)
    const map: UrlMap = {}
    for (const key in this.map) {
      const list = this.map[key].slice()
      if (req.headers.host) {
        const index = list.indexOf(req.headers.host)
        if (index !== -1) {
          list.splice(index, 1)
          list.unshift(req.headers.host)
        }
      }
      map[key] = list
    }

    const replaceFn = (matched: string, g1: string, g2: string, g3: string) => {
      const proto = g1 ? `${g2}${secure ? 's' : ''}://` : ''
      return `${proto}${map[g3][0]}`
    }
    return (text: string) => text.replace(this.reg, replaceFn)
  }
}

export async function useReverseProxy (config: PortlessConfig, options: ReverseProxyOptions = {}) {
  if (!config.domains) return null

  const pacProxyAgent = config.targetProxy ? new PacProxyAgent(config.targetProxy) : undefined

  const currentProxies: ReverseProxy[] = []

  async function proxyTarget (targetDomain: string) {
    if (proxies.some(p => p.targetDomain === targetDomain)) {
      consola.error(`A proxy targeting ${targetDomain} is already defined`)
      return
    }

    const proxy = httpProxy.createProxyServer({
      target: `http://${targetDomain}`,
      agent: pacProxyAgent,
      changeOrigin: true,
      secure: false,
      ws: true,
      xfwd: true,
    })

    proxy.on('error', (err, req, res) => {
      try {
        res.writeHead(500, {
          ContentType: 'text/html; charset=utf-8',
        })
        let errorMessage = err.message
        if (errorMessage.startsWith('getaddrinfo ENOTFOUND')) {
          errorMessage = `Can't find host <b>${errorMessage.substr('getaddrinfo ENOTFOUND'.length + 1)}</b>`
        }

        res.write(renderTemplate(path.resolve(__dirname, '../templates/error.ejs'), {
          errorMessage,
          errorStack: err.stack,
        }))
        res.end()
      } catch (e) {
        consola.error(e)
      }
      consola.error(`Error proxying ${req.url}:`)
      consola.log(err.stack)
    })

    // Rewrite URL in responses
    const targetToPublic: Replacer = new Replacer()
    const cookieTargetToPublic: Replacer = new Replacer()
    const publicToTarget: Replacer = new Replacer()
    const targetToLocal: Replacer = new Replacer()
    const cookieTargetToLocal: Replacer = new Replacer()
    const localToTarget: Replacer = new Replacer()
    if (config.domains) {
      for (const domainConfig of config.domains) {
        // Replace urls
        if (domainConfig.public) {
          targetToPublic.add(domainConfig.target, domainConfig.public)
          if (domainConfig.local) { 
            targetToPublic.add(domainConfig.local, domainConfig.public)
          }
          publicToTarget.add(domainConfig.public, domainConfig.target)
          // Cookie domains
          cookieTargetToPublic.add(
            `.${getParentLevelDomain(domainConfig.target)}`,
            `.${getParentLevelDomain(domainConfig.public)}`,
          )
          // Spacial syntax
          targetToPublic.add(`${domainConfig.id}.portless`, domainConfig.public)
        }
        if (domainConfig.local) {
          targetToLocal.add(domainConfig.target, domainConfig.local)
          localToTarget.add(domainConfig.local, domainConfig.target)
          // Cookie domains
          cookieTargetToLocal.add(
            `.${getParentLevelDomain(domainConfig.target)}`,
            `.${getParentLevelDomain(domainConfig.local)}`,
          )
          // Spacial syntax
          targetToLocal.add(`${domainConfig.id}.portless`, domainConfig.local)
        }
      }
    }

    function getIncomingDomain (req: IncomingMessage) {
      const host = req.headers.host
      if (host) {
        const incomingDomain = proxyInfo.incomingDomains.find(d => d.domain === host)
        if (incomingDomain) {
          return incomingDomain
        }
      }
    }

    function getReplacer (req: IncomingMessage, publicReplacer: Replacer, localReplacer: Replacer) {
      const url = req.url
      if (url && url.match(noReplaceReg)) {
        return
      }

      const domain = getIncomingDomain(req)
      if (domain) {
        if (domain.type === 'public') {
          return publicReplacer
        } else if (domain.type === 'local') {
          return localReplacer
        }
      }
    }

    const webMiddleware = (req: IncomingMessage, res: ServerResponse) => {
      // Replace links
      const replacer = getReplacer(req, targetToPublic, targetToLocal)
      const cookieReplacer = getReplacer(req, cookieTargetToPublic, cookieTargetToLocal)

      if (replacer && cookieReplacer) {
        // @TODO shouldRewrite was removed because `writeHead` is called after writting for some reason

        const replace = replacer.getReplace(req)
        const replaceCookie = cookieReplacer.getReplace(req)

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
            res.setHeader('access-control-allow-origin', replace(corsHeader))
          }
          if (headers && headers['access-control-allow-origin']) {
            headers['access-control-allow-origin'] = replace(headers['access-control-allow-origin'])
          }

          // Rewrite cookies
          let setCookie: string[] = res.getHeader('set-cookie') as string[]
          if (setCookie) {
            res.setHeader('set-cookie', setCookie.map(cookie => replaceCookie(cookie)))
          }
          setCookie = headers && headers['set-cookie']
          if (setCookie) {
            headers['set-cookie'] = setCookie.map(cookie => replaceCookie(cookie))
          }

          return _writeHead(...args)
        }

        let rawBody = ''
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
          _write(replace(rawBody))
          _end()
        }
      }

      // Proxy HTTP
      proxy.web(req, res)
    }

    const wsMiddleware = (req: IncomingMessage, socket: any, head: any) => {
      const replacer = getReplacer(req, publicToTarget, localToTarget)

      if (replacer) {
        const replace = replacer.getReplace(req)

        if (req.headers.host) {
          req.headers.host = replace(req.headers.host)
        }

        if (Array.isArray(req.headers.origin)) {
          // @ts-ignore
          req.headers.origin = req.headers.origin.map(value => replace(value))
        } else if (req.headers.origin) {
          req.headers.origin = replace(req.headers.origin)
        }
      }

      // Proxy websockets
      proxy.ws(req, socket, head)
    }

    const proxyInfo: ReverseProxy = {
      publicKeyId: options.publicKeyId,
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

function isSecure (req: IncomingMessage) {
  if (forceHttpsMap[req.headers.host || '']) {
    return true
  }
  const proto = req.headers['x-forwarded-proto']
  return proto === 'https' || proto === 'wss'
}

export function forceHttps (domain: string, https: boolean) {
  forceHttpsMap[domain] = https
}
