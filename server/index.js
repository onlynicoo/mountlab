import express from 'express'
import cors from 'cors'
import { ensureConvertedDir } from './lib/conversion.js'
import { sendError } from './lib/errors.js'
import { handleEvents } from './lib/watcher.js'
import modelRoutes from './routes/model.js'
import convertRoutes from './routes/convert.js'
import positionsRoutes from './routes/positions.js'

const app = express()
const port = Number(process.env.SERVER_PORT || 3001)
const host = process.env.SERVER_HOST || '127.0.0.1'

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
}))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/events', handleEvents)
app.use('/api', modelRoutes)
app.use('/api', convertRoutes)
app.use('/api', positionsRoutes)
app.use(sendError)

await ensureConvertedDir()

app.listen(port, host, () => {
  console.log(`Assembly viewer server listening on http://${host}:${port}`)
})
