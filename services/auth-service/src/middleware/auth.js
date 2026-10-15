import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Verifies the Bearer token issued by the Auth Service and attaches the user to the request.
export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or invalid Authorization header');
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
    req.token = token;
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  next();
}

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!roles.includes(req.user.role)) {
    throw ApiError.forbidden(`This action requires one of the roles: ${roles.join(', ')}`);
  }
  next();
};
