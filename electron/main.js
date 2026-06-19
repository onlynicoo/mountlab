import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { fork } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged
const rendererDevUrl = process.env.MOUNTLAB_RENDERER_URL || 'http://127.0.0.1:5173'
let mainWindow = null
let serverProcess = null
let shuttingDown = false

function appPath(...segments) {
  return path.join(app.getAppPath(), ...segments)
}

function resourcePath(...segments) {
  return isDev
    ? appPath(...segments)
    : path.join(process.resourcesPath, ...segments)
}

function waitForServer(child, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('MountLab backend did not report readiness in time.'))
    }, timeoutMs)

    const onMessage = (message) => {
      if (message?.type !== 'mountlab-server-ready') return
      cleanup()
      resolve(message.apiBase)
    }

    const onExit = (code, signal) => {
      cleanup()
      reject(new Error(`MountLab backend exited before startup (${signal || code}).`))
    }

    const cleanup = () => {
      clearTimeout(timeout)
      child.off('message', onMessage)
      child.off('exit', onExit)
    }

    child.on('message', onMessage)
    child.on('exit', onExit)
  })
}

async function waitForUrl(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Keep polling until Vite is ready.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250)
    })
  }

  throw new Error(`Timed out waiting for ${url}`)
}

async function startBackend() {
  const serverEntry = appPath('server', 'index.js')
  const userData = app.getPath('userData')

  serverProcess = fork(serverEntry, [], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      SERVER_HOST: '127.0.0.1',
      SERVER_PORT: '0',
      ELECTRON_RUN_AS_NODE: '1',
      MOUNTLAB_DATA_DIR: userData,
      MOUNTLAB_RESOURCES_DIR: resourcePath(),
      ALLOWED_DIRS: process.env.ALLOWED_DIRS || userData,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })

  serverProcess.stdout?.on('data', (chunk) => {
    console.log(`[mountlab-server] ${chunk.toString().trim()}`)
  })
  serverProcess.stderr?.on('data', (chunk) => {
    console.error(`[mountlab-server] ${chunk.toString().trim()}`)
  })

  return waitForServer(serverProcess)
}

function stopBackend() {
  if (!serverProcess || serverProcess.killed) return
  serverProcess.kill()
  serverProcess = null
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'close' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function createWindow(apiBase) {
  process.env.MOUNTLAB_API_BASE = apiBase

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'MountLab',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const source = sourceId ? `${sourceId}:${line}` : 'renderer'
    console.log(`[mountlab-renderer:${level}] ${message} (${source})`)
  })
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[mountlab-renderer] Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[mountlab-renderer] Render process gone: ${details.reason}`)
  })

  if (isDev) {
    await waitForUrl(rendererDevUrl)
    await mainWindow.loadURL(rendererDevUrl)
    return
  }

  await mainWindow.loadFile(appPath('dist', 'index.html'))
}

ipcMain.handle('mountlab:show-open-dialog', (_event, options) => (
  dialog.showOpenDialog(mainWindow, options)
))

ipcMain.handle('mountlab:show-save-dialog', (_event, options) => (
  dialog.showSaveDialog(mainWindow, options)
))

app.on('before-quit', () => {
  shuttingDown = true
  stopBackend()
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverProcess) {
    const apiBase = process.env.MOUNTLAB_API_BASE
    await createWindow(apiBase)
  }
})

app.whenReady().then(async () => {
  try {
    createMenu()
    const apiBase = await startBackend()
    await createWindow(apiBase)
  } catch (error) {
    console.error(error)
    if (!shuttingDown) {
      dialog.showErrorBox('MountLab failed to start', error.message)
    }
    app.quit()
  }
})
