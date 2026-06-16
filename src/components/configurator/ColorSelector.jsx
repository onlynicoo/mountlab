// Reusable color option grid
// options: [{ key, label, swatch }]
// selected: currently active key
// onChange: (key) => void

export default function ColorSelector({ options, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ key, label, swatch }) => {
        const isSelected = key === selected
        return (
          <button
            key={key}
            title={label}
            onClick={() => onChange(key)}
            className={`
              relative flex items-center justify-center
              w-9 h-9 rounded-full border-2 transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-yellow-500/60
              ${isSelected
                ? 'border-yellow-500 scale-110 shadow-lg shadow-yellow-500/30'
                : 'border-neutral-600 hover:border-neutral-400 hover:scale-105'
              }
            `}
            style={swatch ? { background: swatch } : undefined}
          >
            {/* Multi-colour: rainbow gradient swatch */}
            {!swatch && (
              <span
                className="block w-full h-full rounded-full"
                style={{
                  background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                }}
              />
            )}
            {/* Selected checkmark */}
            {isSelected && (
              <span className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="w-4 h-4 drop-shadow"
                  style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))' }}
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3 8.5l3.5 3.5 6.5-7"
                    stroke={swatch && isLightColor(swatch) ? '#111' : '#fff'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Simple luminance check to pick check color
function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}
