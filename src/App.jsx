import { useAssembly } from './hooks/useAssembly'
import Viewer3D from './components/Viewer3D'
import ControlPanel from './components/ControlPanel'

function basename(filePath) {
  return filePath?.split('/').filter(Boolean).pop() || 'Component'
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

function ComponentSettings({
  component,
  hosts,
  onColorChange,
  onTransparencyChange,
  onLabelChange,
  onHostChange,
  onParamChange,
  onDelete,
  onClose,
}) {
  if (!component) return null

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
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Diameter
              </span>
              <input
                type="number"
                min="0.1"
                value={component.params.diameter ?? component.params.width ?? 10}
                onChange={(event) => onParamChange('diameter', event.target.value)}
                className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Depth
              </span>
              <input
                type="number"
                min="0.1"
                value={component.params.depth ?? 3}
                onChange={(event) => onParamChange('depth', event.target.value)}
                className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
              />
            </label>
          </div>
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
  const selectedPcb = assembly.selectedComponent?.type === 'pcb'
    ? assembly.pcbs.find((pcb) => pcb.id === assembly.selectedComponent?.id)
    : null
  const selectedObject = assembly.selectedComponent?.type === 'object'
    ? assembly.assemblyObjects.find((object) => object.id === assembly.selectedComponent?.id)
    : null

  const settingsComponent = selectedPcb
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
        color: selectedObject.material?.color || '#111111',
        transparency: selectedObject.transparency ?? 0,
        params: selectedObject.params || {},
      }
      : null

  const updateSelectedObject = (updates) => {
    if (!selectedObject) return
    assembly.updateAssemblyObject(selectedObject.id, updates)
  }

  const updateSelectedObjectParam = (name, value) => {
    const number = Number(value)
    if (!Number.isFinite(number)) return
    updateSelectedObject({ params: { [name]: Math.max(0.1, number) } })
  }

  const deleteSelectedObject = () => {
    if (!selectedObject) return
    assembly.removeAssemblyObject(selectedObject.id)
  }

  const hostOptions = assembly.chassisComponents.filter((component) => (
    component.id === 'front_panel' || component.id === 'back_panel'
  ))
  const settingsHosts = hostOptions.length > 0 ? hostOptions : assembly.chassisComponents

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950">
      <ControlPanel {...assembly} />
      <div className="relative min-w-0 flex-1">
        <ComponentSettings
          component={settingsComponent}
          hosts={settingsHosts}
          onColorChange={assembly.setSelectedComponentColor}
          onTransparencyChange={assembly.setSelectedComponentTransparency}
          onLabelChange={(label) => updateSelectedObject({ label })}
          onHostChange={(hostId) => {
            if (!selectedObject) return
            assembly.moveAssemblyObjectToHost(selectedObject.id, hostId)
          }}
          onParamChange={updateSelectedObjectParam}
          onDelete={deleteSelectedObject}
          onClose={assembly.clearSelection}
        />
        <Viewer3D
          chassisComponents={assembly.chassisComponents}
          pcbs={assembly.pcbs}
          assemblyObjects={assembly.assemblyObjects}
          selectedPcbId={assembly.selectedPcbId}
          selectedObjectId={assembly.selectedObjectId}
          transformMode={assembly.transformMode}
          selectPcb={assembly.selectPcb}
          selectAssemblyObject={assembly.selectAssemblyObject}
          clearSelection={assembly.clearSelection}
          updatePcbTransform={assembly.updatePcbTransform}
          updateAssemblyObjectTransform={assembly.updateAssemblyObjectTransform}
          toggleTransformMode={assembly.toggleTransformMode}
        />
      </div>
    </div>
  )
}
