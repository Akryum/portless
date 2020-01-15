export function getDomain (url: string): string {
  const result = /\w+:\/\/([\w.:_-]+)/.exec(url)
  if (result) {
    return result[1]
  }
  return ''
}

export function getParentLevelDomain (url: string): string {
  const result = /(\w+:\/\/)?((\d+\.\d+\.\d+\.\d+)|([\w:_-]+\.)?(([\w:_-]+\.)*([\w_-]+(\.\w+)?)))(:\d+)?/.exec(url)
  if (result) {
    return result[3] || result[5]
  }
  return ''
}

export function getWSUrl (url: string) {
  return url.replace(/^http/i, 'ws')
}
