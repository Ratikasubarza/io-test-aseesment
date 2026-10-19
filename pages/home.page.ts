import type { Locator, Page } from '@playwright/test';
import { expect } from '../support/expect';

export class HomePage {
  private readonly page: Page;
  private readonly roomsHeading: Locator;
  private readonly roomCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.roomsHeading = page.getByRole('heading', { name: 'Our Rooms' });
    // The room cards have no role or test id, so the app's own CSS class is the most stable hook.
    this.roomCards = page.locator('.room-card');
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.roomsHeading).toBeVisible();
    await expect(this.roomCards.first()).toBeVisible();
  }

  roomCard(roomType: string): Locator {
    return this.roomCards
      .filter({ has: this.page.getByRole('heading', { name: roomType, exact: true }) })
      .first();
  }

  async bookRoom(roomType: string): Promise<void> {
    await this.roomCard(roomType).getByRole('link', { name: 'Book now' }).click();
    await this.page.waitForURL(/\/reservation\/\d+/);
  }
}
