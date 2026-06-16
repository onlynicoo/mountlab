import fs from 'node:fs/promises'
import path from 'node:path'
import { httpError } from './errors.js'

const MODEL_EXTENSIONS = new Map([
  ['.stl', 'stl'],
  ['.gltf', 'gltf'],
  ['.glb', 'glb'],
  ['.step', 'step'],
  ['.stp', 'step'],
])

const CONTENT_TYPES = {
  stl: 'model/stl',
  gltf: 'model/gltf+json',
  glb: 'model/gltf-binary',
}

const allowedDirs = (process.env.ALLOWED_DIRS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => path.resolve(entry))

function hasTraversalSegment(rawPath) {
  return rawPath.split(/[\\/]+/).includes('..')
}

function isInsideAllowedDir(filePath) {
  if (allowedDirs.length === 0) return true

  return allowedDirs.some((allowedDir) => {
    const relativePath = path.relative(allowedDir, filePath)
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  })
}

export function getModelType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  return MODEL_EXTENSIONS.get(extension)
}

export function getContentType(type) {
  return CONTENT_TYPES[type] || 'application/octet-stream'
}

export function modelUrlFor(filePath, type) {
  const params = new URLSearchParams({
    path: filePath,
    type,
  })

  return `/api/model?${params.toString()}`
}

export async function validateModelPath(rawPath) {
  if (typeof rawPath !== 'string' || rawPath.trim() === '') {
    throw httpError(400, 'A non-empty absolute path is required.')
  }

  if (rawPath.includes('\0')) {
    throw httpError(400, 'Path contains an invalid null byte.')
  }

  if (!path.isAbsolute(rawPath)) {
    throw httpError(400, 'Only absolute local filesystem paths are accepted.')
  }

  if (hasTraversalSegment(rawPath)) {
    throw httpError(400, 'Path traversal segments are not allowed.')
  }

  const filePath = path.resolve(rawPath)

  if (!isInsideAllowedDir(filePath)) {
    throw httpError(403, 'Path is outside ALLOWED_DIRS.')
  }

  const type = getModelType(filePath)
  if (!type) {
    throw httpError(415, 'Unsupported model format. Use STL, GLTF, GLB, STEP, or STP.')
  }

  let stat
  try {
    stat = await fs.stat(filePath)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw httpError(404, `File not found: ${filePath}`)
    }
    throw error
  }

  if (!stat.isFile()) {
    throw httpError(400, 'Path must point to a file.')
  }

  return { filePath, type, stat }
}
