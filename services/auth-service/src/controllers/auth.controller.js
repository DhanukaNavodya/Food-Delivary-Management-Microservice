import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../utils/roles.js';

const SELF_REGISTER_ROLES = [ROLES.CUSTOMER, ROLES.RESTAURANT_OWNER, ROLES.DELIVERY_AGENT];

function signToken(user) {
  return jwt.sign(
    { email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { subject: user.id, expiresIn: config.jwtExpiresIn }
  );
}

const authResponse = (user) => ({ user, token: signToken(user), expiresIn: config.jwtExpiresIn });

export async function register(req, res) {
  const { name, email, password, role = ROLES.CUSTOMER } = req.body ?? {};

  if (!SELF_REGISTER_ROLES.includes(role)) {
    throw ApiError.badRequest(`role must be one of: ${SELF_REGISTER_ROLES.join(', ')}`);
  }
  if (email && (await User.exists({ email: String(email).toLowerCase().trim() }))) {
    throw ApiError.conflict('Email is already registered');
  }

  const user = await User.create({ name, email, password, role });
  res.status(201).json({ message: 'User registered successfully', ...authResponse(user) });
}

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw ApiError.badRequest('email and password are required');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(String(password)))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Account is deactivated');

  user.lastLoginAt = new Date();
  await user.save();

  res.json({ message: 'Login successful', ...authResponse(user) });
}

export async function verifyToken(req, res) {
  res.json({ valid: true, user: req.user });
}

export async function getMe(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json(user);
}

export async function updateMe(req, res) {
  const { name, email } = req.body ?? {};
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  await user.save();

  res.json({ message: 'Profile updated', ...authResponse(user) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('currentPassword and newPassword are required');
  }

  const user = await User.findById(req.user.id).select('+password');
  if (!user) throw ApiError.notFound('User not found');
  if (!(await user.comparePassword(String(currentPassword)))) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password changed successfully' });
}

export async function seedAdmin() {
  if (!config.adminEmail || !config.adminPassword) return;
  if (await User.exists({ email: config.adminEmail.toLowerCase() })) return;

  await User.create({
    name: 'System Admin',
    email: config.adminEmail,
    password: config.adminPassword,
    role: ROLES.ADMIN
  });
  console.log(`Seeded admin user: ${config.adminEmail}`);
}
