import { post, del } from './rest'

export async function addApp (cwd: string) {
  return post('/api/apps', {
    cwd,
  })
}

export async function removeApp (cwd: string) {
  return del('/api/apps', {
    cwd,
  })
}

export async function restartApp (cwd: string) {
  return post('/api/apps/restart', {
    cwd,
  })
}
