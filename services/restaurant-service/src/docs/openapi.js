import { buildOpenApi } from '../utils/openapi.js';

const tag = 'Restaurants';
const menu = 'Menu';
const manage = 'owning RESTAURANT_OWNER, ADMIN';

export const openApiSpec = buildOpenApi({
  title: 'Restaurant Service',
  description: 'Restaurants and their menus. Browsing is public; changes require the owner or an admin.',
  routes: [
    {
      method: 'get', path: '/api/restaurants', tag, auth: false, summary: 'List and search restaurants',
      query: ['search', 'cuisine', 'city', 'isOpen', 'ownerId', 'page', 'limit']
    },
    { method: 'get', path: '/api/restaurants/:id', tag, auth: false, summary: 'Get a restaurant', query: ['includeMenu'] },
    {
      method: 'post', path: '/api/restaurants', tag, roles: 'RESTAURANT_OWNER, ADMIN', status: 201, summary: 'Create a restaurant',
      body: {
        name: 'Pizza Place', cuisine: 'Italian', description: 'Wood-fired pizza',
        address: { street: '8 Lake Road', city: 'Colombo' }, phone: '0112223344', deliveryFee: 250, minOrderAmount: 0
      }
    },
    { method: 'put', path: '/api/restaurants/:id', tag, roles: manage, summary: 'Update a restaurant', body: { deliveryFee: 300 } },
    { method: 'patch', path: '/api/restaurants/:id/status', tag, roles: manage, summary: 'Open or close', body: { isOpen: false } },
    { method: 'delete', path: '/api/restaurants/:id', tag, roles: manage, status: 204, summary: 'Delete a restaurant and its menu' },
    {
      method: 'get', path: '/api/restaurants/:id/menu', tag: menu, auth: false, summary: 'List menu items',
      query: ['category', 'available', 'search', 'ids', 'page', 'limit']
    },
    { method: 'get', path: '/api/restaurants/:id/menu/:itemId', tag: menu, auth: false, summary: 'Get a menu item' },
    {
      method: 'post', path: '/api/restaurants/:id/menu', tag: menu, roles: manage, status: 201, summary: 'Add a menu item',
      body: { name: 'Margherita', price: 1800, category: 'Pizza', description: 'Tomato, mozzarella, basil', isAvailable: true }
    },
    { method: 'put', path: '/api/restaurants/:id/menu/:itemId', tag: menu, roles: manage, summary: 'Update a menu item', body: { price: 1900, isAvailable: true } },
    { method: 'delete', path: '/api/restaurants/:id/menu/:itemId', tag: menu, roles: manage, status: 204, summary: 'Delete a menu item' }
  ]
});
