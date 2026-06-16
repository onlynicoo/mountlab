import chokidar from 'chokidar'

const clients = new Set()
const watchedPaths = new Set()

const watcher = chokidar.watch([], {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 400,
    pollInterval: 100,
  },
})

function emit(event, filePath) {
  const payload = JSON.stringify({
    event,
    path: filePath,
    timestamp: Date.now(),
  })

  for (const client of clients) {
    client.write(`data: ${payload}\n\n`)
  }
}

watcher.on('change', (filePath) => emit('change', filePath))
watcher.on('unlink', (filePath) => emit('unlink', filePath))
watcher.on('error', (error) => emit('error', error.message))

export function watchModelPath(filePath) {
  if (watchedPaths.has(filePath)) return

  watchedPaths.add(filePath)
  watcher.add(filePath)
}

export function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(`data: ${JSON.stringify({ event: 'ready', timestamp: Date.now() })}\n\n`)
  clients.add(res)

  req.on('close', () => {
    clients.delete(res)
  })
}
