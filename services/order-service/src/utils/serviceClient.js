import { ApiError } from './ApiError.js';

// Calls another microservice over the Docker network, forwarding the caller's JWT.
export async function callService(baseUrl, path, { method = 'GET', token, body, timeoutMs = 5000 } = {}) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new ApiError(503, `Dependent service unavailable: ${baseUrl}`, error.message);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.message || `Upstream request failed (${response.status})`, data?.details);
  }

  return data;
}
