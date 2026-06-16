import { useMemo } from 'react'
import * as THREE from 'three'
import { FIXED_MATERIALS, MATERIALS } from '../../config/materialDefinitions'

let cachedWoodTexture = null
let cachedPanelArtwork = null
let cachedRearPanelArtwork = null

const W = 1.58
const H = 0.95
const D = 0.18
const EAR_W = 0.065
const PANEL_W = 1.42
const PANEL_H = 0.90

const FRONT_Z = D / 2 + 0.006
const OVERLAY_Z = FRONT_Z + 0.0065
const KNOB_Z = FRONT_Z + 0.028
const SWITCH_Z = FRONT_Z + 0.018
const LED_Z = FRONT_Z + 0.010
const REAR_Z = -(D / 2 + 0.004)
const REAR_OVERLAY_Z = REAR_Z - 0.006
const REAR_CONN_Z = REAR_Z - 0.010

const LEFT_X = [-0.56, -0.43, -0.30, -0.17, -0.04, 0.09]
const RIGHT_TOP_X = [0.22, 0.33, 0.44, 0.55, 0.64]
const RIGHT_MID_X = [0.20, 0.31, 0.42, 0.53, 0.64]
const EQ_TOP_X = [0.22, 0.33, 0.44, 0.55, 0.64]
const EQ_BOTTOM_X = [0.15, 0.25, 0.35, 0.45, 0.55, 0.65]

const ROW_Y = {
  top: 0.25,
  row1: 0.12,
  row2: -0.01,
  row3: -0.14,
  row4: -0.27,
  row5: -0.39,
}

const KNOB_SIZES = {
  sm: { face: 0.028, body: 0.028, depth: 0.03, flange: 0.03 },
  md: { face: 0.028, body: 0.028, depth: 0.03, flange: 0.03 },
  lg: { face: 0.028, body: 0.028, depth: 0.03, flange: 0.03 },
}

const TOP_LEFT_KNOBS = [
  { name: 'knob_row_A_01', x: LEFT_X[0], y: ROW_Y.top, label: 'LINE', size: 'md', group: 'A', angle: -0.7 },
  { name: 'knob_row_A_02', x: LEFT_X[1], y: ROW_Y.top, label: 'PHONO', size: 'md', group: 'A', angle: -0.45 },
  { name: 'knob_row_A_03', x: LEFT_X[3], y: ROW_Y.top, label: 'FX 1', size: 'md', group: 'A', angle: -0.62 },
  { name: 'knob_row_A_04', x: LEFT_X[4], y: ROW_Y.top, label: 'FX 2', size: 'md', group: 'A', angle: -0.54 },
  { name: 'knob_row_A_05', x: LEFT_X[5], y: ROW_Y.top, label: 'PAN', size: 'sm', group: 'A', angle: 0.02 },
  { name: 'knob_row_A_06', x: 0.21, y: ROW_Y.top, label: 'MID\nTOPS', size: 'sm', group: 'A', angle: -0.08 },
]

const LEFT_ROWS = [
  { group: 'B', y: ROW_Y.row1, aux: 'AUX1', center: { type: 'knob', name: 'knob_row_B_07', label: 'AUX', angle: -0.03 } },
  { group: 'C', y: ROW_Y.row2, aux: 'AUX2', center: { type: 'knob', name: 'knob_row_C_07', label: 'TONE', angle: -0.1 } },
  { group: 'D', y: ROW_Y.row3, aux: 'AUX3', center: { type: 'toggle', label: 'SLOPE' } },
  { group: 'E', y: ROW_Y.row4, aux: 'AUX4' },
  { group: 'E', y: ROW_Y.row5, aux: 'AUX5' },
]

const RIGHT_CHANNELS = [
  { name: 'knob_large_01', x: RIGHT_TOP_X[0], label: 'SUB', angle: -0.72 },
  { name: 'knob_large_02', x: RIGHT_TOP_X[1], label: 'BASS', angle: -0.64 },
  { name: 'knob_large_03', x: RIGHT_TOP_X[2], label: 'LOW\nMIDS', angle: -0.58 },
  { name: 'knob_large_04', x: RIGHT_TOP_X[3], label: 'HIGH\nMIDS', angle: -0.53 },
  { name: 'knob_large_05', x: RIGHT_TOP_X[4], label: 'TOPS', angle: -0.61 },
]

const MID_SECTION_KNOBS = [
  { name: 'knob_large_06', x: RIGHT_MID_X[0], y: ROW_Y.row2, label: 'TONE\nSUB', angle: -0.1 },
  { name: 'knob_large_07', x: RIGHT_MID_X[1], y: ROW_Y.row2, label: 'FREQ', footer: '-Hz     +Hz', angle: 0.04 },
  { name: 'knob_large_08', x: RIGHT_MID_X[2], y: ROW_Y.row2, label: 'GAIN\nMIDS', footer: '-dB     +dB', angle: 0.0 },
  { name: 'knob_large_09', x: RIGHT_MID_X[3], y: ROW_Y.row2, label: 'FREQ', footer: '-Hz     +Hz', angle: -0.05 },
  { name: 'knob_large_10', x: RIGHT_MID_X[4], y: ROW_Y.row2, label: 'GAIN\nTOPS', footer: '-dB     +dB', angle: -0.02 },
  { name: 'knob_large_10b', x: 0.69, y: ROW_Y.row2, label: 'FREQ', footer: '-Hz     +Hz', angle: -0.02 },
]

