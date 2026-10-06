import { env } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  // Log the error
  if (err.statusCode === 401 || err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    console.warn(`[Auth 401]: ${err.message || 'Token expired or invalid'}`);
  } else if (env.NODE_ENV === 'development') {
    console.error('Error:', err);
  } else {
    console.error('Error:', err.message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', code: 400, details: messages });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({ error: `Duplicate value for ${field}`, code: 409 });
  }

  // Mongoose cast error (invalid ObjectId etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format', code: 400 });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token', code: 401 });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired', code: 401 });
  }

  // Custom API errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.errorCode || err.statusCode,
    });
  }

  // Default 500
  res.status(500).json({
    error: env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

// Helper to create API errors with status codes and optional stable error code
export class ApiError extends Error {
  constructor(statusCode, message, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode || (statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 404 ? 'NOT_FOUND' : 'ERROR');
    this.name = 'ApiError';
  }
}

