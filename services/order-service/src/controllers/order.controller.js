import { config } from '../config/env.js';
import { ORDER_STATUS, ORDER_TRANSITIONS, Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { pick } from '../utils/pick.js';
import { ROLES } from '../utils/roles.js';
import { callService } from '../utils/serviceClient.js';

// Which target statuses each role may set via PATCH /:id/status.
const ROLE_STATUS_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(ORDER_STATUS),
  [ROLES.RESTAURANT_OWNER]: [
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.CANCELLED
  ],
  [ROLES.DELIVERY_AGENT]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED],
  [ROLES.CUSTOMER]: [ORDER_STATUS.CANCELLED]
};

const DELIVERY_VISIBLE_STATUSES = [
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED
];

function canAccessOrder(user, order) {
  switch (user.role) {
    case ROLES.ADMIN:
      return true;
    case ROLES.CUSTOMER:
      return order.userId === user.id;
    case ROLES.RESTAURANT_OWNER:
      return order.restaurantOwnerId === user.id;
    case ROLES.DELIVERY_AGENT:
      return DELIVERY_VISIBLE_STATUSES.includes(order.status);
    default:
      return false;
  }
}

async function findAccessibleOrder(req) {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  if (!canAccessOrder(req.user, order)) throw ApiError.forbidden('You do not have access to this order');
  return order;
}

function applyStatusChange(order, status, user, note) {
  if (!ORDER_TRANSITIONS[order.status].includes(status)) {
    throw ApiError.badRequest(
      `Cannot change order status from ${order.status} to ${status}`,
      { allowed: ORDER_TRANSITIONS[order.status] }
    );
  }

  order.changeStatus(status, `${user.role}:${user.id}`, note);
  if (status === ORDER_STATUS.DELIVERED && order.paymentMethod === 'CASH') order.paymentStatus = 'PAID';
  if (status === ORDER_STATUS.CANCELLED && order.paymentStatus === 'PAID') order.paymentStatus = 'REFUNDED';
}

async function fetchCustomer(req, customerId) {
  const path = customerId ? `/api/customers/${encodeURIComponent(customerId)}` : '/api/customers/me';
  try {
    return await callService(config.customerServiceUrl, path, { token: req.token });
  } catch (error) {
    if (error.statusCode === 404) {
      throw ApiError.badRequest(customerId
        ? 'Customer not found'
        : 'Customer profile not found. Create one with POST /api/customers before ordering');
    }
    throw error;
  }
}

async function fetchRestaurant(restaurantId) {
  try {
    return await callService(config.restaurantServiceUrl, `/api/restaurants/${encodeURIComponent(restaurantId)}`);
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 400) throw ApiError.badRequest('Restaurant not found');
    throw error;
  }
}

async function priceItems(restaurantId, requestedItems) {
  const ids = [...new Set(requestedItems.map((item) => item.menuItemId))];
  const { data: menuItems } = await callService(
    config.restaurantServiceUrl,
    `/api/restaurants/${encodeURIComponent(restaurantId)}/menu?limit=100&ids=${ids.map(encodeURIComponent).join(',')}`
  );
  const menuById = new Map(menuItems.map((item) => [item.id, item]));

  return requestedItems.map(({ menuItemId, quantity }) => {
    const menuItem = menuById.get(menuItemId);
    if (!menuItem) throw ApiError.badRequest(`Menu item ${menuItemId} does not belong to this restaurant`);
    if (!menuItem.isAvailable) throw ApiError.badRequest(`${menuItem.name} is currently unavailable`);

    return {
      menuItemId,
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      subtotal: menuItem.price * quantity
    };
  });
}

function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items must be a non-empty array of { menuItemId, quantity }');
  }
  if (items.length > 50) throw ApiError.badRequest('An order can contain at most 50 items');

  return items.map((item, index) => {
    const quantity = Number(item?.quantity ?? 1);
    if (!item?.menuItemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw ApiError.badRequest(`items[${index}] must have a menuItemId and an integer quantity between 1 and 100`);
    }
    return { menuItemId: String(item.menuItemId), quantity };
  });
}

