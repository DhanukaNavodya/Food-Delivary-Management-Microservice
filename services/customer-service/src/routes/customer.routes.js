import { Router } from 'express';
import {
  addAddress,
  createCustomer,
  deleteAddress,
  deleteCustomer,
  getCustomer,
  listAddresses,
  listCustomers,
  updateAddress,
  updateCustomer
} from '../controllers/customer.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN), listCustomers);
router.post('/', authorize(ROLES.CUSTOMER, ROLES.ADMIN), createCustomer);

// `:id` accepts a customer id or `me` for the logged-in user's profile.
router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

router.get('/:id/addresses', listAddresses);
router.post('/:id/addresses', addAddress);
router.put('/:id/addresses/:addressId', updateAddress);
router.delete('/:id/addresses/:addressId', deleteAddress);

export default router;
