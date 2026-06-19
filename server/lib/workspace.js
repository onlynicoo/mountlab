import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { httpError } from './errors.js'
import { savedProjectsRoot, workspaceRoot } from './appPaths.js'

function slugForName(name) {
  return String(name || 'mountlab-project')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mountlab-project'
}

function safeRelativePath(relativePath) {
  const normalized = String(relativePath || 'file')
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean)
    .join('/')

  if (!normalized || normalized.split('/').includes('..')) {
    throw httpError(400, 'Workspace file path is invalid.')
  }

  return normalized
}

function workspaceDirFor(id) {
  const safeId = String(id || '').replace(/[^a-z0-9-]/gi, '')
  if (!safeId) throw httpError(400, 'Workspace id is required.')
  return path.join(workspaceRoot, safeId)
}

export async function createWorkspace({ projectName, files = [] }) {
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`
  const dir = workspaceDirFor(id)
  await fs.mkdir(dir, { recursive: true })

  const storedFiles = []
  for (const file of files) {
    const relativePath = safeRelativePath(file.relativePath || file.name)
    const outputPath = path.join(dir, relativePath)
    const relativeToWorkspace = path.relative(dir, outputPath)
    if (relativeToWorkspace.startsWith('..') || path.isAbsolute(relativeToWorkspace)) {
      throw httpError(400, 'Workspace file path escapes the workspace.')
    }

    const buffer = Buffer.from(String(file.contentBase64 || ''), 'base64')
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, buffer)
    storedFiles.push({ relativePath, path: outputPath })
  }

  const workspace = {
    id,
    name: String(projectName || 'Untitled rack project'),
    dir,
    createdAt: new Date().toISOString(),
    files: storedFiles,
  }
  await fs.writeFile(path.join(dir, '.mountlab-workspace.json'), `${JSON.stringify(workspace, null, 2)}\n`, 'utf8')
  return workspace
}

export async function writeWorkspaceAssembly(id, payload) {
  const dir = workspaceDirFor(id)
  await fs.mkdir(dir, { recursive: true })
  const assemblyPath = path.join(dir, 'assembly.json')
  await fs.writeFile(assemblyPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return { assemblyPath, dir }
}

export async function saveWorkspaceAsProject(id, projectName, payload) {
  const sourceDir = workspaceDirFor(id)
  const slug = slugForName(projectName || payload?.assemblyMeta?.project?.name)
  const destinationDir = path.join(savedProjectsRoot, slug)
  const relativeToSavedRoot = path.relative(savedProjectsRoot, destinationDir)
  if (relativeToSavedRoot.startsWith('..') || path.isAbsolute(relativeToSavedRoot)) {
    throw httpError(400, 'Project name resolves outside the saved projects folder.')
  }

  await fs.mkdir(savedProjectsRoot, { recursive: true })
  await fs.rm(destinationDir, { recursive: true, force: true })
  await fs.cp(sourceDir, destinationDir, { recursive: true })
  const assemblyPath = path.join(destinationDir, 'assembly.json')
  await fs.writeFile(assemblyPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  return {
    projectPath: destinationDir,
    assemblyPath,
    publicPath: `/projects/${slug}/assembly.json`,
  }
}
