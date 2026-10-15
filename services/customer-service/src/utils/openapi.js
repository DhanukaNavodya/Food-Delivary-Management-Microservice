// Builds an OpenAPI 3 document from a compact route list, served by Swagger UI at /api/docs.
const ERROR = (description) => ({ description, content: { 'application/json': { example: { message: description } } } });

export function buildOpenApi({ title, description, routes }) {
  const paths = {};

  for (const route of routes) {
    const path = route.path.replace(/:(\w+)/g, '{$1}');
    const parameters = [
      ...[...route.path.matchAll(/:(\w+)/g)].map(([, name]) => ({
        name, in: 'path', required: true, schema: { type: 'string' }
      })),
      ...(route.query || []).map((name) => ({ name, in: 'query', schema: { type: 'string' } }))
    ];

    const responses = { [route.status || 200]: { description: 'Success' }, 400: ERROR('Validation failed') };
    if (route.auth !== false) {
      responses[401] = ERROR('Authentication required');
      responses[403] = ERROR('Forbidden');
    }
    if (path.includes('{')) responses[404] = ERROR('Not found');

    paths[path] ??= {};
    paths[path][route.method] = {
      tags: [route.tag],
      summary: route.summary,
      ...((route.roles || route.description) && {
        description: [route.roles && `Allowed roles: ${route.roles}`, route.description].filter(Boolean).join('\n\n')
      }),
      ...(route.auth === false && { security: [] }),
      ...(parameters.length && { parameters }),
      ...(route.body && {
        requestBody: { required: true, content: { 'application/json': { example: route.body } } }
      }),
      responses
    };
  }

  return {
    openapi: '3.0.3',
    info: { title, version: '1.0.0', description },
    // Relative server: "Try it out" works both through the gateway and on the service port.
    servers: [{ url: '/' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
    },
    security: [{ bearerAuth: [] }],
    paths
  };
}
