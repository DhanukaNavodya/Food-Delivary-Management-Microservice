import { buildOpenApi } from '../utils/openapi.js';

const tag = 'Deliveries';

export const openApiSpec = buildOpenApi({
  title: 'Delivery Service',
  description: [
    'Deliveries for orders. PICKED_UP moves the order to OUT_FOR_DELIVERY and DELIVERED moves it to DELIVERED.',
    '',
    'Workflow: PENDING → ASSIGNED → PICKED_UP → DELIVERED (or FAILED / CANCELLED).'
  ].join('\n'),
  routes: [
    { method: 'post', path: '/api/deliveries', tag, roles: 'RESTAURANT_OWNER, ADMIN', status: 201, summary: 'Request a delivery for an order', body: { orderId: '<order id>', notes: 'Ring the bell' } },
    { method: 'get', path: '/api/deliveries', tag, summary: 'List deliveries (agents: own, or ?available=true)', query: ['available', 'status', 'orderId', 'driverId', 'restaurantId', 'page', 'limit'] },
    { method: 'get', path: '/api/deliveries/order/:orderId', tag, summary: 'Track the delivery of an order' },
    { method: 'get', path: '/api/deliveries/:id', tag, summary: 'Get a delivery' },
    { method: 'put', path: '/api/deliveries/:id', tag, roles: 'ADMIN', summary: 'Update notes / ETA / addresses', body: { notes: 'Leave at the gate' } },
    { method: 'patch', path: '/api/deliveries/:id/assign', tag, roles: 'DELIVERY_AGENT (self), ADMIN', summary: 'Assign a driver', body: { driverId: '<user id, admin only>', driverName: 'Ava Agent' } },
    { method: 'patch', path: '/api/deliveries/:id/status', tag, roles: 'assigned DELIVERY_AGENT, ADMIN', summary: 'Update delivery status', body: { status: 'PICKED_UP', note: 'On the way' } },
    { method: 'delete', path: '/api/deliveries/:id', tag, roles: 'ADMIN', status: 204, summary: 'Delete a delivery' }
  ]
});
