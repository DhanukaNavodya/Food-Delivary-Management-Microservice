import { buildOpenApi } from '../utils/openapi.js';

const tag = 'Customers';
const addresses = 'Addresses';
const address = { label: 'Home', street: '1 Main Street', city: 'Colombo', postalCode: '00100', isDefault: true };

export const openApiSpec = buildOpenApi({
  title: 'Customer Service',
  description: 'Customer profiles and saved delivery addresses. `:id` may be `me` for the logged-in customer.',
  routes: [
    { method: 'get', path: '/api/customers', tag, roles: 'ADMIN', summary: 'List customers', query: ['search', 'page', 'limit'] },
    {
      method: 'post', path: '/api/customers', tag, roles: 'CUSTOMER, ADMIN', status: 201, summary: 'Create my customer profile',
      body: { phone: '0771234567', addresses: [address] }
    },
    { method: 'get', path: '/api/customers/:id', tag, roles: 'owner, ADMIN', summary: 'Get a profile (use `me`)' },
    { method: 'put', path: '/api/customers/:id', tag, roles: 'owner, ADMIN', summary: 'Update a profile', body: { phone: '0779999999' } },
    { method: 'delete', path: '/api/customers/:id', tag, roles: 'owner, ADMIN', status: 204, summary: 'Delete a profile' },
    { method: 'get', path: '/api/customers/:id/addresses', tag: addresses, roles: 'owner, ADMIN', summary: 'List addresses' },
    { method: 'post', path: '/api/customers/:id/addresses', tag: addresses, roles: 'owner, ADMIN', status: 201, summary: 'Add an address', body: address },
    { method: 'put', path: '/api/customers/:id/addresses/:addressId', tag: addresses, roles: 'owner, ADMIN', summary: 'Update an address', body: { isDefault: true } },
    { method: 'delete', path: '/api/customers/:id/addresses/:addressId', tag: addresses, roles: 'owner, ADMIN', summary: 'Delete an address' }
  ]
});
