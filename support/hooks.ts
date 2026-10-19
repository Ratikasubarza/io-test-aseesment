import fs from 'node:fs';
import path from 'node:path';
import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  Status,
  setDefaultTimeout,
  type ITestCaseHookParameter,
} from '@cucumber/cucumber';
import { chromium, type Browser } from '@playwright/test';
import { env } from '../config/env';
import { deleteBookingAsAdmin } from './booking-api';
import type { CustomWorld } from './world';

const REPORTS_DIR = path.resolve('reports');
const SCREENSHOT_DIR = path.join(REPORTS_DIR, 'screenshots');
const TRACE_DIR = path.join(REPORTS_DIR, 'traces');

// Performance scenarios call the API directly and do not use a browser.
const UI_ONLY = 'not @performance';

// The browser is started the first time a UI scenario needs it, so a performance-only run
// works without Chromium being installed.
let browser: Browser | undefined;

async function getBrowser(): Promise<Browser> {
  browser ??= await chromium.launch({
    headless: env.headless,
    slowMo: env.slowMoMs,
    executablePath: env.browserPath,
  });
  return browser;
}

setDefaultTimeout(env.timeouts.step);

const fileSafe = (text: string): string => text.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

BeforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(TRACE_DIR, { recursive: true });
});

AfterAll(async () => {
  await browser?.close();
});

// Every UI scenario gets its own browser context, so cookies and storage never leak between scenarios.
Before({ tags: UI_ONLY }, async function (this: CustomWorld) {
  const context = await (await getBrowser()).newContext({
    baseURL: env.baseUrl,
    viewport: { width: 1280, height: 800 },
    locale: 'en-GB',
  });
  context.setDefaultTimeout(env.timeouts.action);
  context.setDefaultNavigationTimeout(env.timeouts.navigation);
  await context.tracing.start({ screenshots: true, snapshots: true });
  this.init(context, await context.newPage());
});

After({ tags: UI_ONLY }, async function (this: CustomWorld, scenario: ITestCaseHookParameter) {
  // If the Before hook failed there is no page to inspect; let the original error show.
  if (!this.context) {
    return;
  }
  const name = `${fileSafe(scenario.pickle.name)}-${Date.now()}`;

  if (scenario.result?.status === Status.FAILED) {
    const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
    const tracePath = path.join(TRACE_DIR, `${name}.zip`);
    const png = await this.page.screenshot({ path: screenshotPath, fullPage: true });
    await this.context.tracing.stop({ path: tracePath });
    this.attach(png, 'image/png');
    this.attach(`Trace: ${tracePath}\nOpen it with: npx playwright show-trace "${tracePath}"`, 'text/plain');
  } else {
    await this.context.tracing.stop();
  }

  // Remove the booking this scenario created. A failed clean-up is reported but does not
  // change the result of the scenario, because clean-up is not what is being tested.
  if (this.createdBookingId !== undefined) {
    try {
      await deleteBookingAsAdmin(this.createdBookingId);
      this.attach(`Deleted booking ${this.createdBookingId} after the scenario.`, 'text/plain');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`WARNING: clean-up of booking ${this.createdBookingId} failed: ${message}`);
      this.attach(`Clean-up of booking ${this.createdBookingId} failed: ${message}`, 'text/plain');
    }
  }

  await this.context.close();
});
