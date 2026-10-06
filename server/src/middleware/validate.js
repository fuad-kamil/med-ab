import { ApiError } from './errorHandler.js';

// Middleware factory: validates req.body against a zod schema
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      return next(new ApiError(400, `Validation failed: ${messages.join('; ')}`));
    }
    req.body = result.data; // Use parsed/cleaned data
    next();
  };
}

// Validates req.query
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      return next(new ApiError(400, `Invalid query: ${messages.join('; ')}`));
    }
    req.query = result.data;
    next();
  };
}

// Validates req.params
export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      return next(new ApiError(400, `Invalid params: ${messages.join('; ')}`));
    }
    req.params = result.data;
    next();
  };
}

