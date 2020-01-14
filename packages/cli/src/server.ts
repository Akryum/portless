import { post } from './rest'

export { startServer } from '@portless/deamon'

export async function stopServer () {
  await post('/api/stop')
}
