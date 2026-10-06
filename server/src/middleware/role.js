import { ApiError } from './errorHandler.js';

// Factory that returns middleware checking for specific roles
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Access denied'));
    }
    next();
  };
}
