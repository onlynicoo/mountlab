import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { httpError } from './errors.js'
import { getModelType, validateModelPath } from './paths.js'
import {
  isInside,
  publicDir,
  savedProjectsRoot,
  serverScriptPath,
} from './appPaths.js'

const drillScript = serverScriptPath('drill.py')
const defaultFreeCadCommands = [
  process.env.FREECAD_CMD,
  'C:\\Program Files\\FreeCAD 1.0\\bin\\FreeCADCmd.exe',
  'C:\\Program Files\\FreeCAD 0.21\\bin\\FreeCADCmd.exe',
  'C:\\Program Files\\FreeCAD 0.20\\bin\\FreeCADCmd.exe',
  '/Applications/FreeCAD.app/Contents/Resources/bin/python',
  'FreeCADCmd',
  'freecadcmd',
  '/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd',
  '/Applications/FreeCAD.app/Contents/MacOS/FreeCAD',
  'FreeCAD',
].filter(Boolean)
const drillTimeoutMs = Number(process.env.DRILL_TIMEOUT_MS || 180000)

function hasTraversalSegment(rawPath) {
  return rawPath.split(/[\\/]+/).includes('..')
}

function publicUrlFor(filePath) {
  const projectRelativePath = path.relative(savedProjectsRoot, filePath)
  if (!projectRelativePath.startsWith('..') && !path.isAbsolute(projectRelativePath)) {
    return `/projects/${projectRelativePath.split(path.sep).join('/')}`
  }

  const relativePath = path.relative(publicDir, filePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null
  return `/${relativePath.split(path.sep).join('/')}`
}

function isPublicAssetPath(rawPath) {
  return rawPath.startsWith('/projects/')
    || rawPath.startsWith('/models/')
}

function publicAssetPath(rawPath) {
  if (rawPath.startsWith('/projects/')) {
    return {
      filePath: path.resolve(savedProjectsRoot, rawPath.slice('/projects/'.length)),
      root: savedProjectsRoot,
      rootLabel: 'saved projects folder',
    }
  }

  return {
    filePath: path.resolve(publicDir, rawPath.slice(1)),
    root: publicDir,
    rootLabel: 'public/',
  }
}

function modelPathFromApiUrl(rawPath) {
  try {
    const parsed = new URL(rawPath, 'http://127.0.0.1:3001')
    if (parsed.pathname !== '/api/model') return null
    return parsed.searchParams.get('path')
  } catch {
    return null
  }
}

export async function resolveDrillableModel(rawPath) {
  if (typeof rawPath !== 'string' || rawPath.trim() === '') {
    throw httpError(400, 'A non-empty model path is required.')
  }

  const modelPath = modelPathFromApiUrl(rawPath)
  const requestedPath = modelPath || rawPath

  if (requestedPath.includes('\0') || hasTraversalSegment(requestedPath)) {
    throw httpError(400, 'Invalid model path.')
  }

  const cleanPath = requestedPath.split('?')[0]

  if (isPublicAssetPath(cleanPath)) {
    const { filePath, root, rootLabel } = publicAssetPath(cleanPath)
    if (!isInside(root, filePath)) {
      throw httpError(403, `Static drill path must be inside ${rootLabel}.`)
    }

    if (getModelType(filePath) !== 'stl') {
      throw httpError(415, 'Drill currently supports STL panels only.')
    }

    try {
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) throw httpError(400, 'Drill path must point to a file.')
    } catch (error) {
      if (error.code === 'ENOENT') throw httpError(404, `File not found: ${filePath}`)
      throw error
    }

    return {
      filePath,
      publicUrl: publicUrlFor(filePath),
    }
  }

  if (path.isAbsolute(cleanPath)) {
    const resolved = await validateModelPath(cleanPath)
    if (resolved.type !== 'stl') {
      throw httpError(415, 'Drill currently supports STL panels only.')
    }
    return {
      filePath: resolved.filePath,
      publicUrl: publicUrlFor(resolved.filePath),
    }
  }

  if (!cleanPath.startsWith('/')) {
    throw httpError(400, 'Static drill paths must start with /.')
  }

  const { filePath, root, rootLabel } = publicAssetPath(cleanPath)
  if (!isInside(root, filePath)) {
    throw httpError(403, `Static drill path must be inside ${rootLabel}.`)
  }

  if (getModelType(filePath) !== 'stl') {
    throw httpError(415, 'Drill currently supports STL panels only.')
  }

  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) throw httpError(400, 'Drill path must point to a file.')
  } catch (error) {
    if (error.code === 'ENOENT') throw httpError(404, `File not found: ${filePath}`)
    throw error
  }

  return {
    filePath,
    publicUrl: publicUrlFor(filePath),
  }
}

