import { Router } from 'express';
import {
  assignDriver,
  createDelivery,
  deleteDelivery,
  getDelivery,
  getDeliveryByOrder,
  listDeliveries,
  updateDelivery,
  updateDeliveryStatus
} from '../controllers/delivery.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.use(authenticate);

router.get('/', listDeliveries);
router.post('/', authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER), createDelivery);
router.get('/order/:orderId', getDeliveryByOrder);
router.get('/:id', getDelivery);
router.put('/:id', authorize(ROLES.ADMIN), updateDelivery);
router.patch('/:id/assign', authorize(ROLES.ADMIN, ROLES.DELIVERY_AGENT), assignDriver);
router.patch('/:id/status', authorize(ROLES.ADMIN, ROLES.DELIVERY_AGENT), updateDeliveryStatus);
router.delete('/:id', authorize(ROLES.ADMIN), deleteDelivery);

export default router;
