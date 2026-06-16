import { useState, useCallback } from 'react'
import { MULTI_COLOR_DEFAULTS } from '../config/productOptions'

const DEFAULT_STATE = {
  frontPanelColor: 'dark_blue',
  rearPanelColor:  'dark_blue',
  linkPanels:      true,
  globalKnobColor: 'black',
  rowColors: { ...MULTI_COLOR_DEFAULTS },
  multiColorMode:  false,
  autoRotate:      false,
}

export function useConfigurator() {
  const [frontPanelColor, setFrontPanelColorRaw] = useState(DEFAULT_STATE.frontPanelColor)
  const [rearPanelColor,  setRearPanelColor]      = useState(DEFAULT_STATE.rearPanelColor)
  const [linkPanels,      setLinkPanelsRaw]       = useState(DEFAULT_STATE.linkPanels)
  const [globalKnobColor, setGlobalKnobColorRaw]  = useState(DEFAULT_STATE.globalKnobColor)
  const [rowColors,       setRowColorsRaw]        = useState(DEFAULT_STATE.rowColors)
  const [multiColorMode,  setMultiColorMode]      = useState(DEFAULT_STATE.multiColorMode)
  const [autoRotate,      setAutoRotate]          = useState(DEFAULT_STATE.autoRotate)

  const setFrontPanelColor = useCallback((color) => {
    setFrontPanelColorRaw(color)
    if (linkPanels) setRearPanelColor(color)
  }, [linkPanels])

  const setGlobalKnobColor = useCallback((color) => {
    if (color === 'multi') {
      setMultiColorMode(true)
    } else {
      setMultiColorMode(false)
      setGlobalKnobColorRaw(color)
    }
  }, [])

  const setRowColor = useCallback((row, color) => {
    setRowColorsRaw(prev => ({ ...prev, [row]: color }))
  }, [])

  const setLinkPanels = useCallback((nextValue) => {
    setLinkPanelsRaw((prevValue) => {
      const resolvedValue = typeof nextValue === 'function' ? nextValue(prevValue) : nextValue

      if (!prevValue && resolvedValue) {
        setRearPanelColor(frontPanelColor)
      }

      return resolvedValue
    })
  }, [frontPanelColor])

  const reset = useCallback(() => {
    setFrontPanelColorRaw(DEFAULT_STATE.frontPanelColor)
    setRearPanelColor(DEFAULT_STATE.rearPanelColor)
    setLinkPanelsRaw(DEFAULT_STATE.linkPanels)
    setGlobalKnobColorRaw(DEFAULT_STATE.globalKnobColor)
    setRowColorsRaw({ ...MULTI_COLOR_DEFAULTS })
    setMultiColorMode(DEFAULT_STATE.multiColorMode)
    setAutoRotate(DEFAULT_STATE.autoRotate)
  }, [])

  return {
    frontPanelColor,  setFrontPanelColor,
    rearPanelColor,   setRearPanelColor,
    linkPanels,       setLinkPanels,
    globalKnobColor,  setGlobalKnobColor,
    rowColors,        setRowColor,
    multiColorMode,   setMultiColorMode,
    autoRotate,       setAutoRotate,
    reset,
  }
}
