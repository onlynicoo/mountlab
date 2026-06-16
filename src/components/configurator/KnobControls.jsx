import ColorSelector from './ColorSelector'
import { KNOB_COLOR_OPTIONS } from '../../config/productOptions'

const ROW_LABELS = {
  A: 'Row A (top)',
  B: 'Row B',
  C: 'Row C (mid)',
  D: 'Row D',
  E: 'Row E (bottom)',
  large: 'Large Knobs',
}

// Knob options excluding multi (used for per-row selectors)
const ROW_KNOB_OPTIONS = KNOB_COLOR_OPTIONS.filter(o => o.key !== 'multi')

export default function KnobControls({
  globalKnobColor,
  setGlobalKnobColor,
  rowColors,
  setRowColor,
  multiColorMode,
}) {
  return (
    <div className="space-y-4">
      {/* Global knob selector (includes multi option) */}
      <div>
        <p className="text-xs text-neutral-400 mb-2 uppercase tracking-widest">Knob Color</p>
        <ColorSelector
          options={KNOB_COLOR_OPTIONS}
          selected={multiColorMode ? 'multi' : globalKnobColor}
          onChange={setGlobalKnobColor}
        />
      </div>

      {/* Per-row selectors — visible only in multi-color mode */}
      {multiColorMode && (
        <div className="space-y-3 pt-1 border-t border-neutral-700">
          <p className="text-xs text-neutral-400 pt-2 uppercase tracking-widest">Per-Row Colors</p>
          {Object.entries(ROW_LABELS).map(([row, label]) => (
            <div key={row}>
              <p className="text-xs text-neutral-500 mb-1.5">{label}</p>
              <ColorSelector
                options={ROW_KNOB_OPTIONS}
                selected={rowColors[row] || 'black'}
                onChange={(color) => setRowColor(row, color)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
