import { useRef, useState } from 'react'
import { findMaterialPresetByColor, MATERIAL_PRESETS } from '../config/chassisComponents'
import { ASSEMBLY_OBJECT_CLASSES } from '../config/assemblyObjects'

function basename(filePath) {
  return filePath.split('/').filter(Boolean).pop() || filePath
}

function StatusLine({ status }) {
  const color = {
    idle: 'bg-neutral-600',
    loading: 'bg-amber-400',
    loaded: 'bg-emerald-400',
    saved: 'bg-emerald-400',
    saving: 'bg-amber-400',
    error: 'bg-red-500',
  }[status.state] || 'bg-neutral-600'

  return (
    <div className="flex min-h-5 items-center gap-2 text-xs text-neutral-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className={status.state === 'error' ? 'text-red-300' : ''}>
        {status.message || 'Idle'}
      </span>
    </div>
  )
}

function PanelButton({ children, variant = 'default', ...props }) {
  const classes = variant === 'danger'
    ? 'border-red-900/70 bg-red-950/50 text-red-100 hover:bg-red-900/60'
    : 'border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700'

  return (
    <button
      type="button"
      className={`w-full rounded border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
      {...props}
    >
      {children}
    </button>
  )
}

function opacityPercent(opacity) {
  const number = Number(opacity)
  if (!Number.isFinite(number)) return 100
  return Math.round(Math.min(1, Math.max(0, number)) * 100)
}

function ChassisComponentControl({
  component,
  objects,
  selectedObjectId,
  addAssemblyObject,
  removeAssemblyObject,
  selectAssemblyObject,
  updateAssemblyObject,
  updateChassisComponent,
  updateChassisComponentMaterial,
}) {
  const preset = findMaterialPresetByColor(component.material.color)
  const percent = opacityPercent(component.opacity)
  const canHostObjects = component.id === 'front_panel' || component.id === 'back_panel'

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => updateChassisComponent(component.id, { visible: !component.visible })}
          className={`rounded border px-2 py-1 text-xs font-medium transition ${
            component.visible
              ? 'border-emerald-700 bg-emerald-950/60 text-emerald-200'
              : 'border-neutral-700 bg-neutral-950 text-neutral-500'
          }`}
        >
          {component.visible ? 'On' : 'Off'}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-neutral-100">{component.label}</h3>
          <p className="text-xs text-neutral-500">{percent}% opacity</p>
        </div>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={percent}
        onChange={(event) => updateChassisComponent(component.id, {
          opacity: Number(event.target.value) / 100,
        })}
        className="mt-3 w-full accent-amber-500"
      />

      <div className="mt-3 grid grid-cols-[44px_1fr] gap-2">
        <input
          type="color"
          value={component.material.color}
          onChange={(event) => updateChassisComponentMaterial(component.id, {
            color: event.target.value,
          })}
          className="h-9 w-11 cursor-pointer rounded border border-neutral-700 bg-neutral-950 p-1"
        />
        <select
          value={preset?.id || 'custom'}
          onChange={(event) => {
            const nextPreset = MATERIAL_PRESETS.find((candidate) => candidate.id === event.target.value)
            if (!nextPreset) return

            updateChassisComponentMaterial(component.id, {
              color: nextPreset.color,
              metalness: nextPreset.metalness,
              roughness: nextPreset.roughness,
            })
          }}
          className="min-w-0 rounded border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
        >
          {MATERIAL_PRESETS.map((materialPreset) => (
            <option key={materialPreset.id} value={materialPreset.id}>
              {materialPreset.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="mt-4 border-t border-neutral-800 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Children
          </h4>
          <span className="text-xs text-neutral-600">{objects.length}</span>
        </div>
        {canHostObjects && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => addAssemblyObject('hole', component.id)}
              className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-amber-500 hover:bg-neutral-800"
            >
              + Hole
            </button>
            <button
              type="button"
              onClick={() => addAssemblyObject('knob', component.id)}
              className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-amber-500 hover:bg-neutral-800"
            >
              + Knob
            </button>
          </div>
        )}

        {objects.length === 0 && (
          <p className="mt-2 rounded border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-neutral-600">
            No child objects
          </p>
        )}

        <div className="mt-2 space-y-2">
          {objects.map((object) => {
            const objectClass = ASSEMBLY_OBJECT_CLASSES.find((candidate) => (
              candidate.id === object.class
            ))

            return (
              <div
                key={object.id}
                className={`flex items-center gap-2 rounded border px-2 py-2 text-sm transition ${
                  selectedObjectId === object.id
                    ? 'border-amber-500/80 bg-amber-950/30'
                    : 'border-neutral-800 bg-neutral-950/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => updateAssemblyObject(object.id, {
                    visible: !object.visible,
                  })}
                  className={`rounded border px-2 py-1 text-xs font-medium transition ${
                    object.visible
                      ? 'border-emerald-700 bg-emerald-950/60 text-emerald-200'
                      : 'border-neutral-700 bg-neutral-950 text-neutral-500'
                  }`}
                >
                  {object.visible ? 'On' : 'Off'}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => selectAssemblyObject(object.id)}
                >
                  <span className="block truncate text-neutral-200">{object.label}</span>
                  <span className="block text-xs text-neutral-500">
                    {objectClass?.label || object.class}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-300"
                  onClick={() => removeAssemblyObject(object.id)}
                  aria-label={`Remove ${object.label}`}
                >
                  x
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ControlPanel({
  chassisComponents,
  pcbs,
  assemblyObjects,
  selectedPcbId,
  selectedObjectId,
  transformMode,
  pcbStatus,
  persistenceStatus,
  addPcb,
  addAssemblyObject,
  importProjectFromFiles,
  removePcb,
  removeAssemblyObject,
  selectPcb,
  selectAssemblyObject,
  updateAssemblyObject,
  updateChassisComponent,
  updateChassisComponentMaterial,
  setTransformMode,
  savePositions,
  loadSavedPositions,
  reset,
}) {
  const [pcbInput, setPcbInput] = useState('')
  const projectInputRef = useRef(null)

  return (
    <aside className="h-full w-[340px] shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-5 text-neutral-100 shadow-2xl">
      <div className="space-y-5">
        <header>
          <h1 className="text-lg font-semibold tracking-[0.18em] text-white">
            3D ASSEMBLY VIEWER
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-amber-500">
            Project workspace
          </p>
        </header>

        <div className="h-px bg-neutral-800" />

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Project
          </h2>
          <input
            ref={projectInputRef}
            type="file"
            className="hidden"
            webkitdirectory=""
            directory=""
            multiple
            onChange={(event) => {
              importProjectFromFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <PanelButton onClick={() => projectInputRef.current?.click()}>
            Importa
          </PanelButton>
          <p className="text-xs leading-relaxed text-neutral-500">
            Seleziona una cartella in public/projects. I file trovati popolano chassis e PCB.
          </p>
        </section>

        <div className="h-px bg-neutral-800" />

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Chassis Components
          </h2>
          <div className="space-y-2">
            {chassisComponents.map((component) => (
              <ChassisComponentControl
                key={component.id}
                component={component}
                objects={assemblyObjects.filter((object) => object.hostId === component.id)}
                selectedObjectId={selectedObjectId}
                addAssemblyObject={addAssemblyObject}
                removeAssemblyObject={removeAssemblyObject}
                selectAssemblyObject={selectAssemblyObject}
                updateAssemblyObject={updateAssemblyObject}
                updateChassisComponent={updateChassisComponent}
                updateChassisComponentMaterial={updateChassisComponentMaterial}
              />
            ))}
          </div>
        </section>

        <div className="h-px bg-neutral-800" />

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
          <PanelButton
            onClick={async () => {
              const pcb = await addPcb(pcbInput)
              if (pcb) setPcbInput('')
            }}
            disabled={pcbStatus.state === 'loading'}
          >
            + Add PCB
          </PanelButton>
          <StatusLine status={pcbStatus} />

          <div className="space-y-2 pt-1">
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
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => selectPcb(pcb.id)}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span className="truncate text-neutral-200">{basename(pcb.path)}</span>
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-300"
                  onClick={() => removePcb(pcb.id)}
                  aria-label={`Remove ${basename(pcb.path)}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-neutral-800" />

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Transform mode
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {['translate', 'rotate'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTransformMode(mode)}
                className={`rounded border px-3 py-2 text-sm font-medium capitalize transition ${
                  transformMode === mode
                    ? 'border-amber-500 bg-amber-500 text-neutral-950'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </section>

        <div className="h-px bg-neutral-800" />

        <section className="space-y-3">
          <PanelButton onClick={savePositions} disabled={persistenceStatus.state === 'saving'}>
            Save positions
          </PanelButton>
          <PanelButton onClick={loadSavedPositions} disabled={persistenceStatus.state === 'loading'}>
            Load saved positions
          </PanelButton>
          <PanelButton variant="danger" onClick={reset}>
            Reset all
          </PanelButton>
          <StatusLine status={persistenceStatus} />
        </section>
      </div>
    </aside>
  )
}
