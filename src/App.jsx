import { useEffect, useRef, useState } from 'react'
import { useAssembly } from './hooks/useAssembly'
import Viewer3D from './components/Viewer3D'
import drillingLoadingSvg from './assets/drilling-loading.svg'
import { ASSEMBLY_OBJECT_CLASSES } from './config/assemblyObjects'
import {
  DEFAULT_RACK_PRESET_ID,
  HALF_RACK_WIDTH_MM,
  RACK_PRESETS,
  STANDARD_RACK_WIDTH_MM,
  dimensionsForRackPreset,
  findRackPreset,
  rackHeightForUnits,
} from './config/rackPresets'

const API_BASE = 'http://127.0.0.1:3001'

function basename(filePath) {
  return filePath?.split('/').filter(Boolean).pop() || 'Component'
}

function absoluteApiUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_BASE}${url}`
}

const COLOR_PRESETS = [
  '#4a90d9',
  '#8a9db5',
  '#1a7a4a',
  '#2a9d8f',
  '#c9920a',
  '#d84f4f',
  '#1f2937',
  '#f4f1de',
]

const MOUNT_ELEMENT_LIBRARY = [
  {
    id: 'knob',
    label: 'Knob',
    className: 'knob',
    description: 'Round front-panel control knob mounted at each selected hole.',
  },
  {
    id: 'generic',
    label: 'Generic element',
    className: 'generic',
    description: 'Basic placeholder block for hardware that is not in the library yet.',
  },
  {
    id: 'uploaded-custom',
    label: 'Uploaded elements',
    description: 'Custom uploaded parts will appear here later.',
    disabled: true,
  },
]

function objectClassLabel(objectClass) {
  return objectClass.id === 'generic' ? 'Generic Component' : objectClass.label
}

function TopMenuButton({ children, active = false, ...props }) {
  return (
    <button
      type="button"
      className={`h-8 rounded px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-amber-500 text-neutral-950'
          : 'text-neutral-200 hover:bg-neutral-800 hover:text-white'
      }`}
      {...props}
    >
      {children}
    </button>
  )
}

function StatusLine({ status }) {
  const color = {
    idle: 'bg-neutral-600',
    loading: 'bg-amber-400',
    loaded: 'bg-emerald-400',
    saved: 'bg-emerald-400',
    saving: 'bg-amber-400',
    error: 'bg-red-500',
  }[status?.state] || 'bg-neutral-600'

  return (
    <div className="flex min-h-5 items-center gap-2 text-xs text-neutral-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className={status?.state === 'error' ? 'text-red-300' : ''}>
        {status?.message || 'Idle'}
      </span>
    </div>
  )
}

function ToolbarButton({ children, variant = 'default', active = false, className = '', ...props }) {
  const classes = active
    ? 'border-amber-500 bg-amber-500 text-neutral-950'
    : variant === 'primary'
      ? 'border-amber-600 bg-amber-500 text-neutral-950 hover:bg-amber-400'
      : variant === 'danger'
        ? 'border-red-900/70 bg-red-950/50 text-red-100 hover:bg-red-900/60'
        : 'border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-neutral-500 hover:bg-neutral-800'

  return (
    <button
      type="button"
      className={`h-8 rounded border px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${classes} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function FileMenuItem({
  children,
  description,
  shortcut,
  danger = false,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-10 w-full items-center justify-between gap-5 rounded px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-red-200 hover:bg-red-950/50'
          : 'text-neutral-100 hover:bg-neutral-800'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate">{children}</span>
        {description && (
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            {description}
          </span>
        )}
      </span>
      {shortcut && (
        <span className="shrink-0 text-xs text-neutral-500">{shortcut}</span>
      )}
    </button>
  )
}

function FileMenuSeparator() {
  return <div className="my-1 h-px bg-neutral-800" />
}

function FileMenuStatus({ label, status }) {
  if (!status?.message) return null

  const color = status.state === 'error'
    ? 'text-red-300'
    : status.state === 'saving' || status.state === 'loading'
      ? 'text-amber-300'
      : status.state === 'saved' || status.state === 'loaded'
        ? 'text-emerald-300'
        : 'text-neutral-500'

  return (
    <div className="flex items-center justify-between gap-4 px-3 py-1 text-xs">
      <span className="text-neutral-600">{label}</span>
      <span className={`min-w-0 truncate text-right ${color}`}>{status.message}</span>
    </div>
  )
}

function MenuNumberField({ label, value, min = 0, max, step = 1, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-100 outline-none focus:border-amber-500"
      />
    </label>
  )
}

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable
}

function DrillingOverlay({ visible }) {
  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/75 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="Drilling operation processing"
    >
      <img
        src={drillingLoadingSvg}
        alt=""
        className="w-full max-w-[680px] drop-shadow-2xl"
      />
      <span className="sr-only">Drilling operation processing</span>
    </div>
  )
}

