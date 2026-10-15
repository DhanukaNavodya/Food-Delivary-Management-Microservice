import mongoose from 'mongoose';
import { MenuItem } from '../models/MenuItem.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginate } from '../utils/pagination.js';
import { pick } from '../utils/pick.js';
import { findOwnedRestaurant, findRestaurant } from './restaurant.controller.js';

const MENU_FIELDS = ['name', 'description', 'price', 'category', 'isAvailable', 'imageUrl'];

async function findMenuItem(restaurantId, itemId) {
  const item = await MenuItem.findOne({ _id: itemId, restaurantId });
  if (!item) throw ApiError.notFound('Menu item not found');
  return item;
}

export async function listMenu(req, res) {
  const restaurant = await findRestaurant(req.params.id);
  const { category, available, search, ids } = req.query;

  const filter = { restaurantId: restaurant.id };
  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  if (available !== undefined) filter.isAvailable = available === 'true';
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');
  // `ids` (comma separated) lets the Order Service price several items in one call.
  if (ids) {
    const idList = String(ids).split(',').map((id) => id.trim()).filter(Boolean);
    if (idList.some((id) => !mongoose.isValidObjectId(id))) throw ApiError.badRequest('ids contains an invalid id');
    filter._id = { $in: idList };
  }

  res.json(await paginate(MenuItem, filter, req.query, { sort: { category: 1, name: 1 } }));
}

export async function getMenuItem(req, res) {
  res.json(await findMenuItem(req.params.id, req.params.itemId));
}

export async function createMenuItem(req, res) {
  const restaurant = await findOwnedRestaurant(req);
  const item = await MenuItem.create({ ...pick(req.body, MENU_FIELDS), restaurantId: restaurant.id });
  res.status(201).json(item);
}

export async function updateMenuItem(req, res) {
  const restaurant = await findOwnedRestaurant(req);
  const item = await findMenuItem(restaurant.id, req.params.itemId);

  Object.assign(item, pick(req.body, MENU_FIELDS));
  await item.save();
  res.json(item);
}

export async function deleteMenuItem(req, res) {
  const restaurant = await findOwnedRestaurant(req);
  const item = await findMenuItem(restaurant.id, req.params.itemId);
  await item.deleteOne();
  res.status(204).end();
}