export async function createOrder(req, res) {
  const { restaurantId, items, deliveryAddress, notes, paymentMethod, customerId } = req.body ?? {};
  if (!restaurantId) throw ApiError.badRequest('restaurantId is required');
  const requestedItems = parseItems(items);

  const isAdmin = req.user.role === ROLES.ADMIN;
  if (isAdmin && !customerId) throw ApiError.badRequest('customerId is required when an admin places an order');

  const [customer, restaurant] = await Promise.all([
    fetchCustomer(req, isAdmin ? customerId : undefined),
    fetchRestaurant(restaurantId)
  ]);
  if (!restaurant.isOpen) throw ApiError.badRequest(`${restaurant.name} is currently closed`);

  const pricedItems = await priceItems(restaurant.id, requestedItems);
  const subtotal = pricedItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (subtotal < (restaurant.minOrderAmount || 0)) {
    throw ApiError.badRequest(`Minimum order amount for ${restaurant.name} is ${restaurant.minOrderAmount}`);
  }

  const address = deliveryAddress || customer.defaultAddress;
  if (!address) {
    throw ApiError.badRequest('deliveryAddress is required (or add a default address to the customer profile)');
  }

  const deliveryFee = restaurant.deliveryFee || 0;
  const order = new Order({
    userId: customer.userId,
    customerId: customer.id,
    customerName: customer.name,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantOwnerId: restaurant.ownerId,
    items: pricedItems,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    deliveryAddress: pick(address, ['street', 'city', 'postalCode']),
    notes,
    paymentMethod
  });
  order.changeStatus(ORDER_STATUS.PENDING, `${req.user.role}:${req.user.id}`, 'Order placed');

  await order.save();
  res.status(201).json(order);
}

export async function listOrders(req, res) {
  const { status, restaurantId, customerId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (restaurantId) filter.restaurantId = restaurantId;
  if (customerId) filter.customerId = customerId;

  // Scope results to what the current role is allowed to see.
  switch (req.user.role) {
    case ROLES.CUSTOMER:
      filter.userId = req.user.id;
      break;
    case ROLES.RESTAURANT_OWNER:
      filter.restaurantOwnerId = req.user.id;
      break;
    case ROLES.DELIVERY_AGENT:
      filter.status = DELIVERY_VISIBLE_STATUSES.includes(status) ? status : { $in: DELIVERY_VISIBLE_STATUSES };
      break;
    default:
      break;
  }

  res.json(await paginate(Order, filter, req.query));
}

export async function getOrder(req, res) {
  res.json(await findAccessibleOrder(req));
}

export async function updateOrder(req, res) {
  const order = await findAccessibleOrder(req);
  if (![ROLES.CUSTOMER, ROLES.ADMIN].includes(req.user.role)) {
    throw ApiError.forbidden('Only the customer or an admin can edit order details');
  }
  if (order.status !== ORDER_STATUS.PENDING) {
    throw ApiError.badRequest('Order details can only be changed while the order is PENDING');
  }

  const { deliveryAddress, notes, paymentMethod } = req.body ?? {};
  if (deliveryAddress !== undefined) order.deliveryAddress = pick(deliveryAddress, ['street', 'city', 'postalCode']);
  if (notes !== undefined) order.notes = notes;
  if (paymentMethod !== undefined) order.paymentMethod = paymentMethod;

  await order.save();
  res.json(order);
}

export async function updateOrderStatus(req, res) {
  const { status, note } = req.body ?? {};
  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw ApiError.badRequest(`status must be one of: ${Object.values(ORDER_STATUS).join(', ')}`);
  }
  if (!ROLE_STATUS_PERMISSIONS[req.user.role]?.includes(status)) {
    throw ApiError.forbidden(`${req.user.role} cannot set order status to ${status}`);
  }

  const order = await findAccessibleOrder(req);
  applyStatusChange(order, status, req.user, note);
  if (status === ORDER_STATUS.CANCELLED) order.cancellationReason = note;

  await order.save();
  res.json(order);
}

export async function cancelOrder(req, res) {
  const order = await findAccessibleOrder(req);
  if (req.user.role === ROLES.DELIVERY_AGENT) throw ApiError.forbidden('Delivery agents cannot cancel orders');

  const reason = req.body?.reason || 'Cancelled by user';
  applyStatusChange(order, ORDER_STATUS.CANCELLED, req.user, reason);
  order.cancellationReason = reason;

  await order.save();
  res.json(order);
}

export async function deleteOrder(req, res) {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  res.status(204).end();
}

export async function getOrderStats(req, res) {
  const match = req.user.role === ROLES.RESTAURANT_OWNER ? { restaurantOwnerId: req.user.id } : {};

  const byStatus = await Order.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$total' } } },
    { $sort: { _id: 1 } }
  ]);

  const totalOrders = byStatus.reduce((sum, row) => sum + row.count, 0);
  const revenue = byStatus.find((row) => row._id === ORDER_STATUS.DELIVERED)?.amount ?? 0;

  res.json({
    totalOrders,
    deliveredRevenue: revenue,
    byStatus: byStatus.map(({ _id, count, amount }) => ({ status: _id, count, amount }))
  });
}