function ExportDialog({ open, panels, onClose }) {
  const exportablePanels = panels.filter((panel) => (
    panel.id === 'front_panel' || panel.id === 'back_panel'
  ))
  const [selectedPanels, setSelectedPanels] = useState(() => new Set(['front_panel', 'back_panel']))
  const [formats, setFormats] = useState(() => new Set(['stl']))
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [exports, setExports] = useState([])

  useEffect(() => {
    if (!open) return
    setSelectedPanels(new Set(exportablePanels.map((panel) => panel.id)))
    setFormats(new Set(['stl']))
    setStatus({ state: 'idle', message: '' })
    setExports([])
  }, [open, panels]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const togglePanel = (panelId) => {
    setSelectedPanels((current) => {
      const next = new Set(current)
      if (next.has(panelId)) next.delete(panelId)
      else next.add(panelId)
      return next
    })
  }

  const toggleFormat = (format) => {
    setFormats((current) => {
      const next = new Set(current)
      if (next.has(format)) next.delete(format)
      else next.add(format)
      return next
    })
  }

  const runExport = async () => {
    const items = exportablePanels
      .filter((panel) => selectedPanels.has(panel.id))
      .flatMap((panel) => [...formats].map((format) => ({
        id: panel.id,
        label: panel.label,
        path: panel.path,
        format,
      })))

    if (items.length === 0) {
      setStatus({ state: 'error', message: 'Select at least one panel and one format.' })
      return
    }

    setStatus({ state: 'loading', message: 'Preparing export files...' })
    setExports([])

    try {
      const response = await fetch(`${API_BASE}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      if (!response.ok) {
        let message = response.statusText
        try {
          const payload = await response.json()
          message = payload.details
            ? `${payload.error || response.statusText}: ${payload.details}`
            : payload.error || response.statusText
        } catch {
          // Keep HTTP status text.
        }
        throw new Error(message)
      }

      const payload = await response.json()
      setExports(payload.exports || [])
      setStatus({
        state: 'loaded',
        message: `Prepared ${(payload.exports || []).length} file${payload.exports?.length === 1 ? '' : 's'}`,
      })
    } catch (error) {
      setStatus({ state: 'error', message: error.message })
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded border border-neutral-700 bg-neutral-950 text-neutral-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-500">
              Export
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">Export panels</h2>
            <p className="mt-1 max-w-lg text-sm text-neutral-400">
              Choose which panels to export and the output format. STEP export uses FreeCAD and may take a moment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Close export dialog"
          >
            x
          </button>
        </div>

        <div className="space-y-5 p-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Panels
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {exportablePanels.map((panel) => (
                <label
                  key={panel.id}
                  className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-3 text-sm transition ${
                    selectedPanels.has(panel.id)
                      ? 'border-amber-500 bg-amber-950/30 text-amber-100'
                      : 'border-neutral-800 bg-neutral-900/70 text-neutral-300 hover:border-neutral-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPanels.has(panel.id)}
                    onChange={() => togglePanel(panel.id)}
                    className="accent-amber-500"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{panel.label}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {basename(panel.path)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Formats
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['stl', 'STL', 'Mesh file for preview and fabrication workflows'],
                ['step', 'STEP', 'CAD exchange file generated from the current panel mesh'],
              ].map(([format, label, description]) => (
                <label
                  key={format}
                  className={`flex cursor-pointer items-start gap-3 rounded border px-3 py-3 text-sm transition ${
                    formats.has(format)
                      ? 'border-amber-500 bg-amber-950/30 text-amber-100'
                      : 'border-neutral-800 bg-neutral-900/70 text-neutral-300 hover:border-neutral-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formats.has(format)}
                    onChange={() => toggleFormat(format)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 border-t border-neutral-800 pt-4">
            <StatusLine status={status} />
            <div className="flex shrink-0 items-center gap-2">
              <ToolbarButton onClick={onClose}>Close</ToolbarButton>
              <ToolbarButton
                variant="primary"
                onClick={runExport}
                disabled={status.state === 'loading'}
              >
                {status.state === 'loading' ? 'Exporting...' : 'Export'}
              </ToolbarButton>
            </div>
          </div>

          {exports.length > 0 && (
            <section className="rounded border border-neutral-800 bg-neutral-900/70 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Prepared files
              </h3>
              <div className="mt-3 space-y-2">
                {exports.map((item) => (
                  <a
                    key={`${item.outputPath}-${item.format}`}
                    href={absoluteApiUrl(item.downloadUrl)}
                    className="flex items-center justify-between gap-4 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 transition hover:border-amber-500 hover:text-amber-100"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{item.fileName}</span>
                      <span className="block text-xs uppercase text-neutral-500">
                        {item.label} / {item.format}{item.cached ? ' / cached' : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-amber-300">Download</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function TopBar({
  projectName,
  activeHost,
  pcbs,
  selectedPcbId,
  transformMode,
  pcbStatus,
  persistenceStatus,
  drillingStatus,
  onNewProject,
  onExport,
  onImport,
  onSave,
  onSaveAs,
  onLoad,
  onReset,
  onInsert,
  onInsertGrid,
  onBake,
  onAddPcb,
  onRemovePcb,
  onSelectPcb,
  onTransformMode,
  onViewCommand,
  isBaking,
}) {
  const hostLabel = activeHost?.label || 'Front Panel'
  const [openMenu, setOpenMenu] = useState(null)
  const [pcbInput, setPcbInput] = useState('')
  const [gridClassName, setGridClassName] = useState('hole')
  const [gridColumns, setGridColumns] = useState(3)
  const [gridRows, setGridRows] = useState(2)
  const [gridPitchX, setGridPitchX] = useState(25)
  const [gridPitchY, setGridPitchY] = useState(25)
  const [gridOriginX, setGridOriginX] = useState(0)
  const [gridOriginY, setGridOriginY] = useState(0)
  const [gridOriginMode, setGridOriginMode] = useState('center')
  const [gridSizeA, setGridSizeA] = useState(10)
  const [gridSizeB, setGridSizeB] = useState(12)
  const [gridSizeC, setGridSizeC] = useState(6)
  const [gridLabelPrefix, setGridLabelPrefix] = useState('')

  const gridObjectClass = ASSEMBLY_OBJECT_CLASSES.find((objectClass) => objectClass.id === gridClassName)
    || ASSEMBLY_OBJECT_CLASSES[0]
  const gridCount = Math.max(1, Math.round(Number(gridColumns) || 1))
    * Math.max(1, Math.round(Number(gridRows) || 1))
  const gridParams = (() => {
    if (gridClassName === 'hole') {
      return {
        diameter: Math.max(0.1, Number(gridSizeA) || gridObjectClass.params.diameter),
        depth: Math.max(0.1, Number(gridSizeB) || gridObjectClass.params.depth),
      }
    }

    if (gridClassName === 'knob') {
      const diameter = Math.max(0.1, Number(gridSizeA) || gridObjectClass.params.diameter)
      return {
        diameter,
        depth: Math.max(0.1, Number(gridSizeB) || gridObjectClass.params.depth),
        skirtDiameter: Math.max(diameter, Number(gridSizeC) || gridObjectClass.params.skirtDiameter),
      }
    }

    return {
      width: Math.max(0.1, Number(gridSizeA) || gridObjectClass.params.width),
      height: Math.max(0.1, Number(gridSizeB) || gridObjectClass.params.height),
      depth: Math.max(0.1, Number(gridSizeC) || gridObjectClass.params.depth),
    }
  })()

  const selectGridClass = (className) => {
    const objectClass = ASSEMBLY_OBJECT_CLASSES.find((candidate) => candidate.id === className)
      || ASSEMBLY_OBJECT_CLASSES[0]
    setGridClassName(objectClass.id)

    if (objectClass.id === 'hole') {
      setGridSizeA(objectClass.params.diameter)
      setGridSizeB(objectClass.params.depth)
      setGridSizeC(6)
      return
    }

    if (objectClass.id === 'knob') {
      setGridSizeA(objectClass.params.diameter)
      setGridSizeB(objectClass.params.depth)
      setGridSizeC(objectClass.params.skirtDiameter)
      return
    }

    setGridSizeA(objectClass.params.width)
    setGridSizeB(objectClass.params.height)
    setGridSizeC(objectClass.params.depth)
  }

  const toggleMenu = (menu) => {
    setOpenMenu((current) => (current === menu ? null : menu))
  }

  const closeMenu = () => setOpenMenu(null)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || isTypingTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        onNewProject()
        setOpenMenu(null)
      }

      if (key === 'o') {
        event.preventDefault()
        onLoad()
        setOpenMenu(null)
      }

      if (key === 's') {
        event.preventDefault()
        onSave()
        setOpenMenu(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onLoad, onNewProject, onSave])

  return (
    <div className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950 px-3 text-neutral-100 shadow-lg">
      <div className="flex min-w-0 items-center gap-1">
        <div className="mr-3 flex items-center gap-2 border-r border-neutral-800 pr-4">
          <div className="h-3 w-3 rounded-full border border-amber-500 bg-amber-400" />
          <span className="text-sm font-semibold tracking-[0.16em] text-white">MOUNTLAB</span>
        </div>

        <div className="relative">
          <TopMenuButton active={openMenu === 'file'} onClick={() => toggleMenu('file')}>
            File
          </TopMenuButton>
          {openMenu === 'file' && (
            <div className="absolute left-0 top-10 z-50 w-80 rounded border border-neutral-700 bg-neutral-950 py-2 shadow-2xl">
              <div className="px-1">
                <FileMenuItem
                  description="Start from a rack chassis preset"
                  shortcut="Ctrl/Cmd+N"
                  onClick={() => {
                    onNewProject()
                    closeMenu()
                  }}
                >
                  New Project...
                </FileMenuItem>
                <FileMenuItem
                  description="Open a MountLab saved project"
                  shortcut="Ctrl/Cmd+O"
                  onClick={() => {
                    onLoad()
                    closeMenu()
                  }}
                >
                  Open Saved Project
                </FileMenuItem>
                <FileMenuItem
                  description="Import a project folder with STL files"
                  onClick={() => {
                    onImport()
                    closeMenu()
                  }}
                >
                  Import Project Folder...
                </FileMenuItem>
                <FileMenuSeparator />
                <FileMenuItem
                  description="Choose panels and export STL or STEP"
                  onClick={() => {
                    onExport()
                    closeMenu()
                  }}
                >
                  Export...
                </FileMenuItem>
                <FileMenuSeparator />
                <FileMenuItem
                  description="Save layout, objects, visibility, and panel state"
                  shortcut="Ctrl/Cmd+S"
                  onClick={() => {
                    onSave()
                    closeMenu()
                  }}
                >
                  Save
                </FileMenuItem>
                <FileMenuItem
                  description="Copy the working project into public/projects"
                  onClick={() => {
                    onSaveAs()
                    closeMenu()
                  }}
                >
                  Save As Project...
                </FileMenuItem>
                <FileMenuStatus label="Project" status={persistenceStatus} />
                <FileMenuSeparator />
                <FileMenuItem
                  description="Create drilled geometry for the active panel"
                  disabled={!activeHost || isBaking}
                  onClick={() => {
                    onBake()
                    closeMenu()
                  }}
                >
                  {isBaking ? 'Baking...' : `Bake ${hostLabel}`}
                </FileMenuItem>
                <FileMenuStatus label="Panel" status={drillingStatus} />
                <FileMenuSeparator />
                <FileMenuItem
                  danger
                  description="Clear the current workspace"
                  onClick={() => {
                    onReset()
                    closeMenu()
                  }}
                >
                  Reset Workspace
                </FileMenuItem>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <TopMenuButton active={openMenu === 'settings'} onClick={() => toggleMenu('settings')}>
            Settings
          </TopMenuButton>
          {openMenu === 'settings' && (
            <div className="absolute left-0 top-10 z-50 w-80 rounded border border-neutral-700 bg-neutral-950 p-3 shadow-2xl">
              <div className="space-y-4">
                <section className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    PCB Boards
                  </h2>
                  <input
                    value={pcbInput}
                    onChange={(event) => setPcbInput(event.target.value)}
                    placeholder="/Users/nicola/kicad/main_board.gltf"
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-amber-500"
                  />
                  <ToolbarButton
                    onClick={async () => {
                      const pcb = await onAddPcb(pcbInput)
                      if (pcb) setPcbInput('')
                    }}
                    disabled={pcbStatus.state === 'loading'}
                  >
                    Add PCB
                  </ToolbarButton>
                  <StatusLine status={pcbStatus} />

                  <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                    {pcbs.length === 0 && (
                      <p className="rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-500">
                        No PCB loaded
                      </p>
                    )}
                    {pcbs.map((pcb) => (
                      <div
                        key={pcb.id}
                        className={`flex items-center gap-2 rounded border px-3 py-2 text-sm transition ${
                          selectedPcbId === pcb.id
                            ? 'border-emerald-500/80 bg-emerald-950/30'
                            : 'border-neutral-800 bg-neutral-900/70'
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => onSelectPcb(pcb.id)}
                        >
                          <span className="block truncate text-neutral-200">{basename(pcb.path)}</span>
                        </button>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-300"
                          onClick={() => onRemovePcb(pcb.id)}
                          aria-label={`Remove ${basename(pcb.path)}`}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    Transform mode
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    <ToolbarButton
                      active={transformMode === 'translate'}
                      onClick={() => onTransformMode('translate')}
                    >
                      Move
                    </ToolbarButton>
                    <ToolbarButton
                      active={transformMode === 'rotate'}
                      onClick={() => onTransformMode('rotate')}
                    >
                      Rotate
                    </ToolbarButton>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <TopMenuButton active={openMenu === 'insert'} onClick={() => toggleMenu('insert')}>
            Insert
          </TopMenuButton>
          {openMenu === 'insert' && (
            <div className="absolute left-0 top-10 z-50 w-[28rem] rounded border border-neutral-700 bg-neutral-950 p-3 shadow-2xl">
              <p className="mb-2 truncate px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Add to {hostLabel}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ASSEMBLY_OBJECT_CLASSES.map((objectClass) => (
                  <button
                    key={objectClass.id}
                    type="button"
                    onClick={() => {
                      onInsert(objectClass.id)
                      closeMenu()
                    }}
                    className="block w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-sm text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-amber-200"
                  >
                    {objectClassLabel(objectClass)}
                  </button>
                ))}
              </div>
              <div className="mt-3 border-t border-neutral-800 pt-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                      Grid
                    </h2>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {gridCount} item{gridCount === 1 ? '' : 's'} on {hostLabel}
                    </p>
                  </div>
                  <select
                    value={gridClassName}
                    onChange={(event) => selectGridClass(event.target.value)}
                    className="h-8 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-100 outline-none focus:border-amber-500"
                  >
                    {ASSEMBLY_OBJECT_CLASSES.map((objectClass) => (
                      <option key={objectClass.id} value={objectClass.id}>
                        {objectClassLabel(objectClass)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <MenuNumberField label="Columns" value={gridColumns} min={1} max={24} step={1} onChange={setGridColumns} />
                  <MenuNumberField label="Rows" value={gridRows} min={1} max={24} step={1} onChange={setGridRows} />
                  <MenuNumberField label="Pitch X" value={gridPitchX} min={0} step={0.1} onChange={setGridPitchX} />
                  <MenuNumberField label="Pitch Y" value={gridPitchY} min={0} step={0.1} onChange={setGridPitchY} />
                </div>

                <div className="mt-2 grid grid-cols-4 gap-2">
                  <MenuNumberField label="Origin X" value={gridOriginX} min={-10000} step={0.1} onChange={setGridOriginX} />
                  <MenuNumberField label="Origin Y" value={gridOriginY} min={-10000} step={0.1} onChange={setGridOriginY} />
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                      Origin
                    </span>
                    <select
                      value={gridOriginMode}
                      onChange={(event) => setGridOriginMode(event.target.value)}
                      className="h-8 w-full rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-100 outline-none focus:border-amber-500"
                    >
                      <option value="center">Center</option>
                      <option value="corner">Top left</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                      Label
                    </span>
                    <input
                      value={gridLabelPrefix}
                      onChange={(event) => setGridLabelPrefix(event.target.value)}
                      placeholder="Optional"
                      className="h-8 w-full rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-amber-500"
                    />
                  </label>
                </div>

                <div className={`mt-2 grid gap-2 ${gridClassName === 'hole' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  <MenuNumberField
                    label={gridClassName === 'generic' ? 'Width' : 'Diameter'}
                    value={gridSizeA}
                    min={0.1}
                    step={0.1}
                    onChange={setGridSizeA}
                  />
                  <MenuNumberField
                    label={gridClassName === 'generic' ? 'Height' : 'Depth'}
                    value={gridSizeB}
                    min={0.1}
                    step={0.1}
                    onChange={setGridSizeB}
                  />
                  {gridClassName !== 'hole' && (
                    <MenuNumberField
                      label={gridClassName === 'knob' ? 'Skirt' : 'Depth'}
                      value={gridSizeC}
                      min={0.1}
                      step={0.1}
                      onChange={setGridSizeC}
                    />
                  )}
                </div>

                <ToolbarButton
                  variant="primary"
                  onClick={() => {
                    onInsertGrid({
                      className: gridClassName,
                      hostId: activeHost?.id,
                      columns: gridColumns,
                      rows: gridRows,
                      pitchX: gridPitchX,
                      pitchY: gridPitchY,
                      originX: gridOriginX,
                      originY: gridOriginY,
                      originMode: gridOriginMode,
                      labelPrefix: gridLabelPrefix,
                      params: gridParams,
                    })
                    closeMenu()
                  }}
                  disabled={!activeHost}
                  className="mt-3"
                >
                  Insert Grid
                </ToolbarButton>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <TopMenuButton active={openMenu === 'view'} onClick={() => toggleMenu('view')}>
            View
          </TopMenuButton>
          {openMenu === 'view' && (
            <div className="absolute left-0 top-10 z-50 w-64 rounded border border-neutral-700 bg-neutral-950 p-3 shadow-2xl">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['fit', 'Fit'],
                  ['view_front', 'Front'],
                  ['view_back', 'Back'],
                  ['view_left', 'Left'],
                  ['view_right', 'Right'],
                  ['view_top', 'Top'],
                  ['zoom_in', 'Zoom In'],
                  ['zoom_out', 'Zoom Out'],
                  ['pan_left', 'Pan Left'],
                  ['pan_right', 'Pan Right'],
                ].map(([command, label]) => (
                  <ToolbarButton
                    key={command}
                    onClick={() => {
                      onViewCommand(command)
                      closeMenu()
                    }}
                  >
                    {label}
                  </ToolbarButton>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {projectName && (
          <span className="max-w-44 truncate rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
            {projectName}
          </span>
        )}
        <span className="max-w-44 truncate rounded border border-amber-900/70 bg-amber-950/30 px-2 py-1 text-xs text-amber-100">
          Panel: {hostLabel}
        </span>
        <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs capitalize text-neutral-400">
          {transformMode}
        </span>
      </div>
    </div>
  )
}

function NumberField({ label, value, min = 0.1, step = 0.1, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
      />
    </label>
  )
}

function objectToPanelPosition(object) {
  const position = object?.position || [0, 0, 0]
  return {
    x: object?.hostId === 'back_panel' ? -position[0] : position[0],
    y: position[1],
  }
}

function panelPositionToObjectPosition(object, axis, value) {
  const position = [...(object?.position || [0, 0, 0])]

  if (axis === 0) {
    position[0] = object?.hostId === 'back_panel' ? -value : value
    return position
  }

  position[1] = value
  return position
}

function NewProjectDialog({ open, onClose, onCreate }) {
  const defaultPreset = findRackPreset(DEFAULT_RACK_PRESET_ID)
  const [presetId, setPresetId] = useState(DEFAULT_RACK_PRESET_ID)
  const [name, setName] = useState('Untitled 2U rack')
  const [rackUnits, setRackUnits] = useState(defaultPreset.rackUnits)
  const [width, setWidth] = useState(defaultPreset.width)
  const [depth, setDepth] = useState(defaultPreset.depth)
  const [panelThickness, setPanelThickness] = useState(3)
  const previewDimensions = {
    width: Number(width) || defaultPreset.width,
    height: rackHeightForUnits(rackUnits),
    depth: Number(depth) || defaultPreset.depth,
    rack_units: Number(rackUnits) || defaultPreset.rackUnits,
  }

  if (!open) return null

  const selectPreset = (nextPresetId) => {
    const preset = findRackPreset(nextPresetId)
    const dimensions = dimensionsForRackPreset(preset)
    setPresetId(preset.id)
    setRackUnits(preset.rackUnits)
    setWidth(dimensions.width)
    setDepth(dimensions.depth)
    setName(`Untitled ${preset.rackUnits}U rack`)
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded border border-neutral-700 bg-neutral-950 text-neutral-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-500">
              New project
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">Create rack chassis</h2>
            <p className="mt-1 max-w-xl text-sm text-neutral-400">
              Start with a physical rack envelope. Panel layout and PCB placement come after this.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Close new project"
          >
            x
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Project name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
              />
            </label>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Rack preset
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {RACK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    className={`rounded border px-3 py-2 text-left transition ${
                      presetId === preset.id
                        ? 'border-amber-500 bg-amber-950/40'
                        : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                    }`}
                  >
                    <span className="block text-sm font-medium text-neutral-100">{preset.label}</span>
                    <span className="mt-1 block text-xs text-neutral-500">
                      {preset.rackUnits}U / {preset.width}mm / {preset.depth}mm deep
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField
                label="Rack U"
                value={rackUnits}
                min={1}
                step={1}
                onChange={(value) => {
                  setPresetId('custom')
                  setRackUnits(value)
                }}
              />
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                  Width
                </span>
                <select
                  value={Number(width)}
                  onChange={(event) => {
                    setPresetId('custom')
                    setWidth(Number(event.target.value))
                  }}
                  className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
                >
                  <option value={STANDARD_RACK_WIDTH_MM}>19 inch</option>
                  <option value={HALF_RACK_WIDTH_MM}>Half-rack</option>
                </select>
              </label>
              <NumberField
                label="Depth"
                value={depth}
                min={50}
                step={10}
                onChange={(value) => {
                  setPresetId('custom')
                  setDepth(value)
                }}
              />
              <NumberField
                label="Panel"
                value={panelThickness}
                min={1}
                step={0.5}
                onChange={setPanelThickness}
              />
            </div>
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-900/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Preview dimensions
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Width</span>
                <span className="text-neutral-100">{previewDimensions.width} mm</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Height</span>
                <span className="text-neutral-100">{previewDimensions.height} mm</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Depth</span>
                <span className="text-neutral-100">{previewDimensions.depth} mm</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Panels</span>
                <span className="text-neutral-100">front/back</span>
              </div>
            </div>
            <div className="mt-5 rounded border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-500">
              The project will start with generated chassis geometry. Imported STL projects can still use panel baking.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-800 p-5">
          <ToolbarButton onClick={onClose}>Cancel</ToolbarButton>
          <ToolbarButton
            variant="primary"
            onClick={() => {
              onCreate({
                name,
                presetId,
                rackUnits,
                width,
                depth,
                panelThickness,
              })
              onClose()
            }}
          >
            Create chassis
          </ToolbarButton>
        </div>
      </div>
    </div>
  )
}

function ImportReviewDialog({ review, panels, onAccept, onRemoveDetected }) {
  if (!review) return null

  const panelById = new Map(panels.map((panel) => [panel.id, panel]))
  const detectedPanels = review.panels.filter((panel) => panel.detected > 0)
  const scanRows = (review.diagnostics || [])
    .filter((item) => item?.hostId || item?.detected > 0 || item?.skipped)
    .slice(0, 8)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded border border-neutral-700 bg-neutral-950 text-neutral-100 shadow-2xl">
        <div className="border-b border-neutral-800 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-500">
            Import review
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">{review.projectName}</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {review.totalDetected > 0
              ? `${review.totalDetected} circular hole${review.totalDetected === 1 ? '' : 's'} detected and added as panel components.`
              : 'No circular panel holes were detected automatically.'}
          </p>
        </div>

        <div className="space-y-2 p-5">
          {review.panels.map((panel) => {
            const component = panelById.get(panel.id)
            return (
              <div
                key={panel.id}
                className="flex items-center justify-between gap-4 rounded border border-neutral-800 bg-neutral-900/70 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate text-neutral-100">{panel.label}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {component?.drillState === 'drilled' ? 'Imported geometry' : 'Source geometry'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {panel.existing > 0 && (
                    <span className="rounded bg-neutral-950 px-2 py-1 text-xs text-neutral-400">
                      {panel.existing} existing
                    </span>
                  )}
                  <span className={`rounded px-2 py-1 text-xs ${
                    panel.detected > 0
                      ? 'bg-emerald-950/70 text-emerald-200'
                      : 'bg-neutral-950 text-neutral-500'
                  }`}
                  >
                    {panel.detected} detected
                  </span>
                </div>
              </div>
            )
          })}

          {scanRows.length > 0 && (
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-900/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                STL scan
              </div>
              <div className="space-y-1">
                {scanRows.map((item) => (
                  <div
                    key={item.sourcePath}
                    className="flex items-center justify-between gap-3 text-xs text-neutral-400"
                  >
                    <span className="min-w-0 truncate">
                      {item.sourcePath?.split('/').filter(Boolean).pop() || 'STL file'}
                    </span>
                    <span className="shrink-0 text-neutral-500">
                      {item.hostId || item.skipped || 'unknown'} · {item.detected || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-800 p-5">
          {detectedPanels.length > 0 && (
            <ToolbarButton variant="danger" onClick={onRemoveDetected}>
              Remove detected holes
            </ToolbarButton>
          )}
          <ToolbarButton variant="primary" onClick={onAccept}>
            Keep import
          </ToolbarButton>
        </div>
      </div>
    </div>
  )
}

function MountElementDialog({ open, holes, onClose, onMount }) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded border border-neutral-700 bg-neutral-950 text-neutral-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-500">
              Mount
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">Choose element</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Mount an element onto {holes.length} selected hole{holes.length === 1 ? '' : 's'}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Close mount picker"
          >
            x
          </button>
        </div>

        <div className="space-y-2 p-5">
          {MOUNT_ELEMENT_LIBRARY.map((element) => (
            <button
              key={element.id}
              type="button"
              disabled={element.disabled}
              onClick={() => onMount(element)}
              className="flex w-full items-start justify-between gap-4 rounded border border-neutral-800 bg-neutral-900/70 px-4 py-3 text-left transition hover:border-amber-500 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-neutral-800"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-100">{element.label}</span>
                <span className="mt-1 block text-xs leading-snug text-neutral-500">
                  {element.description}
                </span>
              </span>
              <span className="shrink-0 rounded bg-neutral-950 px-2 py-1 text-xs text-neutral-500">
                {element.disabled ? 'Later' : 'Mount'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ComponentSettings({
  component,
  hosts,
  onColorChange,
  onTransparencyChange,
  onLabelChange,
  onHostChange,
  onPositionChange,
  onParamChange,
  onDelete,
  onMount,
  onClose,
}) {
  if (!component) return null

  if (component.type === 'holeSelection') {
    return (
      <div className="absolute right-5 top-5 z-10 w-72 rounded border border-neutral-700 bg-neutral-950/95 p-4 text-neutral-100 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-500">
              Hole selection
            </p>
            <h2 className="mt-1 truncate text-sm font-semibold text-white">
              {component.label}
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {component.hostSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Close component settings"
          >
            x
          </button>
        </div>

        <div className="rounded border border-neutral-800 bg-neutral-900/70 p-3 text-sm text-neutral-300">
          {component.count} hole{component.count === 1 ? '' : 's'} selected for mounting.
        </div>

        <button
          type="button"
          onClick={onMount}
          className="mt-4 w-full rounded border border-amber-600 bg-amber-500 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-amber-400"
        >
          Mount
        </button>
      </div>
    )
  }

  return (
    <div className="absolute right-5 top-5 z-10 w-72 rounded border border-neutral-700 bg-neutral-950/95 p-4 text-neutral-100 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-500">
            Component settings
          </p>
          <h2 className="mt-1 truncate text-sm font-semibold text-white">
            {component.label}
          </h2>
          {component.kind && (
            <p className="mt-1 text-xs capitalize text-neutral-500">{component.kind}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-100"
          aria-label="Close component settings"
        >
          x
        </button>
      </div>

      {component.type === 'object' && (
        <div className="mb-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Label
          </label>
          <input
            value={component.label}
            onChange={(event) => onLabelChange(event.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
          />

          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Host panel
          </label>
          <select
            value={component.hostId}
            onChange={(event) => onHostChange(event.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
          >
            {hosts.map((host) => (
              <option key={host.id} value={host.id}>
                {host.label}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="X"
              value={component.panelPosition?.x ?? 0}
              min={-10000}
              step={0.1}
              onChange={(value) => onPositionChange(0, value)}
            />
            <NumberField
              label="Y"
              value={component.panelPosition?.y ?? 0}
              min={-10000}
              step={0.1}
              onChange={(value) => onPositionChange(1, value)}
            />
          </div>
        </div>
      )}

      <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
        Color
      </label>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="color"
          value={component.color}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-neutral-700 bg-neutral-900 p-1"
        />
        <input
          value={component.color}
          onChange={(event) => onColorChange(event.target.value)}
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
        />
      </div>

      <div className="mt-4 grid grid-cols-8 gap-2">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onColorChange(color)}
            className={`h-6 rounded border transition ${
              component.color.toLowerCase() === color.toLowerCase()
                ? 'border-white'
                : 'border-neutral-700 hover:border-neutral-400'
            }`}
            style={{ backgroundColor: color }}
            aria-label={`Set color ${color}`}
          />
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Transparency
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              value={component.transparency}
              onChange={(event) => onTransparencyChange(event.target.value)}
              className="w-16 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-sm text-neutral-100 outline-none focus:border-amber-500"
            />
            <span className="text-sm text-neutral-500">%</span>
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={component.transparency}
          onChange={(event) => onTransparencyChange(event.target.value)}
          className="mt-3 w-full accent-amber-500"
        />
      </div>

      {component.type === 'object' && (
        <div className="mt-5 space-y-3">
          {component.kind === 'hole' && (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Diameter"
                value={component.params.diameter ?? 10}
                onChange={(value) => onParamChange('diameter', value)}
              />
              <NumberField
                label="Cut depth"
                value={component.params.depth ?? 3}
                onChange={(value) => onParamChange('depth', value)}
              />
            </div>
          )}

          {component.kind === 'knob' && (
            <div className="space-y-3 rounded border border-neutral-800 bg-neutral-900/70 p-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Diameter"
                  value={component.params.diameter ?? 18}
                  onChange={(value) => onParamChange('diameter', value)}
                />
                <NumberField
                  label="Height"
                  value={component.params.depth ?? 12}
                  onChange={(value) => onParamChange('depth', value)}
                />
                <NumberField
                  label="Skirt"
                  value={component.params.skirtDiameter ?? 22}
                  onChange={(value) => onParamChange('skirtDiameter', value)}
                />
                <NumberField
                  label="Pointer"
                  value={component.params.pointerLength ?? 8}
                  onChange={(value) => onParamChange('pointerLength', value)}
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                  Pointer color
                </span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={component.params.pointerColor ?? '#f4f1de'}
                    onChange={(event) => onParamChange('pointerColor', event.target.value, { numeric: false })}
                    className="h-9 w-12 cursor-pointer rounded border border-neutral-700 bg-neutral-900 p-1"
                  />
                  <input
                    value={component.params.pointerColor ?? '#f4f1de'}
                    onChange={(event) => onParamChange('pointerColor', event.target.value, { numeric: false })}
                    className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
                  />
                </div>
              </label>
            </div>
          )}

          {component.kind === 'generic' && (
            <div className="grid grid-cols-3 gap-3">
              <NumberField
                label="Width"
                value={component.params.width ?? 14}
                onChange={(value) => onParamChange('width', value)}
              />
              <NumberField
                label="Height"
                value={component.params.height ?? 14}
                onChange={(value) => onParamChange('height', value)}
              />
              <NumberField
                label="Depth"
                value={component.params.depth ?? 6}
                onChange={(value) => onParamChange('depth', value)}
              />
            </div>
          )}

          <button
            type="button"
            onClick={onDelete}
            className="w-full rounded border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm font-medium text-red-100 transition hover:bg-red-900/60"
          >
            Delete object
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const assembly = useAssembly()
  const projectInputRef = useRef(null)
  const [viewportCommand, setViewportCommand] = useState(null)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [mountDialogOpen, setMountDialogOpen] = useState(false)
  const [activeHostId, setActiveHostId] = useState(null)
  const selectedPcb = assembly.selectedComponent?.type === 'pcb'
    ? assembly.pcbs.find((pcb) => pcb.id === assembly.selectedComponent?.id)
    : null
  const selectedObject = assembly.selectedComponent?.type === 'object'
    ? assembly.assemblyObjects.find((object) => object.id === assembly.selectedComponent?.id)
    : null
  const selectedHoleObjects = (assembly.selectedObjectIds || [])
    .map((id) => assembly.assemblyObjects.find((object) => object.id === id))
    .filter((object) => object?.class === 'hole')
  const isMultiHoleSelection = selectedHoleObjects.length > 1
    && selectedHoleObjects.length === (assembly.selectedObjectIds || []).length

  const settingsComponent = isMultiHoleSelection
    ? {
      type: 'holeSelection',
      label: `${selectedHoleObjects.length} holes selected`,
      count: selectedHoleObjects.length,
      hostSummary: [...new Set(selectedHoleObjects.map((object) => object.hostId))].join(', '),
    }
    : selectedPcb
    ? {
      type: 'pcb',
      label: basename(selectedPcb.path),
      color: selectedPcb.color || '#1a7a4a',
      transparency: selectedPcb.transparency ?? 0,
    }
    : selectedObject
      ? {
        type: 'object',
        kind: selectedObject.class,
        label: selectedObject.label,
        hostId: selectedObject.hostId,
        panelPosition: objectToPanelPosition(selectedObject),
        color: selectedObject.material?.color || '#111111',
        transparency: selectedObject.transparency ?? 0,
        params: selectedObject.params || {},
      }
      : null

  const updateSelectedObject = (updates) => {
    if (!selectedObject) return
    assembly.updateAssemblyObject(selectedObject.id, updates)
  }

  const updateSelectedObjectParam = (name, value, options = {}) => {
    if (options.numeric === false) {
      updateSelectedObject({ params: { [name]: value } })
      return
    }

    const number = Number(value)
    if (!Number.isFinite(number)) return
    updateSelectedObject({ params: { [name]: Math.max(0.1, number) } })
  }

  const updateSelectedObjectPositionAxis = (axis, value) => {
    if (!selectedObject) return
    const number = Number(value)
    if (!Number.isFinite(number)) return
    const position = panelPositionToObjectPosition(selectedObject, axis, number)
    assembly.updateAssemblyObjectTransform(
      selectedObject.id,
      position,
      selectedObject.rotation || [0, 0, 0],
    )
  }

  const deleteSelectedObject = () => {
    if (!selectedObject) return
    assembly.removeAssemblyObject(selectedObject.id)
  }

  const settingsHosts = assembly.chassisComponents
  const selectedHost = selectedObject
    ? settingsHosts.find((host) => host.id === selectedObject.hostId)
    : null
  const defaultHost = settingsHosts.find((host) => host.id === 'front_panel')
    || settingsHosts[0]
    || null
  const activeHost = settingsHosts.find((host) => host.id === activeHostId)
    || selectedHost
    || defaultHost

  useEffect(() => {
    if (!defaultHost) {
      setActiveHostId(null)
      return
    }

    if (!activeHostId || !settingsHosts.some((host) => host.id === activeHostId)) {
      setActiveHostId(defaultHost.id)
    }
  }, [activeHostId, defaultHost, settingsHosts])

  useEffect(() => {
    if (!isMultiHoleSelection && mountDialogOpen) {
      setMountDialogOpen(false)
    }
  }, [isMultiHoleSelection, mountDialogOpen])

  const isBaking = assembly.drillingStatus.componentId === activeHost?.id
    && assembly.drillingStatus.state === 'loading'
  const isDrilling = assembly.drillingStatus.state === 'loading'

  const sendViewportCommand = (type) => {
    if (type === 'fit') {
      assembly.clearSelection()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setViewportCommand({ type, timestamp: Date.now() })
        })
      })
      return
    }

    setViewportCommand({ type, timestamp: Date.now() })
  }

  const insertObject = (className, hostId = activeHost?.id) => {
    if (hostId) setActiveHostId(hostId)
    assembly.addAssemblyObject(className, hostId)
  }

  const insertObjectGrid = (options) => {
    const hostId = options?.hostId || activeHost?.id
    if (hostId) setActiveHostId(hostId)
    assembly.addAssemblyObjectGrid({ ...options, hostId })
  }

  const selectObject = (id, eventOrOptions = {}) => {
    const object = assembly.assemblyObjects.find((candidate) => candidate.id === id)
    const additive = Boolean(
      eventOrOptions.additive
      || eventOrOptions.shiftKey
      || eventOrOptions.metaKey
      || eventOrOptions.ctrlKey
      || eventOrOptions.nativeEvent?.shiftKey
      || eventOrOptions.nativeEvent?.metaKey
      || eventOrOptions.nativeEvent?.ctrlKey,
    )
    if (object?.hostId) setActiveHostId(object.hostId)
    assembly.selectAssemblyObject(id, { additive })
  }

  const selectHost = (id) => {
    setActiveHostId(id)
    assembly.clearSelection()
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950">
      <input
        ref={projectInputRef}
        type="file"
        className="hidden"
        webkitdirectory=""
        directory=""
        multiple
        onChange={(event) => {
          assembly.importProjectFromFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <TopBar
        projectName={assembly.assemblyMeta?.project?.name}
        activeHost={activeHost}
        pcbs={assembly.pcbs}
        selectedPcbId={assembly.selectedPcbId}
        transformMode={assembly.transformMode}
        pcbStatus={assembly.pcbStatus}
        persistenceStatus={assembly.persistenceStatus}
        drillingStatus={assembly.drillingStatus}
        onNewProject={() => setNewProjectOpen(true)}
        onExport={() => setExportOpen(true)}
        onImport={() => projectInputRef.current?.click()}
        onSave={assembly.savePositions}
        onSaveAs={assembly.saveAsProject}
        onLoad={assembly.loadSavedPositions}
        onReset={assembly.reset}
        onInsert={insertObject}
        onInsertGrid={insertObjectGrid}
        onBake={() => activeHost && assembly.drillPanel(activeHost.id)}
        onAddPcb={assembly.addPcb}
        onRemovePcb={assembly.removePcb}
        onSelectPcb={assembly.selectPcb}
        onTransformMode={assembly.setTransformMode}
        onViewCommand={sendViewportCommand}
        isBaking={isBaking}
      />
      <DrillingOverlay visible={isDrilling} />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <NewProjectDialog
            open={newProjectOpen}
            onClose={() => setNewProjectOpen(false)}
            onCreate={assembly.createNewProject}
          />
          <ExportDialog
            open={exportOpen}
            panels={assembly.chassisComponents}
            onClose={() => setExportOpen(false)}
          />
          <ImportReviewDialog
            review={assembly.importReview}
            panels={assembly.chassisComponents}
            onAccept={assembly.acceptImportReview}
            onRemoveDetected={assembly.removeDetectedImportHoles}
          />
          <MountElementDialog
            open={mountDialogOpen}
            holes={selectedHoleObjects}
            onClose={() => setMountDialogOpen(false)}
            onMount={(element) => {
              if (!element.className) return
              assembly.mountObjectsOnHoles(
                element.className,
                selectedHoleObjects.map((object) => object.id),
              )
              setMountDialogOpen(false)
            }}
          />
          <ComponentSettings
            component={settingsComponent}
            hosts={settingsHosts}
            onColorChange={assembly.setSelectedComponentColor}
            onTransparencyChange={assembly.setSelectedComponentTransparency}
            onLabelChange={(label) => updateSelectedObject({ label })}
            onHostChange={(hostId) => {
              if (!selectedObject) return
              setActiveHostId(hostId)
              assembly.moveAssemblyObjectToHost(selectedObject.id, hostId)
            }}
            onPositionChange={updateSelectedObjectPositionAxis}
            onParamChange={updateSelectedObjectParam}
            onDelete={deleteSelectedObject}
            onMount={() => setMountDialogOpen(true)}
            onClose={assembly.clearSelection}
          />
          <Viewer3D
            chassisComponents={assembly.chassisComponents}
            assemblyMeta={assembly.assemblyMeta}
            pcbs={assembly.pcbs}
            assemblyObjects={assembly.assemblyObjects}
            selectedPcbId={assembly.selectedPcbId}
            selectedObjectId={assembly.selectedObjectId}
            selectedObjectIds={assembly.selectedObjectIds}
            activeHostId={activeHost?.id}
            transformMode={assembly.transformMode}
            selectPcb={assembly.selectPcb}
            selectAssemblyObject={selectObject}
            selectHost={selectHost}
            clearSelection={assembly.clearSelection}
            updatePcbTransform={assembly.updatePcbTransform}
            updateAssemblyObjectTransform={assembly.updateAssemblyObjectTransform}
            addAssemblyObject={insertObject}
            updateChassisComponent={assembly.updateChassisComponent}
            updateAssemblyObject={assembly.updateAssemblyObject}
            toggleTransformMode={assembly.toggleTransformMode}
            externalCameraCommand={viewportCommand}
          />
        </div>
      </div>
    </div>
  )
}
