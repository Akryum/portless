import template from 'lodash/template'
import fs from 'fs'

export function renderTemplate (path: string, variables: any) {
  const templateString = fs.readFileSync(path, { encoding: 'utf8' })
  const compiled = template(templateString)
  return compiled(variables)
}
