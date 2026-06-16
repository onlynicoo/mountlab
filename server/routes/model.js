import { Router } from 'express'
import { convertStepToStl } from '../lib/conversion.js'
import { getContentType, validateModelPath } from '../lib/paths.js'
import { watchModelPath } from '../lib/watcher.js'

const router = Router()

async function handleModel(req, res, next) {
  try {
    const { filePath, type } = await validateModelPath(req.query.path)

    if (type === 'step') {
      watchModelPath(filePath)
      const converted = await convertStepToStl(filePath)
      res.type(getContentType(converted.type))
      res.sendFile(converted.outputPath)
      return
    }

    watchModelPath(filePath)
    res.type(getContentType(type))
    res.sendFile(filePath)
  } catch (error) {
    next(error)
  }
}

router.head('/model', handleModel)
router.get('/model', handleModel)

export default router
