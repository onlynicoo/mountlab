import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { httpError } from './errors.js'
import { resolveDrillableModel } from './drill.js'
import { serverScriptPath } from './appPaths.js'

const exportScript = serverScriptPath('export.py')
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
const exportTimeoutMs = Number(process.env.EXPORT_TIMEOUT_MS || 180000)

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

function argsForCommand(command, inputPath, outputPath) {
  if (isPythonCommand(command)) {
    return [exportScript, inputPath, outputPath]
  }

  return [exportScript, '--pass', inputPath, outputPath]
}

function runFreeCadExport(command, inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argsForCommand(command, inputPath, outputPath), {
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
        'STEP export timed out.',
        `FreeCAD exceeded ${Math.round(exportTimeoutMs / 1000)} seconds.`,
      ))
    }, exportTimeoutMs)

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

      reject(httpError(500, 'STEP export failed.', stderr.trim() || stdout.trim()))
    })
  })
}

async function runFirstAvailableFreeCad(inputPath, outputPath) {
  const missing = []

  for (const command of defaultFreeCadCommands) {
    try {
      await runFreeCadExport(command, inputPath, outputPath)
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
    'FreeCAD is required for STEP export.',
    `Set FREECAD_CMD to the FreeCAD executable. Tried: ${missing.join(', ')}`,
  )
}

async function exportHashFor(inputPath) {
  const stat = await fs.stat(inputPath)
  return createHash('sha1')
    .update(inputPath)
    .update(String(stat.size))
    .update(String(stat.mtimeMs))
    .digest('hex')
    .slice(0, 12)
}

function stepOutputFor(inputPath, hash) {
  const extension = path.extname(inputPath)
  const base = inputPath.slice(0, -extension.length)
  return `${base}.export-${hash}.step`
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

export function exportDownloadUrl(filePath) {
  const params = new URLSearchParams({ path: filePath })
  return `/api/export/file?${params.toString()}`
}

export async function exportPanel({ componentPath, format, label }) {
  const normalizedFormat = String(format || '').toLowerCase()
  if (!['stl', 'step'].includes(normalizedFormat)) {
    throw httpError(400, 'Unsupported export format. Use STL or STEP.')
  }

  const source = await resolveDrillableModel(componentPath)

  if (normalizedFormat === 'stl') {
    return {
      label,
      format: 'stl',
      outputPath: source.filePath,
      cached: true,
      freecad: null,
    }
  }

  const hash = await exportHashFor(source.filePath)
  const outputPath = stepOutputFor(source.filePath, hash)

  if (await hasValidCachedOutput(outputPath)) {
    return {
      label,
      format: 'step',
      outputPath,
      cached: true,
      freecad: null,
    }
  }

  const command = await runFirstAvailableFreeCad(source.filePath, outputPath)
  const outputStat = await fs.stat(outputPath)
  if (!outputStat.isFile() || outputStat.size === 0) {
    throw httpError(500, 'STEP export did not produce a valid file.')
  }

  return {
    label,
    format: 'step',
    outputPath,
    cached: false,
    freecad: command,
  }
}
