import rateLimit from 'express-rate-limit';

// Global rate limit: 100 req/min
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Auth routes: 10 req/min (stricter)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

// Answer save: 30 req/min per IP
export const answerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many answer saves, please slow down' },
});

// Session claim (waitToken retry): 20 req/min per IP (client polls every 4-8s)
export const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', code: 'RATE_LIMITED' },
});

// Heartbeat: 60 req/min per IP (generous — one per 15s per student, but allow bursts)
export const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many heartbeat requests' },
});
