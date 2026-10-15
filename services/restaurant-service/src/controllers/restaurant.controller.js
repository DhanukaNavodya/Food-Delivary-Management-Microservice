import { MenuItem } from '../models/MenuItem.js';
import { Restaurant } from '../models/Restaurant.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginate } from '../utils/pagination.js';
import { pick } from '../utils/pick.js';
import { ROLES } from '../utils/roles.js';

const RESTAURANT_FIELDS = [
  'name', 'description', 'cuisine', 'address', 'phone',
  'isOpen', 'rating', 'deliveryFee', 'minOrderAmount', 'openingHours'
];

export async function findRestaurant(id) {
  const restaurant = await Restaurant.findById(id);
  if (!restaurant) throw ApiError.notFound('Restaurant not found');
  return restaurant;
}

// Loads a restaurant and checks the current user owns it (admins can manage any restaurant).
export async function findOwnedRestaurant(req) {
  const restaurant = await findRestaurant(req.params.id);
  if (req.user.role !== ROLES.ADMIN && restaurant.ownerId !== req.user.id) {
    throw ApiError.forbidden('You can only manage your own restaurants');
  }
  return restaurant;
}

export async function listRestaurants(req, res) {
  const { cuisine, city, isOpen, search, ownerId } = req.query;
  const filter = {};
  if (cuisine) filter.cuisine = new RegExp(`^${escapeRegex(cuisine)}$`, 'i');
  if (city) filter['address.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i');
  if (isOpen !== undefined) filter.isOpen = isOpen === 'true';
  if (ownerId) filter.ownerId = ownerId;
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { description: regex }, { cuisine: regex }];
  }

  res.json(await paginate(Restaurant, filter, req.query, { sort: { rating: -1, createdAt: -1 } }));
}

export async function getRestaurant(req, res) {
  const restaurant = await findRestaurant(req.params.id);
  if (req.query.includeMenu !== 'true') return res.json(restaurant);

  const menu = await MenuItem.find({ restaurantId: restaurant.id }).sort({ category: 1, name: 1 });
  res.json({ ...restaurant.toJSON(), menu });
}

export async function createRestaurant(req, res) {
  const ownerId = req.user.role === ROLES.ADMIN && req.body?.ownerId ? String(req.body.ownerId) : req.user.id;
  const restaurant = await Restaurant.create({ ...pick(req.body, RESTAURANT_FIELDS), ownerId });
  res.status(201).json(restaurant);
}

export async function updateRestaurant(req, res) {
  const restaurant = await findOwnedRestaurant(req);
  Object.assign(restaurant, pick(req.body, RESTAURANT_FIELDS));
  if (req.user.role === ROLES.ADMIN && req.body?.ownerId) restaurant.ownerId = String(req.body.ownerId);

  await restaurant.save();
  res.json(restaurant);
}

export async function updateRestaurantStatus(req, res) {
  if (typeof req.body?.isOpen !== 'boolean') throw ApiError.badRequest('isOpen (boolean) is required');

  const restaurant = await findOwnedRestaurant(req);
  restaurant.isOpen = req.body.isOpen;
  await restaurant.save();
  res.json(restaurant);
}

export async function deleteRestaurant(req, res) {
  const restaurant = await findOwnedRestaurant(req);
  await MenuItem.deleteMany({ restaurantId: restaurant.id });
  await restaurant.deleteOne();
  res.status(204).end();
}
