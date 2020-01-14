export function getDomain (url: string): string {
  const result = /\w+:\/\/([\w._-]+)/.exec(url)
  if (result) {
    return result[1]
  }
  return ''
}

export function getWSUrl (url: string) {
  return url.replace(/^http/i, 'ws')
}
