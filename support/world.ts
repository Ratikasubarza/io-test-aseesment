import { World, setWorldConstructor, type IWorldOptions } from '@cucumber/cucumber';
import type { BrowserContext, Page, Response } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { ReservationPage } from '../pages/reservation.page';
import type { PerformanceRun } from '../performance/support/timing';
import type { Guest } from '../test-data/guests';
import type { Stay } from '../test-data/stay';

// One World instance is created per scenario, so nothing here is shared between scenarios.
export class CustomWorld extends World {
  // UI scenarios only
  context!: BrowserContext;
  page!: Page;
  homePage!: HomePage;
  reservationPage!: ReservationPage;

  // Scenario state
  stay?: Stay;
  guest?: Guest;
  bookingResponse?: Response;
  createdBookingId?: number;

  // Performance scenarios only
  performanceRun?: PerformanceRun;

  constructor(options: IWorldOptions) {
    super(options);
  }

  init(context: BrowserContext, page: Page): void {
    this.context = context;
    this.page = page;
    this.homePage = new HomePage(page);
    this.reservationPage = new ReservationPage(page);
  }
}

setWorldConstructor(CustomWorld);
