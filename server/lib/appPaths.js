import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const serverDir = path.resolve(__dirname, '..')
export const projectRoot = path.resolve(serverDir, '..')
export const publicDir = path.join(projectRoot, 'public')

const dataDir = process.env.MOUNTLAB_DATA_DIR
  ? path.resolve(process.env.MOUNTLAB_DATA_DIR)
  : null
const resourcesDir = process.env.MOUNTLAB_RESOURCES_DIR
  ? path.resolve(process.env.MOUNTLAB_RESOURCES_DIR)
  : null

export const appDataDir = dataDir
export const savedProjectsRoot = dataDir
  ? path.join(dataDir, 'projects')
  : path.join(publicDir, 'projects')
export const workspaceRoot = dataDir
  ? path.join(dataDir, 'workspaces')
  : path.join(os.tmpdir(), 'mountlab-workspaces')
export const convertedDir = dataDir
  ? path.join(dataDir, 'cache', 'converted')
  : path.join(serverDir, 'converted')
export const positionsPath = dataDir
  ? path.join(dataDir, 'positions.json')
  : path.join(serverDir, 'positions.json')

export function resourcePath(...segments) {
  return resourcesDir
    ? path.join(resourcesDir, ...segments)
    : path.join(projectRoot, ...segments)
}

export function serverScriptPath(scriptName) {
  return resourcesDir
    ? resourcePath('server', scriptName)
    : path.join(serverDir, scriptName)
}

export function isInside(parent, child) {
  const relativePath = path.relative(parent, child)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}
