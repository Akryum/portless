import fs from 'fs-extra'
import os from 'os'
import path from 'path'

export const rcFolder = path.resolve(os.homedir(), '.portless')
fs.ensureDirSync(rcFolder)

export function getRcFile (file: string) {
  return path.resolve(rcFolder, file)
}
export function getRcFolder (folder: string) {
  const folderPath = path.resolve(rcFolder, folder)
  fs.ensureDirSync(folderPath)
  return folderPath
}
