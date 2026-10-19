import { expect as baseExpect } from '@playwright/test';
import { env } from '../config/env';

// expect.configure() returns a new instance rather than changing the global one,
// so every file imports this configured version instead of the one from @playwright/test.
export const expect = baseExpect.configure({ timeout: env.timeouts.assertion });
