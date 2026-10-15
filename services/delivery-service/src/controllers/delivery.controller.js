import { config } from '../config/env.js';
import { DELIVERY_STATUS, DELIVERY_TRANSITIONS, Delivery } from '../models/Delivery.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { pick } from '../utils/pick.js';
import { ROLES } from '../utils/roles.js';
import { callService } from '../utils/serviceClient.js';

// Delivery status changes that must be mirrored on the order.
const ORDER_STATUS_SYNC = {
  [DELIVERY_STATUS.PICKED_UP]: 'OUT_FOR_DELIVERY',
  [DELIVERY_STATUS.DELIVERED]: 'DELIVERED'
};

const CLOSED_ORDER_STATUSES = ['DELIVERED', 'CANCELLED'];

function canAccessDelivery(user, delivery) {
  switch (user.role) {
    case ROLES.ADMIN:
      return true;
    case ROLES.CUSTOMER:
      return delivery.customerUserId === user.id;
    case ROLES.RESTAURANT_OWNER:
      return delivery.restaurantOwnerId === user.id;
    case ROLES.DELIVERY_AGENT:
      return delivery.driverId === user.id || delivery.status === DELIVERY_STATUS.PENDING;
    default:
      return false;
  }
}

function assertAccess(user, delivery) {
  if (!delivery) throw ApiError.notFound('Delivery not found');
  if (!canAccessDelivery(user, delivery)) throw ApiError.forbidden('You do not have access to this delivery');
  return delivery;
}

const actor = (user) => `${user.role}:${user.id}`;

async function fetchOrder(req, orderId) {
  try {
    return await callService(config.orderServiceUrl, `/api/orders/${encodeURIComponent(orderId)}`, { token: req.token });
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 400) throw ApiError.badRequest('Order not found');
    throw error;
  }
}

async function fetchRestaurantAddress(restaurantId) {
  try {
    const restaurant = await callService(config.restaurantServiceUrl, `/api/restaurants/${encodeURIComponent(restaurantId)}`);
    return restaurant.address;
  } catch {
    return undefined; // pickup address is informational; don't block the delivery
  }
}

export async function createDelivery(req, res) {
  const { orderId, notes, estimatedDeliveryTime } = req.body ?? {};
  if (!orderId) throw ApiError.badRequest('orderId is required');

  if (await Delivery.exists({ orderId: String(orderId) })) {
    throw ApiError.conflict('A delivery already exists for this order');
  }

  const order = await fetchOrder(req, orderId);
  if (CLOSED_ORDER_STATUSES.includes(order.status)) {
    throw ApiError.badRequest(`Cannot create a delivery for a ${order.status} order`);
  }

  const delivery = new Delivery({
    orderId: order.id,
    restaurantId: order.restaurantId,
    restaurantOwnerId: order.restaurantOwnerId,
    customerUserId: order.userId,
    pickupAddress: await fetchRestaurantAddress(order.restaurantId),
    dropoffAddress: order.deliveryAddress,
    notes,
    estimatedDeliveryTime
  });
  delivery.changeStatus(DELIVERY_STATUS.PENDING, actor(req.user), 'Delivery requested');

  await delivery.save();
  res.status(201).json(delivery);
}

