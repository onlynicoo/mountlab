import { contextBridge, ipcRenderer } from 'electron'

const apiBase = process.env.MOUNTLAB_API_BASE || 'http://127.0.0.1:3001'

contextBridge.exposeInMainWorld('mountlab', {
  apiBase,
  showOpenDialog: (options) => ipcRenderer.invoke('mountlab:show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('mountlab:show-save-dialog', options),
})

globalThis.__MOUNTLAB_API_BASE__ = apiBase
