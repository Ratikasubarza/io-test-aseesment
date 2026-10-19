import type { Locator, Page } from '@playwright/test';
import { expect } from '../support/expect';
import type { Guest } from '../test-data/guests';
import type { Stay } from '../test-data/stay';

export class ReservationPage {
  private readonly page: Page;
  private readonly bookingCard: Locator;

  readonly roomHeading: Locator;
  readonly nightlyRate: Locator;
  readonly reserveNowButton: Locator;

  // Price summary rows
  readonly priceSummaryHeading: Locator;
  readonly baseRateLabel: Locator;
  readonly baseRateAmount: Locator;
  readonly cleaningFeeAmount: Locator;
  readonly serviceFeeAmount: Locator;
  readonly totalAmount: Locator;

  // Guest form
  readonly firstname: Locator;
  readonly lastname: Locator;
  readonly email: Locator;
  readonly phone: Locator;
  readonly errorMessages: Locator;

  // Result
  readonly confirmationHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bookingCard = page.locator('.booking-card');

    this.roomHeading = page.getByRole('heading', { level: 1 });
    this.nightlyRate = this.bookingCard.locator('span.text-primary');
    // The same button label is used for "show the form" and "submit the form", but only one
    // of them is on the page at any time.
    this.reserveNowButton = page.getByRole('button', { name: 'Reserve Now' });

    this.priceSummaryHeading = page.getByRole('heading', { name: 'Price Summary' });
    const summary = this.bookingCard.locator('.card.bg-light');
    const row = (label: string | RegExp): Locator =>
      summary
        .locator('div.d-flex')
        .filter({ has: page.getByText(label, { exact: typeof label === 'string' }) });
    const baseRow = row(/^£\d+ x \d+ nights?$/);
    this.baseRateLabel = baseRow.locator('span').first();
    this.baseRateAmount = baseRow.locator('span').last();
    this.cleaningFeeAmount = row('Cleaning fee').locator('span').last();
    this.serviceFeeAmount = row('Service fee').locator('span').last();
    this.totalAmount = row('Total').locator('span').last();

    // The inputs are plain text boxes named through aria-label.
    this.firstname = page.getByRole('textbox', { name: 'Firstname' });
    this.lastname = page.getByRole('textbox', { name: 'Lastname' });
    this.email = page.getByRole('textbox', { name: 'Email' });
    this.phone = page.getByRole('textbox', { name: 'Phone' });
    this.errorMessages = this.bookingCard.locator('.alert-danger li');

    this.confirmationHeading = page.getByRole('heading', { name: 'Booking Confirmed' });
  }

  roomId(): number {
    const match = new URL(this.page.url()).pathname.match(/\/reservation\/(\d+)/);
    if (!match?.[1]) {
      throw new Error(`Not on a reservation page: ${this.page.url()}`);
    }
    return Number(match[1]);
  }

  // The app builds its own "Book now" links with ?checkin=...&checkout=..., and the calendar
  // picks them up on load. Changing the query string is far more reliable than dragging
  // across calendar cells, so that is how the stay is selected here.
  async selectStay(stay: Stay): Promise<void> {
    const url = new URL(this.page.url());
    url.searchParams.set('checkin', stay.checkin);
    url.searchParams.set('checkout', stay.checkout);
    await this.page.goto(url.toString());
    await expect(this.priceSummaryHeading).toBeVisible();
  }

  async readNightlyRate(): Promise<number> {
    await expect(this.nightlyRate).toHaveText(/^£\d+$/);
    const text = await this.nightlyRate.innerText();
    return Number(text.replace(/\D/g, ''));
  }

  async startReservation(): Promise<void> {
    await this.reserveNowButton.click();
    await expect(this.firstname).toBeVisible();
  }

  async fillGuestDetails(guest: Guest): Promise<void> {
    await this.firstname.fill(guest.firstname);
    await this.lastname.fill(guest.lastname);
    await this.email.fill(guest.email);
    await this.phone.fill(guest.phone);
  }

  async confirmReservation(): Promise<void> {
    await this.reserveNowButton.click();
  }
}
