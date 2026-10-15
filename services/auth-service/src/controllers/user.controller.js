import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginate } from '../utils/pagination.js';
import { pick } from '../utils/pick.js';

const EDITABLE_FIELDS = ['name', 'email', 'password', 'role', 'isActive'];

export async function listUsers(req, res) {
  const { role, isActive, search } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  res.json(await paginate(User, filter, req.query));
}

export async function getUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json(user);
}

export async function createUser(req, res) {
  const user = await User.create(pick(req.body, EDITABLE_FIELDS));
  res.status(201).json(user);
}

export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  Object.assign(user, pick(req.body, EDITABLE_FIELDS));
  await user.save();
  res.json(user);
}

export async function deleteUser(req, res) {
  if (req.params.id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  res.status(204).end();
}
