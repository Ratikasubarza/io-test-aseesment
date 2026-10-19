// All run-time settings live here. Every value can be overridden with an environment variable.

const flag = (value: string | undefined): boolean => value?.toLowerCase() === 'true';

const positiveInt = (value: string | undefined, fallback: number): number => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

const baseUrl = (process.env.BASE_URL ?? 'https://automationintesting.online').replace(/\/+$/, '');

export const env = {
  baseUrl,
  // Same address as {{baseUrl}} in the Postman collection.
  apiBaseUrl: `${baseUrl}/api`,

  // HEADED=true shows the browser window.
  headless: !flag(process.env.HEADED),
  slowMoMs: Number(process.env.SLOW_MO ?? 0),

  // Optional: path to an already-installed Chromium/Chrome instead of Playwright's own download.
  browserPath: process.env.BROWSER_PATH || undefined,

  // Used to delete data the tests create, and to call the admin-only endpoints.
  // These are the public demo credentials listed on the Restful Booker site, not real secrets.
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'password',

  performance: {
    // How many times the full list of requests is sent, one request at a time.
    rounds: positiveInt(process.env.PERF_ROUNDS, 5),
    requestTimeoutMs: 30_000,
  },

  timeouts: {
    action: 10_000,
    navigation: 30_000,
    assertion: 10_000,
    step: 60_000,
  },
};
