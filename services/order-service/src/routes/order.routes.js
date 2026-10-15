import { Router } from 'express';
import {
  cancelOrder,
  createOrder,
  deleteOrder,
  getOrder,
  getOrderStats,
  listOrders,
  updateOrder,
  updateOrderStatus
} from '../controllers/order.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.use(authenticate);

router.get('/stats', authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER), getOrderStats);

router.get('/', listOrders);
router.post('/', authorize(ROLES.CUSTOMER, ROLES.ADMIN), createOrder);
router.get('/:id', getOrder);
router.put('/:id', updateOrder);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/cancel', cancelOrder);
router.delete('/:id', authorize(ROLES.ADMIN), deleteOrder);

export default router;