const FILTER_SECTION = [
  { name: 'knob_large_11', x: 0.30, y: ROW_Y.row3, label: 'HP', footer: 'OFF    +Hz', angle: -0.58 },
  { name: 'knob_large_12', x: 0.41, y: ROW_Y.row3, label: 'HP\nMIDS', footer: 'OFF    +Hz', angle: -0.54 },
  { name: 'knob_large_13', x: 0.52, y: ROW_Y.row3, label: 'LP', footer: '-Hz    OFF', angle: -0.48 },
  { name: 'knob_large_14', x: 0.63, y: ROW_Y.row3, label: 'LP', footer: '-Hz    OFF', angle: -0.44 },
]

const EQ_TOP = [
  { name: 'knob_large_15', x: EQ_TOP_X[0], y: ROW_Y.row4, label: '60Hz', footer: '-dB     +dB', angle: -0.03 },
  { name: 'knob_large_16', x: EQ_TOP_X[1], y: ROW_Y.row4, label: '100Hz', footer: '-dB     +dB', angle: -0.02 },
  { name: 'knob_large_17', x: EQ_TOP_X[2], y: ROW_Y.row4, label: '500Hz', footer: '-dB     +dB', angle: -0.01 },
  { name: 'knob_large_18', x: EQ_TOP_X[3], y: ROW_Y.row4, label: '2kHz', footer: '-dB     +dB', angle: 0.04 },
  { name: 'knob_large_19', x: EQ_TOP_X[4], y: ROW_Y.row4, label: '8kHz', footer: '-dB     +dB', angle: 0.02 },
]

const EQ_BOTTOM = [
  { name: 'knob_large_20', x: EQ_BOTTOM_X[0], y: ROW_Y.row5, label: '40Hz', footer: '-dB     +dB', angle: -0.04 },
  { name: 'knob_large_21', x: EQ_BOTTOM_X[1], y: ROW_Y.row5, label: '80Hz', footer: '-dB     +dB', angle: -0.02 },
  { name: 'knob_large_22', x: EQ_BOTTOM_X[2], y: ROW_Y.row5, label: '250Hz', footer: '-dB     +dB', angle: -0.01 },
  { name: 'knob_large_23', x: EQ_BOTTOM_X[3], y: ROW_Y.row5, label: '1kHz', footer: '-dB     +dB', angle: 0.03 },
  { name: 'knob_large_24', x: EQ_BOTTOM_X[4], y: ROW_Y.row5, label: '4kHz', footer: '-dB     +dB', angle: 0.05 },
  { name: 'knob_large_25', x: EQ_BOTTOM_X[5], y: ROW_Y.row5, label: '16kHz', footer: '-dB     +dB', angle: 0.04 },
]

const FRONT_SCREWS = [
  [-0.39, 0.33],
  [0.39, 0.33],
  [-0.58, 0.12],
  [0.65, 0.12],
  [-0.58, -0.23],
  [0.65, -0.23],
  [-0.04, -0.41],
  [0.39, -0.41],
]

function getWoodTexture() {
  if (cachedWoodTexture) return cachedWoodTexture

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  ctx.fillStyle = '#8b6333'
  ctx.fillRect(0, 0, 512, 512)

  for (let i = 0; i < 80; i += 1) {
    const x = Math.random() * 512
    const width = 1 + Math.random() * 4
    const alpha = 0.05 + Math.random() * 0.15

    ctx.strokeStyle = `rgba(50, 25, 0, ${alpha})`
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(
      x + (Math.random() - 0.5) * 30, 160,
      x + (Math.random() - 0.5) * 30, 350,
      x + (Math.random() - 0.5) * 20, 512,
    )
    ctx.stroke()
  }

  cachedWoodTexture = new THREE.CanvasTexture(canvas)
  cachedWoodTexture.wrapS = THREE.RepeatWrapping
  cachedWoodTexture.wrapT = THREE.RepeatWrapping
  cachedWoodTexture.repeat.set(2, 2)
  cachedWoodTexture.colorSpace = THREE.SRGBColorSpace

  return cachedWoodTexture
}

function resolveMaterial(colorKey) {
  const definition = MATERIALS[colorKey] || MATERIALS.black

  if (definition.isWood) {
    return {
      map: getWoodTexture(),
      roughness: definition.roughness,
      metalness: definition.metalness,
    }
  }

  return {
    color: definition.color,
    roughness: definition.roughness,
    metalness: definition.metalness,
  }
}

function footerFor(label) {
  if (label === 'PAN') return 'L        R'
  if (label === 'HP') return 'OFF    +Hz'
  if (label === 'LP') return '-Hz    OFF'
  if (label === 'FREQ') return '-Hz    +Hz'
  if (label === 'GAIN') return '-dB    +dB'
  if (label === 'TONE') return '-dB    +dB'
  if (label === 'AUX') return 'OFF    +dB'
  if (label === 'LINE' || label === 'PHONO') return 'OFF    +dB'
  return '-dB    +dB'
}