function stableHolePayload(holes) {
  return holes.map((hole) => ({
    class: 'hole',
    position: (hole.position || [0, 0, 0]).slice(0, 3).map((value) => Number(value) || 0),
    normal: (hole.normal || [0, 0, 1]).slice(0, 3).map((value) => Number(value) || 0),
    params: {
      diameter: Number(hole.params?.diameter) || 10,
      depth: Number(hole.params?.depth) || 3,
    },
  }))
}

async function drillHashFor(inputPath, holes) {
  const stat = await fs.stat(inputPath)
  return createHash('sha1')
    .update(inputPath)
    .update(String(stat.size))
    .update(String(stat.mtimeMs))
    .update(JSON.stringify(stableHolePayload(holes)))
    .digest('hex')
    .slice(0, 12)
}

function drilledOutputFor(inputPath, hash) {
  const extension = path.extname(inputPath)
  const base = inputPath.slice(0, -extension.length)
  return `${base}.drilled-${hash}.stl`
}

async function hasValidCachedOutput(outputPath) {
  try {
    const stat = await fs.stat(outputPath)
    return stat.isFile() && stat.size > 0
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function isPythonCommand(command) {
  return path.basename(command).toLowerCase().startsWith('python')
}

function inferFreeCadLibPath(command) {
  if (process.env.FREECAD_LIB_PATH) return process.env.FREECAD_LIB_PATH
  const binDir = path.dirname(command)
  const candidate = path.resolve(binDir, '..', 'lib')
  return candidate.includes('FreeCAD.app') ? candidate : null
}

function freeCadEnv(command) {
  const libPath = inferFreeCadLibPath(command)
  if (!libPath) return process.env

  const pythonPath = process.env.PYTHONPATH
    ? `${libPath}${path.delimiter}${process.env.PYTHONPATH}`
    : libPath

  return {
    ...process.env,
    PYTHONPATH: pythonPath,
  }
}

function argsForCommand(command, inputPath, outputPath, holesPath) {
  if (isPythonCommand(command)) {
    return [drillScript, inputPath, outputPath, holesPath]
  }

  return [drillScript, '--pass', inputPath, outputPath, holesPath]
}

function runFreeCad(command, inputPath, outputPath, holesPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argsForCommand(command, inputPath, outputPath, holesPath), {
      env: freeCadEnv(command),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timeout = setTimeout(() => {
      settled = true
      child.kill('SIGTERM')
      reject(httpError(
        504,
        'Panel drilling timed out.',
        `FreeCAD exceeded ${Math.round(drillTimeoutMs / 1000)} seconds.`,
      ))
    }, drillTimeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code === 0) {
        resolve(stdout)
        return
      }

      reject(httpError(500, 'Panel drilling failed.', stderr.trim() || stdout.trim()))
    })
  })
}

async function runFirstAvailableFreeCad(inputPath, outputPath, holesPath) {
  const missing = []

  for (const command of defaultFreeCadCommands) {
    try {
      await runFreeCad(command, inputPath, outputPath, holesPath)
      return command
    } catch (error) {
      if (error.code === 'ENOENT') {
        missing.push(command)
        continue
      }
      throw error
    }
  }

  throw httpError(
    503,
    'FreeCAD is required for drilling STL panels.',
    `Set FREECAD_CMD to the FreeCAD executable. Tried: ${missing.join(', ')}`,
  )
}

export async function drillPanel({ componentPath, holes }) {
  const drillable = await resolveDrillableModel(componentPath)
  const validHoles = Array.isArray(holes)
    ? holes.filter((hole) => hole?.class === 'hole')
    : []

  if (validHoles.length === 0) {
    throw httpError(400, 'At least one hole object is required.')
  }

  const stableHoles = stableHolePayload(validHoles)
  const hash = await drillHashFor(drillable.filePath, stableHoles)
  const outputPath = drilledOutputFor(drillable.filePath, hash)
  const holesPath = path.join(os.tmpdir(), `mountlab-holes-${Date.now()}.json`)

  if (await hasValidCachedOutput(outputPath)) {
    return {
      outputPath,
      outputUrl: publicUrlFor(outputPath),
      freecad: null,
      cached: true,
    }
  }

  await fs.writeFile(holesPath, JSON.stringify(stableHoles), 'utf8')
  try {
    const command = await runFirstAvailableFreeCad(drillable.filePath, outputPath, holesPath)
    const outputStat = await fs.stat(outputPath)
    if (!outputStat.isFile() || outputStat.size === 0) {
      throw httpError(500, 'Panel drilling did not produce a valid STL file.')
    }

    return {
      outputPath,
      outputUrl: publicUrlFor(outputPath),
      freecad: command,
      cached: false,
    }
  } finally {
    await fs.rm(holesPath, { force: true })
  }
}
