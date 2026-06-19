const { spawn } = require('node:child_process')
const path = require('node:path')
const electron = require('electron')

const root = path.resolve(__dirname, '..')
const port = process.env.MOUNTLAB_RENDERER_PORT || '5179'
const rendererUrl = process.env.MOUNTLAB_RENDERER_URL || `http://127.0.0.1:${port}`
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
let shuttingDown = false

function envWithoutElectronRunAsNode(extra = {}) {
  const env = { ...process.env, ...extra }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

function spawnDevProcess(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    shuttingDown = true
    stopAll()
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}${signal ? ` (${signal})` : ''}`)
      process.exitCode = code
    }
  })

  return child
}

const vite = spawnDevProcess(
  'Vite',
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', port, '--strictPort'],
  { env: envWithoutElectronRunAsNode() },
)

const electronProcess = spawnDevProcess(
  'Electron',
  electron,
  ['.'],
  {
    env: envWithoutElectronRunAsNode({
      MOUNTLAB_RENDERER_URL: rendererUrl,
    }),
  },
)

function stopChild(child) {
  if (!child || child.killed) return
  child.kill()
}

function stopAll() {
  stopChild(electronProcess)
  stopChild(vite)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shuttingDown = true
    stopAll()
    process.exit()
  })
}
