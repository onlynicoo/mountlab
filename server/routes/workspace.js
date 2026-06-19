import { Router } from 'express'
import { createWorkspace, saveWorkspaceAsProject, writeWorkspaceAssembly } from '../lib/workspace.js'
import { httpError } from '../lib/errors.js'

const router = Router()

router.post('/workspace/new', async (req, res, next) => {
  try {
    const workspace = await createWorkspace({
      projectName: req.body?.projectName,
      files: [],
    })

    res.json({
      id: workspace.id,
      name: workspace.name,
      dir: workspace.dir,
      files: workspace.files,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/workspace/import', async (req, res, next) => {
  try {
    const files = Array.isArray(req.body?.files) ? req.body.files : []
    if (files.length === 0) throw httpError(400, 'Workspace import requires at least one file.')

    const workspace = await createWorkspace({
      projectName: req.body?.projectName,
      files,
    })

    res.json({
      id: workspace.id,
      name: workspace.name,
      dir: workspace.dir,
      files: workspace.files,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/workspace/save', async (req, res, next) => {
  try {
    const workspaceId = req.body?.workspaceId
    const payload = req.body?.payload
    if (!workspaceId) throw httpError(400, 'workspaceId is required.')
    if (!payload || typeof payload !== 'object') throw httpError(400, 'A workspace payload is required.')

    const result = await writeWorkspaceAssembly(workspaceId, payload)
    res.json({ status: 'saved', ...result })
  } catch (error) {
    next(error)
  }
})

router.post('/workspace/save-as', async (req, res, next) => {
  try {
    const workspaceId = req.body?.workspaceId
    const payload = req.body?.payload
    if (!workspaceId) throw httpError(400, 'workspaceId is required.')
    if (!payload || typeof payload !== 'object') throw httpError(400, 'A workspace payload is required.')

    const result = await saveWorkspaceAsProject(workspaceId, req.body?.projectName, payload)
    res.json({ status: 'saved-as', ...result })
  } catch (error) {
    next(error)
  }
})

export default router