function drawFrame(ctx, x, y, width, height, mapX, mapY) {
  const left = mapX(x - width / 2)
  const right = mapX(x + width / 2)
  const top = mapY(y + height / 2)
  const bottom = mapY(y - height / 2)
  const notch = Math.min((right - left) * 0.16, 24)

  ctx.beginPath()
  ctx.moveTo(left, bottom)
  ctx.lineTo(left, top + notch)
  ctx.lineTo(left + notch, top)
  ctx.lineTo(right - notch, top)
  ctx.lineTo(right, top + notch)
  ctx.lineTo(right, bottom)
  ctx.stroke()
}

function drawLabel(ctx, text, x, y, mapX, mapY, fontSize) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const lines = text.split('\n')
  const startY = mapY(y) - ((lines.length - 1) * fontSize * 0.62) / 2

  lines.forEach((line, index) => {
    ctx.fillText(line, mapX(x), startY + index * fontSize * 0.78)
  })
}

function drawFooter(ctx, text, x, y, mapX, mapY) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '500 30px Arial, sans-serif'
  ctx.fillText(text, mapX(x), mapY(y))
}

function drawKnobCell(ctx, control, mapX, mapY, footer = footerFor(control.label)) {
  drawFrame(ctx, control.x, control.y, control.size === 'md' ? 0.12 : 0.11, 0.11, mapX, mapY)
  ctx.font = '700 52px Arial, sans-serif'
  drawLabel(ctx, control.label, control.x, control.y + 0.072, mapX, mapY, 50)
  drawFooter(ctx, footer, control.x, control.y - 0.070, mapX, mapY)
}

function drawTallChannel(ctx, channel, mapX, mapY) {
  drawFrame(ctx, channel.x, 0.185, 0.105, 0.24, mapX, mapY)
  ctx.font = '700 54px Arial, sans-serif'
  drawLabel(ctx, channel.label, channel.x, 0.322, mapX, mapY, 48)
  drawFooter(ctx, 'OFF    +dB', channel.x, 0.065, mapX, mapY)
}

function drawToggleCell(ctx, label, x, y, mapX, mapY, footer) {
  drawFrame(ctx, x, y, 0.10, 0.08, mapX, mapY)
  ctx.font = '700 44px Arial, sans-serif'
  drawLabel(ctx, label, x, y + 0.052, mapX, mapY, 42)
  if (footer) {
    drawFooter(ctx, footer, x, y - 0.038, mapX, mapY)
  }
}

function createPanelArtworkTexture() {
  if (cachedPanelArtwork) return cachedPanelArtwork

  const canvas = document.createElement('canvas')
  canvas.width = 4096
  canvas.height = Math.round(canvas.width * (PANEL_H / PANEL_W))

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  const mapX = (x) => ((x / PANEL_W) + 0.5) * canvas.width
  const mapY = (y) => ((0.5 - (y / PANEL_H)) * canvas.height)

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#cfac5b'
  ctx.fillStyle = '#cfac5b'
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  TOP_LEFT_KNOBS.forEach((control) => drawKnobCell(ctx, control, mapX, mapY))
  drawToggleCell(ctx, 'FX1   FX2', -0.26, ROW_Y.top + 0.015, mapX, mapY, 'TOPS  FULL RANGE  MIDS')

  LEFT_ROWS.forEach((row) => {
    const labels = [row.aux, 'BASS', 'TOPS', 'FX 1', 'FX 2', 'PAN']
    labels.forEach((label, index) => {
      drawKnobCell(ctx, { label, x: LEFT_X[index], y: row.y, size: 'sm' }, mapX, mapY)
    })

    if (row.center?.type === 'knob') {
      drawKnobCell(ctx, { label: row.center.label, x: 0.21, y: row.y, size: 'sm' }, mapX, mapY)
    }

    if (row.center?.type === 'toggle') {
      drawToggleCell(ctx, row.center.label, 0.21, row.y + 0.002, mapX, mapY, 'SHALLOW   STEEP')
    }
  })

  RIGHT_CHANNELS.forEach((channel) => drawTallChannel(ctx, channel, mapX, mapY))
  MID_SECTION_KNOBS.forEach((knob) => drawKnobCell(ctx, { ...knob, size: 'sm' }, mapX, mapY, knob.footer))

  drawToggleCell(ctx, 'SLOPE', 0.20, ROW_Y.row3 + 0.002, mapX, mapY, 'SHALLOW   STEEP')
  FILTER_SECTION.forEach((knob) => drawKnobCell(ctx, { ...knob, size: 'sm' }, mapX, mapY, knob.footer))
  drawToggleCell(ctx, 'FILTERS', 0.66, ROW_Y.row3 + 0.002, mapX, mapY, 'OFF   ON')

  EQ_TOP.forEach((knob) => drawKnobCell(ctx, { ...knob, size: 'sm' }, mapX, mapY, knob.footer))
  EQ_BOTTOM.forEach((knob) => drawKnobCell(ctx, { ...knob, size: 'sm' }, mapX, mapY, knob.footer))

  // Vertical separator between channel strip and master section
  ctx.beginPath()
  ctx.moveTo(mapX(0.145), mapY(PANEL_H / 2))
  ctx.lineTo(mapX(0.145), mapY(-PANEL_H / 2))
  ctx.stroke()

  ctx.font = '700 118px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('SAGE',  mapX(-0.61), mapY(-0.28))
  ctx.fillText('SOUND', mapX(-0.61), mapY(-0.37))
  ctx.textAlign = 'center'

  drawToggleCell(ctx, 'POWER', 0.64, 0.33, mapX, mapY)

  cachedPanelArtwork = new THREE.CanvasTexture(canvas)
  cachedPanelArtwork.colorSpace = THREE.SRGBColorSpace
  cachedPanelArtwork.needsUpdate = true

  return cachedPanelArtwork
}

