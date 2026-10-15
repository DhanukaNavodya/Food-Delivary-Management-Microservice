import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(({ path, message }) => ({ field: path, message }));
    return res.status(400).json({ message: 'Validation failed', details });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path}: ${err.value}` });
  }

  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).join(', ');
    return res.status(409).json({ message: `Duplicate value for: ${fields}` });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }

  console.error('[Unhandled Error]', err);
  return res.status(500).json({ message: 'Internal server error' });
}
