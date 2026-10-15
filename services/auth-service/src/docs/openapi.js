import { buildOpenApi } from '../utils/openapi.js';

const tag = 'Auth';
const users = 'Users (admin)';

export const openApiSpec = buildOpenApi({
  title: 'Auth Service',
  description: 'Registration, login (JWT) and user management. Use the token from login with the Authorize button.',
  routes: [
    {
      method: 'post', path: '/api/auth/register', tag, auth: false, status: 201,
      summary: 'Register a user (CUSTOMER, RESTAURANT_OWNER or DELIVERY_AGENT)',
      body: { name: 'Jane Doe', email: 'jane@example.com', password: 'secret123', role: 'CUSTOMER' }
    },
    {
      method: 'post', path: '/api/auth/login', tag, auth: false, summary: 'Log in and receive a JWT',
      body: { email: 'admin@fooddelivery.local', password: 'Admin@123' }
    },
    { method: 'get', path: '/api/auth/verify', tag, summary: 'Validate a token' },
    { method: 'get', path: '/api/auth/me', tag, summary: 'Get my account' },
    { method: 'put', path: '/api/auth/me', tag, summary: 'Update my name/email', body: { name: 'Jane D.' } },
    {
      method: 'patch', path: '/api/auth/me/password', tag, summary: 'Change my password',
      body: { currentPassword: 'secret123', newPassword: 'newSecret456' }
    },
    { method: 'get', path: '/api/auth/users', tag: users, roles: 'ADMIN', summary: 'List users', query: ['role', 'search', 'isActive', 'page', 'limit'] },
    {
      method: 'post', path: '/api/auth/users', tag: users, roles: 'ADMIN', status: 201, summary: 'Create a user with any role',
      body: { name: 'Ops Admin', email: 'ops@example.com', password: 'secret123', role: 'ADMIN' }
    },
    { method: 'get', path: '/api/auth/users/:id', tag: users, roles: 'ADMIN', summary: 'Get a user' },
    { method: 'put', path: '/api/auth/users/:id', tag: users, roles: 'ADMIN', summary: 'Update a user', body: { role: 'DELIVERY_AGENT', isActive: true } },
    { method: 'delete', path: '/api/auth/users/:id', tag: users, roles: 'ADMIN', status: 204, summary: 'Delete a user' }
  ]
});