export async function listDeliveries(req, res) {
  const { status, orderId, driverId, restaurantId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (orderId) filter.orderId = orderId;
  if (driverId) filter.driverId = driverId;
  if (restaurantId) filter.restaurantId = restaurantId;

  switch (req.user.role) {
    case ROLES.CUSTOMER:
      filter.customerUserId = req.user.id;
      break;
    case ROLES.RESTAURANT_OWNER:
      filter.restaurantOwnerId = req.user.id;
      break;
    case ROLES.DELIVERY_AGENT:
      // Agents see their own deliveries, or the open pool with ?available=true.
      delete filter.driverId;
      if (req.query.available === 'true') filter.status = DELIVERY_STATUS.PENDING;
      else filter.driverId = req.user.id;
      break;
    default:
      break;
  }

  res.json(await paginate(Delivery, filter, req.query));
}

export async function getDelivery(req, res) {
  res.json(assertAccess(req.user, await Delivery.findById(req.params.id)));
}

export async function getDeliveryByOrder(req, res) {
  res.json(assertAccess(req.user, await Delivery.findOne({ orderId: req.params.orderId })));
}

export async function updateDelivery(req, res) {
  const delivery = await Delivery.findById(req.params.id);
  if (!delivery) throw ApiError.notFound('Delivery not found');

  Object.assign(delivery, pick(req.body, ['notes', 'estimatedDeliveryTime', 'pickupAddress', 'dropoffAddress']));
  await delivery.save();
  res.json(delivery);
}

export async function assignDriver(req, res) {
  const delivery = assertAccess(req.user, await Delivery.findById(req.params.id));
  const isAdmin = req.user.role === ROLES.ADMIN;

  const assignable = isAdmin
    ? [DELIVERY_STATUS.PENDING, DELIVERY_STATUS.ASSIGNED]
    : [DELIVERY_STATUS.PENDING];
  if (!assignable.includes(delivery.status)) {
    throw ApiError.badRequest(`Cannot assign a driver to a ${delivery.status} delivery`);
  }

  if (isAdmin) {
    if (!req.body?.driverId) throw ApiError.badRequest('driverId is required');
    delivery.driverId = String(req.body.driverId);
    delivery.driverName = req.body.driverName;
  } else {
    delivery.driverId = req.user.id;
    delivery.driverName = req.user.name;
  }

  delivery.assignedAt = new Date();
  delivery.changeStatus(DELIVERY_STATUS.ASSIGNED, actor(req.user), `Assigned to ${delivery.driverName || delivery.driverId}`);
  await delivery.save();
  res.json(delivery);
}

export async function updateDeliveryStatus(req, res) {
  const { status, note } = req.body ?? {};
  if (!Object.values(DELIVERY_STATUS).includes(status)) {
    throw ApiError.badRequest(`status must be one of: ${Object.values(DELIVERY_STATUS).join(', ')}`);
  }

  const delivery = assertAccess(req.user, await Delivery.findById(req.params.id));
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isAdmin && delivery.driverId !== req.user.id) {
    throw ApiError.forbidden('Only the assigned driver can update this delivery');
  }
  if (status === DELIVERY_STATUS.CANCELLED && !isAdmin) {
    throw ApiError.forbidden('Only an admin can cancel a delivery');
  }
  if (!DELIVERY_TRANSITIONS[delivery.status].includes(status)) {
    throw ApiError.badRequest(
      `Cannot change delivery status from ${delivery.status} to ${status}`,
      { allowed: DELIVERY_TRANSITIONS[delivery.status] }
    );
  }

  // Update the order first so both services stay consistent if the order rejects the change.
  const orderStatus = ORDER_STATUS_SYNC[status];
  if (orderStatus) {
    try {
      await callService(config.orderServiceUrl, `/api/orders/${encodeURIComponent(delivery.orderId)}/status`, {
        method: 'PATCH',
        token: req.token,
        body: {
          status: orderStatus,
          note: `${status === DELIVERY_STATUS.PICKED_UP ? 'Picked up' : 'Delivered'} by ${delivery.driverName || 'driver'}`
        }
      });
    } catch (error) {
      if (error.statusCode >= 500) throw error;
      throw new ApiError(
        409,
        `Order could not be moved to ${orderStatus}: ${error.message}. The order must be READY_FOR_PICKUP before pickup.`,
        error.details
      );
    }
  }

  if (status === DELIVERY_STATUS.PICKED_UP) delivery.pickedUpAt = new Date();
  if (status === DELIVERY_STATUS.DELIVERED) delivery.deliveredAt = new Date();
  if (status === DELIVERY_STATUS.FAILED) delivery.failureReason = note;

  delivery.changeStatus(status, actor(req.user), note);
  await delivery.save();
  res.json(delivery);
}

export async function deleteDelivery(req, res) {
  const delivery = await Delivery.findByIdAndDelete(req.params.id);
  if (!delivery) throw ApiError.notFound('Delivery not found');
  res.status(204).end();
}
