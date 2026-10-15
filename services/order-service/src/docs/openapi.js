import { buildOpenApi } from '../utils/openapi.js';

const tag = 'Orders';

export const openApiSpec = buildOpenApi({
  title: 'Order Service',
  description: [
    'Order placement and lifecycle. Prices are always taken from the Restaurant Service.',
    '',
    'Workflow: PENDING → CONFIRMED → PREPARING → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED (or CANCELLED from PENDING/CONFIRMED).'
  ].join('\n'),
  routes: [
    {
      method: 'post', path: '/api/orders', tag, roles: 'CUSTOMER, ADMIN (with customerId)', status: 201, summary: 'Place an order',
      body: {
        restaurantId: '<restaurant id>',
        items: [{ menuItemId: '<menu item id>', quantity: 2 }],
        deliveryAddress: { street: '1 Main Street', city: 'Colombo' },
        notes: 'No onions',
        paymentMethod: 'CASH'
      }
    },
    { method: 'get', path: '/api/orders', tag, summary: 'List orders (scoped to your role)', query: ['status', 'restaurantId', 'customerId', 'page', 'limit'] },
    { method: 'get', path: '/api/orders/stats', tag, roles: 'RESTAURANT_OWNER, ADMIN', summary: 'Order counts and revenue by status' },
    { method: 'get', path: '/api/orders/:id', tag, summary: 'Get an order' },
    { method: 'put', path: '/api/orders/:id', tag, roles: 'CUSTOMER, ADMIN', summary: 'Edit a PENDING order', body: { notes: 'Extra spicy' } },
    {
      method: 'patch', path: '/api/orders/:id/status', tag, summary: 'Move the order to its next status',
      description: 'RESTAURANT_OWNER: CONFIRMED, PREPARING, READY_FOR_PICKUP, CANCELLED. DELIVERY_AGENT: OUT_FOR_DELIVERY, DELIVERED.',
      body: { status: 'CONFIRMED', note: 'Accepted by the kitchen' }
    },
    { method: 'patch', path: '/api/orders/:id/cancel', tag, summary: 'Cancel a PENDING or CONFIRMED order', body: { reason: 'Changed my mind' } },
    { method: 'delete', path: '/api/orders/:id', tag, roles: 'ADMIN', status: 204, summary: 'Delete an order' }
  ]
});
