import { Router } from 'express';
import {
  changePassword,
  getMe,
  login,
  register,
  updateMe,
  verifyToken
} from '../controllers/auth.controller.js';
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser
} from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', authenticate, verifyToken);

router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.patch('/me/password', authenticate, changePassword);

// Admin-only user management
router.use('/users', authenticate, authorize(ROLES.ADMIN));
router.get('/users', listUsers);
router.post('/users', createUser);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

export default router;
