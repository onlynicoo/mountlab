import ColorSelector from './ColorSelector'
import KnobControls from './KnobControls'
import ControlBar from './ControlBar'
import { PANEL_COLOR_OPTIONS } from '../../config/productOptions'

export default function ConfiguratorPanel({
  frontPanelColor,  setFrontPanelColor,
  rearPanelColor,   setRearPanelColor,
  linkPanels,       setLinkPanels,
  globalKnobColor,  setGlobalKnobColor,
  rowColors,        setRowColor,
  multiColorMode,
  autoRotate,       setAutoRotate,
  onReset,
}) {
  return (
    <div className="h-full overflow-y-auto bg-neutral-900 border-l border-neutral-800 p-5 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white tracking-wide">
          Sage Sound <span className="text-yellow-500">5U Pre</span>
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">3D Configurator</p>
      </div>

      <div className="h-px bg-neutral-800" />

      {/* ── Front Panel Color ─────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xs font-medium text-neutral-300 uppercase tracking-widest">
          Front Panel
        </h2>
        <ColorSelector
          options={PANEL_COLOR_OPTIONS}
          selected={frontPanelColor}
          onChange={setFrontPanelColor}
        />
      </section>

      {/* ── Link Panels toggle ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-300">Match Rear to Front</span>
        <button
          onClick={() => setLinkPanels(!linkPanels)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full
            transition-colors duration-200 focus:outline-none
            ${linkPanels ? 'bg-yellow-600' : 'bg-neutral-700'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white shadow
              transition-transform duration-200
              ${linkPanels ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* ── Rear Panel Color (visible when not linked) ────────────────── */}
      {!linkPanels && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-neutral-300 uppercase tracking-widest">
            Rear Panel
          </h2>
          <ColorSelector
            options={PANEL_COLOR_OPTIONS}
            selected={rearPanelColor}
            onChange={setRearPanelColor}
          />
        </section>
      )}

      <div className="h-px bg-neutral-800" />

      {/* ── Knob Controls ─────────────────────────────────────────────── */}
      <KnobControls
        globalKnobColor={globalKnobColor}
        setGlobalKnobColor={setGlobalKnobColor}
        rowColors={rowColors}
        setRowColor={setRowColor}
        multiColorMode={multiColorMode}
      />

      <div className="h-px bg-neutral-800" />

      {/* ── Control Bar ───────────────────────────────────────────────── */}
      <ControlBar
        autoRotate={autoRotate}
        setAutoRotate={setAutoRotate}
        onReset={onReset}
      />

      {/* Footer */}
      <p className="text-xs text-neutral-600 text-center pt-2">
        Drag to rotate · Scroll to zoom
      </p>
    </div>
  )
}
