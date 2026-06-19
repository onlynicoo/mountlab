import path from 'node:path'
import { Router } from 'express'
import { exportDownloadUrl, exportPanel } from '../lib/export.js'
import { getContentType, getModelType, validateModelPath } from '../lib/paths.js'
import { watchModelPath } from '../lib/watcher.js'
import { httpError } from '../lib/errors.js'

const router = Router()

function contentTypeForFile(filePath) {
  const type = getModelType(filePath)
  if (type === 'step') return 'model/step'
  return getContentType(type)
}

router.post('/export', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (items.length === 0) {
      throw httpError(400, 'Select at least one panel and format to export.')
    }

    const exports = []
    for (const item of items) {
      const result = await exportPanel({
        componentPath: item.path,
        format: item.format,
        label: item.label,
      })
      watchModelPath(result.outputPath)
      exports.push({
        ...result,
        fileName: path.basename(result.outputPath),
        downloadUrl: exportDownloadUrl(result.outputPath),
      })
    }

    res.json({ status: 'ok', exports })
  } catch (error) {
    next(error)
  }
})

router.get('/export/file', async (req, res, next) => {
  try {
    const { filePath, type } = await validateModelPath(req.query.path)
    if (type !== 'stl' && type !== 'step') {
      throw httpError(415, 'Export download only supports STL and STEP files.')
    }

    res.type(contentTypeForFile(filePath))
    res.attachment(path.basename(filePath))
    res.sendFile(filePath)
  } catch (error) {
    next(error)
  }
})

export default router
