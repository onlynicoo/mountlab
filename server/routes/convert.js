import { Router } from 'express'
import { convertStepToStl } from '../lib/conversion.js'
import { httpError } from '../lib/errors.js'
import { modelUrlFor, validateModelPath } from '../lib/paths.js'
import { watchModelPath } from '../lib/watcher.js'

const router = Router()

router.post('/convert', async (req, res, next) => {
  try {
    const { filePath, type } = await validateModelPath(req.body?.path)

    if (type !== 'step') {
      throw httpError(415, 'Only STEP/STP files require conversion.')
    }

    watchModelPath(filePath)
    const converted = await convertStepToStl(filePath)

    res.json({
      url: modelUrlFor(converted.outputPath, converted.type),
      type: converted.type,
      status: 'ok',
      cached: converted.cached,
    })
  } catch (error) {
    next(error)
  }
})

export default router