function createRearPanelArtworkTexture() {
  if (cachedRearPanelArtwork) return cachedRearPanelArtwork

  const canvas = document.createElement('canvas')
  canvas.width = 4096
  canvas.height = Math.round(canvas.width * (PANEL_H / PANEL_W))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Mirrored X: mesh is rotated π around Y, so canvas-left = viewer-left from behind
  const mapX = (x) => (0.5 - x / PANEL_W) * canvas.width
  const mapY = (y) => (0.5 - y / PANEL_H) * canvas.height
  const sx = canvas.width / PANEL_W

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#cfac5b'
  ctx.fillStyle = '#cfac5b'
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  function rLabel(text, x, y, size = 30, align = 'center') {
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${size}px Arial, sans-serif`
    const lines = text.split('\n')
    const lh = size * 1.25
    lines.forEach((line, i) => {
      ctx.fillText(line, mapX(x), mapY(y) + (i - (lines.length - 1) / 2) * lh)
    })
  }

  function rFrame(x, y, w, h) {
    const a = mapX(x - w / 2), b = mapX(x + w / 2)
    const left = Math.min(a, b), right = Math.max(a, b)
    const top = mapY(y + h / 2), bottom = mapY(y - h / 2)
    const notch = Math.min((right - left) * 0.12, 16)
    ctx.beginPath()
    ctx.moveTo(left, bottom)
    ctx.lineTo(left, top + notch)
    ctx.lineTo(left + notch, top)
    ctx.lineTo(right - notch, top)
    ctx.lineTo(right, top + notch)
    ctx.lineTo(right, bottom)
    ctx.stroke()
  }

  function rRect(x, y, w, h, fill) {
    const cx = mapX(x), cy = mapY(y)
    const pw = w * sx, ph = h * (canvas.height / PANEL_H)
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph); ctx.fillStyle = '#cfac5b' }
    ctx.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph)
  }

  function rXLR(x, y) {
    const r = 0.044 * sx
    const cx = mapX(x), cy = mapY(y)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke()
    ;[90, 210, 330].forEach((deg) => {
      const rad = (deg - 90) * Math.PI / 180
      ctx.beginPath()
      ctx.arc(cx + Math.cos(rad) * r * 0.38, cy + Math.sin(rad) * r * 0.38, r * 0.10, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  function rTRS(x, y) {
    const r = 0.020 * sx
    const cx = mapX(x), cy = mapY(y)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2); ctx.stroke()
  }

  function rRCA(x, y) {
    const r = 0.018 * sx
    const cx = mapX(x), cy = mapY(y)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2); ctx.fill()
  }

  // ── LEFT SECTION (viewer's left from behind = model x > 0) ───────────────
  // "HOLD LEFT & RIGHT BUTTONS TO SAVE SETTINGS" frame
  rFrame(0.44, 0.37, 0.44, 0.065)
  rLabel('HOLD LEFT & RIGHT BUTTONS', 0.44, 0.384, 24)
  rLabel('TO SAVE SETTINGS.', 0.44, 0.356, 24)

  // LCD display
  rRect(0.50, 0.20, 0.27, 0.10, '#0a1828')
  rRect(0.50, 0.20, 0.24, 0.075, null)  // inner bezel

  // Nav cross (4 dots + center)
  const navCx = mapX(0.36), navCy = mapY(0.20), navR = 0.028 * sx
  ;[0, 90, 180, 270].forEach((deg) => {
    const rad = deg * Math.PI / 180
    ctx.beginPath()
    ctx.arc(navCx + Math.cos(rad) * navR, navCy + Math.sin(rad) * navR, navR * 0.45, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.beginPath(); ctx.arc(navCx, navCy, navR * 0.45, 0, Math.PI * 2); ctx.fill()

  // Encoder knob circle
  const encCx = mapX(0.28), encCy = mapY(0.20)
  ctx.beginPath(); ctx.arc(encCx, encCy, 0.034 * sx, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(encCx, encCy, 0.018 * sx, 0, Math.PI * 2); ctx.stroke()

  // UPDATE PORT
  rFrame(0.48, 0.04, 0.24, 0.075)
  rLabel('UPDATE\nPORT', 0.48, 0.040, 26)
  // USB-B connector outline
  const usbCx = mapX(0.30), usbCy = mapY(0.04)
  ctx.strokeRect(usbCx - 11, usbCy - 14, 22, 28)

  // Power switch
  rLabel('OFF', 0.66, -0.15, 28)
  rLabel('ON', 0.66, -0.26, 28)
  const swCx = mapX(0.66), swCy = mapY(-0.20)
  ctx.strokeRect(swCx - 9, swCy - 18, 18, 36)

  // Caution box
  rFrame(0.37, -0.20, 0.50, 0.28)
  rLabel('SAGE SOUND: 5U PREAMP', 0.37, -0.10, 22)
  rLabel('CAUTION', 0.37, -0.17, 32)
  rLabel('NOT SUITABLE FOR CHILDREN', 0.37, -0.23, 19)
  rLabel('NO USER-SERVICEABLE PARTS INSIDE', 0.37, -0.28, 19)
  rLabel('USE ONLY SUPPLIED OR IDENTICAL PSU', 0.37, -0.32, 18)

  // CE / voltage / inserts spec boxes
  rFrame(0.60, -0.35, 0.18, 0.075)
  rLabel('VOLTAGE: 15V DC\nPOWER: 10W', 0.60, -0.35, 20)
  rFrame(0.37, -0.35, 0.18, 0.075)
  rLabel('INSERTS:\nTIP=OUT\nRING=IN', 0.37, -0.35, 20)

  // ── CENTER-LEFT (S/PDIF, AES/EBU) ────────────────────────────────────────
  rLabel('S/PDIF\nINPUT', 0.22, 0.10, 26)
  rTRS(0.22, 0.00)

  rFrame(0.12, 0.05, 0.14, 0.14)
  rLabel('AES/EBU\nOUTPUT', 0.12, 0.10, 26)
  rXLR(0.12, -0.01)

  // ── CENTER (PHONO, LINE IN, FX/MIX/INSERT, XLRs) ─────────────────────────
  // PHONO
  rFrame(-0.02, 0.37, 0.13, 0.13)
  rLabel('PHONO', -0.02, 0.42, 26)
  rRCA(-0.01, 0.33); rRCA(-0.06, 0.33)

  // LINE IN
  rFrame(-0.17, 0.37, 0.14, 0.13)
  rLabel('LEFT  RIGHT\nLINE IN', -0.17, 0.42, 22)
  rRCA(-0.12, 0.33); rRCA(-0.22, 0.33)

  // FX 1/2 SEND OUT
  rLabel('FX 1  FX 2\nSEND OUT', -0.08, 0.21, 22)
  rTRS(-0.04, 0.12); rTRS(-0.12, 0.12)

  // MIX OUT
  rLabel('LEFT  RIGHT\nMIX OUT', -0.24, 0.21, 22)
  rTRS(-0.20, 0.12); rTRS(-0.28, 0.12)

  // INSERT
  rLabel('LEFT  RIGHT\nINSERT', -0.38, 0.21, 22)
  rTRS(-0.34, 0.12); rTRS(-0.42, 0.12)

  // LEFT XLR outputs
  rLabel('LEFT', -0.00, 0.09, 28)
  const leftXs = [-0.04, -0.13, -0.22, -0.31, -0.40]
  const chLabels = ['SUB', 'BASS', 'L/MID', 'H/MID', 'TOPS']
  leftXs.forEach((x, i) => {
    rLabel(chLabels[i], x, 0.09, 24)
    rXLR(x, 0.01)
    rTRS(x, -0.07)
  })

  // RIGHT XLR outputs
  rLabel('RIGHT', -0.00, -0.11, 28)
  leftXs.forEach((x, i) => {
    rLabel(chLabels[i], x, -0.11, 24)
    rXLR(x, -0.18)
    rTRS(x, -0.27)
  })

  // ── RIGHT SECTION (INSERT + AUX 1-5, viewer's right = model x < 0) ───────
  // Vertical separator
  ctx.beginPath()
  ctx.moveTo(mapX(-0.48), mapY(PANEL_H / 2))
  ctx.lineTo(mapX(-0.48), mapY(-PANEL_H / 2))
  ctx.stroke()

  rLabel('LINE LEVEL: USE JACK\nMIC LEVEL: USE XLR', -0.60, 0.41, 20)

  const auxYs = [0.30, 0.16, 0.02, -0.12, -0.27]
  const auxLabels = ['AUX 1', 'AUX 2', 'AUX 3', 'AUX 4', 'AUX 5']
  const insertX = -0.54, auxX = -0.64
  auxYs.forEach((y, i) => {
    rLabel('INSERT', insertX, y + 0.065, 22)
    rTRS(insertX, y)
    rLabel(auxLabels[i], auxX, y + 0.065, 26)
    rXLR(auxX, y)
  })

  // AUX L / AUX R
  rLabel('AUX L', insertX, -0.35, 26)
  rTRS(insertX, -0.42)
  rLabel('AUX R', auxX, -0.35, 26)
  rTRS(auxX, -0.42)

  cachedRearPanelArtwork = new THREE.CanvasTexture(canvas)
  cachedRearPanelArtwork.colorSpace = THREE.SRGBColorSpace
  cachedRearPanelArtwork.needsUpdate = true

  return cachedRearPanelArtwork
}

function RearXLR({ x, y }) {
  return (
    <group position={[x, y, REAR_CONN_Z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.010, 24]} />
        <meshStandardMaterial color="#1a2030" roughness={0.4} metalness={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.010]}>
        <cylinderGeometry args={[0.015, 0.015, 0.012, 24]} />
        <meshStandardMaterial color="#080c14" roughness={0.65} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.026, -0.003]}>
        <boxGeometry args={[0.007, 0.005, 0.008]} />
        <meshStandardMaterial color="#2a3040" roughness={0.3} metalness={0.9} />
      </mesh>
    </group>
  )
}

function RearTRS({ x, y }) {
  return (
    <group position={[x, y, REAR_CONN_Z + 0.004]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.008, 20]} />
        <meshStandardMaterial color="#2a3040" roughness={0.35} metalness={0.88} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.008]}>
        <cylinderGeometry args={[0.007, 0.007, 0.008, 20]} />
        <meshStandardMaterial color="#0a0e16" roughness={0.7} metalness={0.5} />
      </mesh>
    </group>
  )
}

function RearLCD({ x, y }) {
  return (
    <group position={[x, y, REAR_Z - 0.002]}>
      <mesh>
        <boxGeometry args={[0.135, 0.054, 0.006]} />
        <meshStandardMaterial color="#080e18" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <boxGeometry args={[0.120, 0.040, 0.003]} />
        <meshStandardMaterial color="#1a3a6a" emissive="#2050aa" emissiveIntensity={0.55} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  )
}

function Screw({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.006, 16]} />
        <meshStandardMaterial color="#bfc7cf" roughness={0.25} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <boxGeometry args={[0.016, 0.0025, 0.003]} />
        <meshStandardMaterial color="#68707a" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.004]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.016, 0.0025, 0.003]} />
        <meshStandardMaterial color="#68707a" roughness={0.35} metalness={0.55} />
      </mesh>
    </group>
  )
}

function RackSlot({ position }) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]}>
      <capsuleGeometry args={[0.014, 0.05, 6, 12]} />
      <meshStandardMaterial color="#f2f4f8" emissive="#e8efff" emissiveIntensity={0.4} roughness={0.2} metalness={0.05} />
    </mesh>
  )
}

function SideHandle({ side }) {
  const x = side * (W / 2 - 0.036)

  return (
    <group position={[x, -0.01, FRONT_Z + 0.02]}>
      <mesh>
        <capsuleGeometry args={[0.017, 0.34, 8, 16]} />
        <meshStandardMaterial color="#0f131a" roughness={0.55} metalness={0.15} />
      </mesh>
      {[-0.16, 0.16].map((y) => (
        <mesh key={y} position={[0, y, -0.02]}>
          <boxGeometry args={[0.024, 0.026, 0.02]} />
          <meshStandardMaterial color="#1a2029" roughness={0.5} metalness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function ControlKnob({ position, matProps, size = 'sm', angle = 0, name }) {
  const s = KNOB_SIZES[size]
  // tick marks sit just outside the flange at 7 o'clock and 5 o'clock
  const tickR = s.flange * 0.80

  return (
    <group position={position} name={name}>
      {/* Chrome base ring — sits flush on panel */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -s.depth * 0.47]}>
        <cylinderGeometry args={[s.flange, s.flange, 0.007, 40]} />
        <meshStandardMaterial color="#8a9098" roughness={0.22} metalness={0.88} />
      </mesh>

      {/* Grip body — smooth, matte. High roughness eliminates specular gloss. */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[s.face, s.body, s.depth, 36]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Face disc — thin flat cylinder avoids circleGeometry triangle-fan shading artifact */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, s.depth * 0.503]}>
        <cylinderGeometry args={[s.face * 0.98, s.face * 0.98, 0.004, 36]} />
        <meshStandardMaterial color="#242a35" roughness={0.82} metalness={0.05} />
      </mesh>

      {/* Pointer — thin warm off-white, not harsh pure white */}
      <mesh position={[0, 0, s.depth * 0.524]} rotation={[0, 0, angle]}>
        <boxGeometry args={[0.0022, s.face * 1.58, 0.003]} />
        <meshStandardMaterial color="#d8d2c8" roughness={0.28} metalness={0.04} />
      </mesh>

      {/* Fixed gold tick marks — 7 o'clock and 5 o'clock, never rotate */}
      <mesh position={[-tickR * 0.707, -tickR * 0.707, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.0036, 0.013, 0.004]} />
        <meshStandardMaterial color={FIXED_MATERIALS.pointer.color} roughness={FIXED_MATERIALS.pointer.roughness} metalness={FIXED_MATERIALS.pointer.metalness} />
      </mesh>
      <mesh position={[tickR * 0.707, -tickR * 0.707, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.0036, 0.013, 0.004]} />
        <meshStandardMaterial color={FIXED_MATERIALS.pointer.color} roughness={FIXED_MATERIALS.pointer.roughness} metalness={FIXED_MATERIALS.pointer.metalness} />
      </mesh>
    </group>
  )
}

function ToggleSwitch({ position, angle = 0.6, size = 'md' }) {
  const bezel = size === 'sm' ? 0.016 : 0.020
  const stemLength = size === 'sm' ? 0.024 : 0.030

  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[bezel, bezel, 0.012, 24]} />
        <meshStandardMaterial color="#dce1e8" roughness={0.22} metalness={0.98} />
      </mesh>
      <mesh position={[0, 0, 0.005]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[bezel * 0.65, bezel * 0.65, 0.014, 16]} />
        <meshStandardMaterial color="#a4adb8" roughness={0.3} metalness={0.95} />
      </mesh>
      <group position={[0, 0, 0.017]} rotation={[0, 0, angle]}>
        <mesh position={[0, stemLength * 0.35, 0]}>
          <boxGeometry args={[0.005, stemLength, 0.005]} />
          <meshStandardMaterial color="#e9edf2" roughness={0.2} metalness={1} />
        </mesh>
        <mesh position={[0, stemLength * 0.78, 0]}>
          <sphereGeometry args={[0.0065, 12, 12]} />
          <meshStandardMaterial color="#f8fbff" roughness={0.15} metalness={0.75} />
        </mesh>
      </group>
    </group>
  )
}

function Led({ position, color, glow }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.007, 12, 12]} />
      <meshStandardMaterial color={color} emissive={glow} emissiveIntensity={1.3} roughness={0.25} metalness={0.12} />
    </mesh>
  )
}

function ChannelIndicatorStack({ x, switchY }) {
  const lightOffsets = [
    { offset: 0.020, color: '#c7424d', glow: '#66131a' },
    { offset: -0.010, color: '#39a66b', glow: '#12361f' },
    { offset: -0.040, color: '#39a66b', glow: '#12361f' },
    { offset: -0.070, color: '#39a66b', glow: '#12361f' },
  ]

  return lightOffsets.map((light) => (
    <Led key={`${x}_${light.offset}`} position={[x - 0.050, switchY + light.offset, LED_Z]} color={light.color} glow={light.glow} />
  ))
}

export default function PreampModel({ frontPanelColor, rearPanelColor, getKnobColor }) {
  const frontMat = useMemo(() => resolveMaterial(frontPanelColor), [frontPanelColor])
  const rearMat = useMemo(() => resolveMaterial(rearPanelColor), [rearPanelColor])
  const rowAMat = useMemo(() => resolveMaterial(getKnobColor('A')), [getKnobColor])
  const rowBMat = useMemo(() => resolveMaterial(getKnobColor('B')), [getKnobColor])
  const rowCMat = useMemo(() => resolveMaterial(getKnobColor('C')), [getKnobColor])
  const rowDMat = useMemo(() => resolveMaterial(getKnobColor('D')), [getKnobColor])
  const rowEMat = useMemo(() => resolveMaterial(getKnobColor('E')), [getKnobColor])
  const largeMat = useMemo(() => resolveMaterial(getKnobColor('large')), [getKnobColor])
  const artworkTexture = useMemo(() => createPanelArtworkTexture(), [])
  const rearArtworkTexture = useMemo(() => createRearPanelArtworkTexture(), [])

  const rowMaterials = {
    A: rowAMat,
    B: rowBMat,
    C: rowCMat,
    D: rowDMat,
    E: rowEMat,
    large: largeMat,
  }

  return (
    <group scale={[0.245, 0.245, 0.245]}>
      <mesh name="body_main" castShadow receiveShadow position={[0, 0, -0.01]}>
        <boxGeometry args={[PANEL_W + 0.03, H - 0.03, D]} />
        <meshStandardMaterial color="#181e28" roughness={0.55} metalness={0.45} />
      </mesh>

      <mesh name="front_panel" position={[0, 0, FRONT_Z]} castShadow receiveShadow>
        <boxGeometry args={[PANEL_W, PANEL_H, 0.010]} />
        <meshStandardMaterial {...frontMat} />
      </mesh>

      {artworkTexture && (
        <mesh position={[0, 0, OVERLAY_Z]} renderOrder={2}>
          <planeGeometry args={[PANEL_W, PANEL_H]} />
          <meshBasicMaterial map={artworkTexture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      <mesh name="rear_panel" position={[0, 0, -(D / 2 + 0.004)]} castShadow>
        <boxGeometry args={[PANEL_W, PANEL_H, 0.010]} />
        <meshStandardMaterial {...rearMat} />
      </mesh>

      {rearArtworkTexture && (
        <mesh position={[0, 0, REAR_OVERLAY_Z]} rotation={[0, Math.PI, 0]} renderOrder={2}>
          <planeGeometry args={[PANEL_W, PANEL_H]} />
          <meshBasicMaterial map={rearArtworkTexture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      {/* Rear 3D elements */}
      <RearLCD x={0.50} y={0.20} />

      {/* LEFT outputs — 5 XLR + TRS pairs */}
      {[-0.04, -0.13, -0.22, -0.31, -0.40].map((x) => (
        <group key={`lxlr_${x}`}>
          <RearXLR x={x} y={0.01} />
          <RearTRS x={x} y={-0.07} />
        </group>
      ))}

      {/* RIGHT outputs — 5 XLR + TRS pairs */}
      {[-0.04, -0.13, -0.22, -0.31, -0.40].map((x) => (
        <group key={`rxlr_${x}`}>
          <RearXLR x={x} y={-0.18} />
          <RearTRS x={x} y={-0.27} />
        </group>
      ))}

      {/* AES/EBU XLR */}
      <RearXLR x={0.12} y={-0.01} />

      {/* AUX 1–5 XLR column */}
      {[0.30, 0.16, 0.02, -0.12, -0.27].map((y) => (
        <group key={`aux_${y}`}>
          <RearXLR x={-0.64} y={y} />
          <RearTRS x={-0.54} y={y} />
        </group>
      ))}

      {[-1, 1].map((side) => (
        <group key={`ear_${side}`} position={[side * (PANEL_W / 2 + EAR_W / 2 + 0.01), 0, FRONT_Z - 0.005]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[EAR_W, H, 0.020]} />
            <meshStandardMaterial color="#0f141c" roughness={0.55} metalness={0.18} />
          </mesh>
          <RackSlot position={[0, 0.24, 0.004]} />
          <RackSlot position={[0, -0.24, 0.004]} />
        </group>
      ))}

      <SideHandle side={-1} />
      <SideHandle side={1} />

      {TOP_LEFT_KNOBS.map((control) => (
        <ControlKnob
          key={control.name}
          name={control.name}
          position={[control.x, control.y, KNOB_Z]}
          matProps={rowMaterials[control.group]}
          size={control.size}
          angle={control.angle}
        />
      ))}

      <ToggleSwitch position={[-0.275, ROW_Y.top + 0.004, SWITCH_Z]} size="sm" angle={-0.25} />
      <ToggleSwitch position={[-0.235, ROW_Y.top + 0.004, SWITCH_Z]} size="sm" angle={0.25} />

      {LEFT_ROWS.flatMap((row) => {
        const knobs = [
          { name: `knob_row_${row.group}_01`, x: LEFT_X[0], label: row.aux, angle: -0.58 },
          { name: `knob_row_${row.group}_02`, x: LEFT_X[1], label: 'BASS', angle: -0.03 },
          { name: `knob_row_${row.group}_03`, x: LEFT_X[2], label: 'TOPS', angle: -0.02 },
          { name: `knob_row_${row.group}_04`, x: LEFT_X[3], label: 'FX 1', angle: -0.62 },
          { name: `knob_row_${row.group}_05`, x: LEFT_X[4], label: 'FX 2', angle: -0.55 },
          { name: `knob_row_${row.group}_06`, x: LEFT_X[5], label: 'PAN', angle: -0.02 },
        ]

        if (row.center?.type === 'knob') {
          knobs.push({ name: row.center.name, x: 0.21, label: row.center.label, angle: row.center.angle })
        }

        return knobs.map((knob) => (
          <ControlKnob
            key={knob.name}
            name={knob.name}
            position={[knob.x, row.y, KNOB_Z]}
            matProps={rowMaterials[row.group]}
            size="sm"
            angle={knob.angle}
          />
        ))
      })}

      {LEFT_ROWS
        .filter((row) => row.center?.type === 'toggle')
        .map((row) => (
          <ToggleSwitch key={`toggle_${row.aux}`} position={[0.21, row.y + 0.004, SWITCH_Z]} size="sm" angle={-0.55} />
        ))}

      {RIGHT_CHANNELS.map((channel, index) => (
        <group key={channel.name}>
          <ToggleSwitch position={[channel.x, ROW_Y.top + 0.004, SWITCH_Z]} size="md" angle={index % 2 === 0 ? -0.2 : 0.18} />
          {ChannelIndicatorStack({ x: channel.x, switchY: ROW_Y.top + 0.01 })}
          <ControlKnob
            name={channel.name}
            position={[channel.x, ROW_Y.row1, KNOB_Z]}
            matProps={largeMat}
            size="sm"
            angle={channel.angle}
          />
        </group>
      ))}

      <Led position={[0.60, 0.31, LED_Z]} color="#39a66b" glow="#12361f" />
      <Led position={[0.60, 0.27, LED_Z]} color="#c7424d" glow="#66131a" />
      <Led position={[0.64, 0.305, LED_Z]} color="#c7424d" glow="#66131a" />

      {MID_SECTION_KNOBS.map((knob) => (
        <ControlKnob
          key={knob.name}
          name={knob.name}
          position={[knob.x, knob.y, KNOB_Z]}
          matProps={largeMat}
          size="sm"
          angle={knob.angle}
        />
      ))}

      <ToggleSwitch position={[0.20, ROW_Y.row3 + 0.004, SWITCH_Z]} size="sm" angle={-0.55} />
      {FILTER_SECTION.map((knob) => (
        <ControlKnob
          key={knob.name}
          name={knob.name}
          position={[knob.x, knob.y, KNOB_Z]}
          matProps={largeMat}
          size="sm"
          angle={knob.angle}
        />
      ))}
      <ToggleSwitch position={[0.66, ROW_Y.row3 + 0.004, SWITCH_Z]} size="sm" angle={0.55} />

      {EQ_TOP.map((knob) => (
        <ControlKnob
          key={knob.name}
          name={knob.name}
          position={[knob.x, knob.y, KNOB_Z]}
          matProps={largeMat}
          size="sm"
          angle={knob.angle}
        />
      ))}

      {EQ_BOTTOM.map((knob) => (
        <ControlKnob
          key={knob.name}
          name={knob.name}
          position={[knob.x, knob.y, KNOB_Z]}
          matProps={largeMat}
          size="sm"
          angle={knob.angle}
        />
      ))}

      {FRONT_SCREWS.map(([x, y]) => (
        <Screw key={`${x}_${y}`} position={[x, y, FRONT_Z + 0.010]} />
      ))}

      {[-0.42, -0.14, 0.14, 0.42].map((x, index) => (
        <mesh key={`rear_cut_${index}`} position={[x, -0.05, -(D / 2 + 0.010)]}>
          <boxGeometry args={[0.11, 0.045, 0.014]} />
          <meshStandardMaterial color="#090c12" roughness={0.92} metalness={0.08} />
        </mesh>
      ))}
    </group>
  )
}
