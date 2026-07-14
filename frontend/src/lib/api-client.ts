import axios from 'axios';

// H4 Fix: Backend runs on port 4000 (per backend/Dockerfile), not 8000.
// In Docker Compose, NEXT_PUBLIC_API_URL is set to "" (empty string) so all
// API calls go through nginx as relative /api/* paths on the same origin.
// For local development without Docker, use http://localhost:4000.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * NOTE on auth: this project currently uses a single "zero-configuration"
 * admin account (ADMIN_USERNAME / ADMIN_PASSWORD in the backend .env) rather
 * than per-user login (see backend/app/core/config.py). Until a real login
 * page exists, the admin credentials used to exchange for a JWT are read
 * from these NEXT_PUBLIC_* env vars, which must match the backend .env.
 *
 * This is a stopgap suitable for a single-operator self-hosted deployment.
 * Anyone extending this to multiple users/agents should replace this with
 * a real login form that POSTs credentials entered by the user, instead of
 * baking them into the client bundle.
 */
const ADMIN_USERNAME = process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;
let inFlightTokenRequest: Promise<string | null> | null = null;

/**
 * Exchange admin Basic Auth credentials for a short-lived JWT via
 * POST /api/settings/token, caching the result until shortly before it
 * expires. Returns null if the exchange fails (e.g. wrong credentials,
 * backend unreachable) so callers can decide how to degrade.
 */
export async function getToken(baseURL: string = BASE_URL): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt) {
    return cachedToken;
  }
  if (inFlightTokenRequest) {
    return inFlightTokenRequest;
  }

  inFlightTokenRequest = (async () => {
    try {
      const basicAuth =
        typeof window !== 'undefined'
          ? btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`)
          : Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');

      const response = await axios.post(
        `${baseURL}/api/settings/token`,
        {},
        { headers: { Authorization: `Basic ${basicAuth}` } }
      );

      const { access_token: accessToken } = response.data;
      if (!accessToken) return null;

      cachedToken = accessToken;
      // Backend default expiry is ACCESS_TOKEN_EXPIRE_MINUTES (30 min);
      // refresh 60s early to avoid using a token that expires mid-request.
      cachedTokenExpiresAt = Date.now() + 29 * 60 * 1000;
      return accessToken;
    } catch (err) {
      console.error('Failed to obtain access token', err);
      cachedToken = null;
      cachedTokenExpiresAt = 0;
      return null;
    } finally {
      inFlightTokenRequest = null;
    }
  })();

  return inFlightTokenRequest;
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken(config.baseURL || BASE_URL);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a request fails with 401, clear the cached token so the next request
// forces a fresh token exchange instead of retrying with a stale one.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      cachedToken = null;
      cachedTokenExpiresAt = 0;
    }
    return Promise.reject(error);
  }
);
