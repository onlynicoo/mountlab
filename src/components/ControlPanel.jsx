import { useState } from 'react'
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

const INSERT_CLASSES = ASSEMBLY_OBJECT_CLASSES.filter((objectClass) => (
  objectClass.id === 'hole' || objectClass.id === 'knob'
))

function VisibilityTree({
  chassisComponents,
  assemblyObjects,
  selectedObjectId,
  addAssemblyObject,
  selectAssemblyObject,
  removeAssemblyObject,
  updateChassisComponent,
}) {
  const [openMenuId, setOpenMenuId] = useState(null)

  return (
    <section className="rounded border border-neutral-800 bg-neutral-950/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
          Visibility
        </h2>
        <span className="text-xs text-neutral-600">{chassisComponents.length}</span>
      </div>

      <div className="space-y-1">
        {chassisComponents.map((component) => {
          const children = assemblyObjects.filter((object) => object.hostId === component.id)
          const menuOpen = openMenuId === component.id

          return (
            <div key={component.id} className="rounded bg-neutral-950">
              <div className="relative flex items-center gap-2 rounded px-2 py-2 transition hover:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => updateChassisComponent(component.id, { visible: !component.visible })}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border text-xs transition ${
                    component.visible
                      ? 'border-emerald-700 bg-emerald-950/60 text-emerald-200'
                      : 'border-neutral-700 bg-neutral-950 text-neutral-500'
                  }`}
                  aria-label={`Toggle ${component.label}`}
                >
                  Eye
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-neutral-100">{component.label}</div>
                  {children.length > 0 && (
                    <div className="text-xs text-neutral-600">
                      {children.length} item{children.length === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenMenuId(menuOpen ? null : component.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-neutral-700 bg-neutral-900 text-base leading-none text-neutral-300 transition hover:border-amber-500 hover:bg-neutral-800 hover:text-amber-200"
                  aria-label={`Add object to ${component.label}`}
                >
                  +
                </button>

                {menuOpen && (
                  <div className="absolute right-2 top-10 z-20 w-36 overflow-hidden rounded border border-neutral-700 bg-neutral-950 shadow-2xl">
                    {INSERT_CLASSES.map((objectClass) => (
                      <button
                        key={objectClass.id}
                        type="button"
                        onClick={() => {
                          addAssemblyObject(objectClass.id, component.id)
                          setOpenMenuId(null)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-neutral-200 transition hover:bg-neutral-800 hover:text-amber-200"
                      >
                        {objectClass.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {children.length > 0 && (
                <div className="ml-10 space-y-1 border-l border-neutral-800 pb-2 pl-3">
                  {children.map((object) => {
                    const objectClass = ASSEMBLY_OBJECT_CLASSES.find((candidate) => candidate.id === object.class)

                    return (
                      <div
                        key={object.id}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm transition ${
                          selectedObjectId === object.id
                            ? 'bg-amber-950/40 text-amber-100'
                            : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => selectAssemblyObject(object.id)}
                        >
                          <span className="block truncate">{object.label}</span>
                          <span className="block text-xs text-neutral-600">
                            {objectClass?.label || object.class}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAssemblyObject(object.id)}
                          className="rounded px-2 py-1 text-neutral-600 transition hover:bg-neutral-800 hover:text-red-300"
                          aria-label={`Remove ${object.label}`}
                        >
                          x
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
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
  removePcb,
  removeAssemblyObject,
  selectPcb,
  selectAssemblyObject,
  updateChassisComponent,
  setTransformMode,
  savePositions,
  loadSavedPositions,
  reset,
}) {
  const [pcbInput, setPcbInput] = useState('')

  return (
    <aside className="h-full w-[268px] shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-4 text-neutral-100 shadow-2xl">
      <div className="space-y-4">
        <header>
          <h1 className="text-base font-semibold tracking-[0.16em] text-white">
            ASSEMBLY BROWSER
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-amber-500">
            Files and transforms
          </p>
        </header>

        <div className="h-px bg-neutral-800" />

        <VisibilityTree
          chassisComponents={chassisComponents}
          assemblyObjects={assemblyObjects}
          selectedObjectId={selectedObjectId}
          addAssemblyObject={addAssemblyObject}
          removeAssemblyObject={removeAssemblyObject}
          selectAssemblyObject={selectAssemblyObject}
          updateChassisComponent={updateChassisComponent}
        />

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
