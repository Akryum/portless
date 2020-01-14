import { loadGlobalConfig } from '@portless/util'
import fetch, { RequestInit } from 'node-fetch'

export async function rest (method: string, url: string, options: RequestInit = {}) {
  const config = await loadGlobalConfig()
  const result = await fetch(`http://localhost:${config.port}${url}`, {
    method,
    ...options,
  })
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

export async function del (url: string) {
  return rest('DELETE', url)
}
