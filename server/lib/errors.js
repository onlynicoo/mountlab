export function httpError(status, message, details = undefined) {
  const error = new Error(message)
  error.status = status
  error.details = details
  return error
}

export function sendError(error, _req, res, _next) {
  const status = error.status || 500

  res.status(status).json({
    status: 'error',
    error: error.message || 'Unexpected server error',
    ...(error.details ? { details: error.details } : {}),
  })
}
