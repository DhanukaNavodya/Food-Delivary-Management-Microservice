import { Router } from 'express';
import {
  createMenuItem,
  deleteMenuItem,
  getMenuItem,
  listMenu,
  updateMenuItem
} from '../controllers/menu.controller.js';
import {
  createRestaurant,
  deleteRestaurant,
  getRestaurant,
  listRestaurants,
  updateRestaurant,
  updateRestaurantStatus
} from '../controllers/restaurant.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/roles.js';

const router = Router();
const canManage = [authenticate, authorize(ROLES.RESTAURANT_OWNER, ROLES.ADMIN)];

// Public browsing
router.get('/', listRestaurants);
router.get('/:id', getRestaurant);
router.get('/:id/menu', listMenu);
router.get('/:id/menu/:itemId', getMenuItem);

// Owner / admin management
router.post('/', canManage, createRestaurant);
router.put('/:id', canManage, updateRestaurant);
router.patch('/:id/status', canManage, updateRestaurantStatus);
router.delete('/:id', canManage, deleteRestaurant);

router.post('/:id/menu', canManage, createMenuItem);
router.put('/:id/menu/:itemId', canManage, updateMenuItem);
router.delete('/:id/menu/:itemId', canManage, deleteMenuItem);

export default router;
