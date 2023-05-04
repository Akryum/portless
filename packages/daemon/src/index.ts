import dns from 'dns'
// https://github.com/nodejs/node/issues/40702
// @ts-expect-error node 18
dns.setDefaultResultOrder?.('ipv4first')

export * from './server'
