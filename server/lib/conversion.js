import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { httpError } from './errors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const serverDir = path.resolve(__dirname, '..')
const convertedDir = path.join(serverDir, 'converted')
const convertScript = path.join(serverDir, 'convert.py')

export async function ensureConvertedDir() {
  await fs.mkdir(convertedDir, { recursive: true })
}

export function getConvertedPath(inputPath) {
  const digest = crypto.createHash('sha256').update(inputPath).digest('hex').slice(0, 24)
  return path.join(convertedDir, `${digest}.stl`)
}

async function isCacheFresh(inputPath, outputPath) {
  try {
    const [inputStat, outputStat] = await Promise.all([
      fs.stat(inputPath),
      fs.stat(outputPath),
    ])
    return outputStat.mtimeMs >= inputStat.mtimeMs
  } catch {
    return false
  }
}

function missingPythonError() {
  return httpError(
    503,
    'Python is not available for STEP conversion.',
    'Install Python 3 and set PYTHON_CMD if needed. Example: PYTHON_CMD=python3 npm run server',
  )
}

function missingCadQueryError(stderr) {
  return httpError(
    503,
    'CadQuery is not available for STEP conversion.',
    stderr || 'Install CadQuery with: pip install cadquery',
  )
}

function runConverter(inputPath, outputPath) {
  const pythonCommand = process.env.PYTHON_CMD || 'python3'

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [convertScript, inputPath, outputPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(missingPythonError())
        return
      }

      reject(httpError(500, 'Failed to start STEP converter.', error.message))
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }

      if (code === 5 || /cadquery|ModuleNotFoundError|ImportError/i.test(stderr)) {
        reject(missingCadQueryError(stderr.trim()))
        return
      }

      reject(httpError(500, 'STEP conversion failed.', stderr.trim() || stdout.trim()))
    })
  })
}

export async function convertStepToStl(inputPath) {
  await ensureConvertedDir()

  const outputPath = getConvertedPath(inputPath)
  if (await isCacheFresh(inputPath, outputPath)) {
    return { outputPath, type: 'stl', cached: true }
  }

  await runConverter(inputPath, outputPath)
  return { outputPath, type: 'stl', cached: false }
}
