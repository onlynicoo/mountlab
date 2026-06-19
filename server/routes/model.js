import { Router } from 'express'
import { convertStepToStl } from '../lib/conversion.js'
import { getContentType, getModelType, validateModelPath } from '../lib/paths.js'
import { watchModelPath } from '../lib/watcher.js'
import { isInside, savedProjectsRoot } from '../lib/appPaths.js'
import path from 'node:path'
import { httpError } from '../lib/errors.js'

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

async function handleProjectFile(req, res, next) {
  try {
    const rawPath = String(req.query.path || '')
    if (!rawPath.startsWith('/projects/') || rawPath.includes('\0')) {
      throw httpError(400, 'Project file paths must start with /projects/.')
    }

    const relativePath = rawPath.slice('/projects/'.length)
    if (!relativePath || relativePath.split(/[\\/]+/).includes('..')) {
      throw httpError(400, 'Project file path is invalid.')
    }

    const filePath = path.resolve(savedProjectsRoot, relativePath)
    if (!isInside(savedProjectsRoot, filePath)) {
      throw httpError(403, 'Project file path escapes the saved projects folder.')
    }

    const type = getModelType(filePath)
    if (type) res.type(getContentType(type))
    res.sendFile(filePath)
  } catch (error) {
    next(error)
  }
}

router.head('/project-file', handleProjectFile)
router.get('/project-file', handleProjectFile)

export default router
