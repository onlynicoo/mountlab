import express from 'express'
import cors from 'cors'
import { ensureConvertedDir } from './lib/conversion.js'
import { sendError } from './lib/errors.js'
import { handleEvents } from './lib/watcher.js'
import modelRoutes from './routes/model.js'
import convertRoutes from './routes/convert.js'
import positionsRoutes from './routes/positions.js'
import drillRoutes from './routes/drill.js'
import exportRoutes from './routes/export.js'
import workspaceRoutes from './routes/workspace.js'

const app = express()
const port = Number(process.env.SERVER_PORT || 3001)
const host = process.env.SERVER_HOST || '127.0.0.1'

app.use(cors({
  origin(origin, callback) {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):517\d$/.test(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`))
  },
}))
app.use(express.json({ limit: '100mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/events', handleEvents)
app.use('/api', modelRoutes)
app.use('/api', convertRoutes)
app.use('/api', positionsRoutes)
app.use('/api', drillRoutes)
app.use('/api', exportRoutes)
app.use('/api', workspaceRoutes)
app.use(sendError)

await ensureConvertedDir()

const server = app.listen(port, host, () => {
  console.log(`Assembly viewer server listening on http://${host}:${port}`)
})

server.on('error', (error) => {
  console.error(`Assembly viewer server failed: ${error.message}`)
  process.exitCode = 1
})
