export function getDomain (url: string) {
  const [, domain] = /\w+:\/\/([\w._-]+)/.exec(url) || []
  return domain
}

export function getWSUrl (url: string) {
  return url.replace(/^http/i, 'ws')
}
