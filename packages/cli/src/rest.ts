import { loadGlobalConfig } from '@portless/global-config'
import fetch, { RequestInit } from 'node-fetch'
import consola from 'consola'

export async function rest (method: string, url: string, options: RequestInit = {}) {
  const config = await loadGlobalConfig()
  const body = options.body ? JSON.stringify(options.body) : undefined
  const result = await fetch(`http://${config.host || 'localhost'}:${config.port}${url}`, {
    method,
    ...options,
    body,
    headers: {
      'content-type': 'application/json',
    },
  })
  if (!result.ok) {
    const { error } = await result.json()
    consola.error(error)
    return
  }
  return result.json()
}

export async function get (url: string) {
  return rest('GET', url)
}

export async function post (url: string, data: any = null) {
  return rest('POST', url, {
    body: data,
  })
}

export async function put (url: string, data: any = null) {
  return rest('PUT', url, {
    body: data,
  })
}

export async function patch (url: string, data: any = null) {
  return rest('PATCH', url, {
    body: data,
  })
}

export async function del (url: string, data: any = null) {
  return rest('DELETE', url, {
    body: data,
  })
}
