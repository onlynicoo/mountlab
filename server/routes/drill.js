import { Router } from 'express'
import { drillPanel } from '../lib/drill.js'
import { modelUrlFor } from '../lib/paths.js'
import { watchModelPath } from '../lib/watcher.js'

const router = Router()

router.post('/drill', async (req, res, next) => {
  try {
    const result = await drillPanel({
      componentPath: req.body?.componentPath,
      holes: req.body?.holes,
    })

    watchModelPath(result.outputPath)
    const url = modelUrlFor(result.outputPath, 'stl')
    res.json({
      status: 'ok',
      type: 'stl',
      url,
      path: result.outputPath,
      outputPath: result.outputPath,
      outputUrl: result.outputUrl,
      freecad: result.freecad,
      cached: result.cached,
    })
  } catch (error) {
    next(error)
  }
})

export default router
