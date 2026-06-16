export default function ControlBar({ autoRotate, setAutoRotate, onReset }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {/* Reset */}
      <button
        onClick={onReset}
        className="
          flex-1 py-2 px-3 rounded-md text-sm font-medium
          bg-neutral-800 hover:bg-neutral-700
          text-neutral-200 hover:text-white
          border border-neutral-700 hover:border-neutral-500
          transition-all duration-150
        "
      >
        Reset
      </button>

      {/* Auto-rotate toggle */}
      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className={`
          flex-1 py-2 px-3 rounded-md text-sm font-medium
          border transition-all duration-150
          ${autoRotate
            ? 'bg-yellow-600/20 border-yellow-500/60 text-yellow-400 hover:bg-yellow-600/30'
            : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white'
          }
        `}
      >
        {autoRotate ? '⏸ Pause Rotate' : '▶ Auto Rotate'}
      </button>
    </div>
  )
}
